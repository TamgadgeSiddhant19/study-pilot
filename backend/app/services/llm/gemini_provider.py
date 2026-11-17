import asyncio
import logging
import time
from typing import List, Dict, Any, Optional

from google import genai
from google.genai import types, errors

from app.core.config import settings
from app.services.llm.base import (
    LLMProvider,
    LLMResponse,
    LLMException,
    LLMConfigurationError,
    LLMQuotaExceededError,
    LLMTimeoutError,
)

logger = logging.getLogger("studypilot.llm.gemini")


class GeminiProvider(LLMProvider):
    """Google Gemini LLM provider implementation using the official google-genai SDK."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        timeout_seconds: Optional[int] = None,
    ):
        self.api_key = (api_key if api_key is not None else settings.GEMINI_API_KEY).strip()
        self.model = model or settings.GEMINI_MODEL or "gemini-2.5-flash"
        self.timeout_seconds = timeout_seconds or settings.LLM_TIMEOUT_SECONDS

        self._client: Optional[genai.Client] = None
        if self.api_key:
            try:
                self._client = genai.Client(api_key=self.api_key)
            except Exception as e:
                logger.error(f"Failed to initialize Gemini client: {e}")
                self._client = None

    @property
    def provider_name(self) -> str:
        return "gemini"

    @property
    def model_name(self) -> str:
        return self.model

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self._client is not None)

    def _convert_messages(self, messages: List[Dict[str, str]]) -> List[types.Content]:
        """Convert standard role/content messages into google-genai Content objects."""
        contents: List[types.Content] = []
        for msg in messages:
            role = msg.get("role", "user")
            content_text = msg.get("content", "")
            if not content_text:
                continue

            # Map "assistant" role to Gemini's "model" role
            gemini_role = "model" if role == "assistant" else "user"

            contents.append(
                types.Content(
                    role=gemini_role,
                    parts=[types.Part.from_text(text=content_text)],
                )
            )
        return contents

    async def generate_chat_response(
        self,
        messages: List[Dict[str, str]],
        system_instruction: Optional[str] = None,
        max_output_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        **kwargs: Any,
    ) -> LLMResponse:
        """Call Gemini API asynchronously with timeout, grounding, and error boundaries."""
        if not self.is_configured:
            raise LLMConfigurationError(
                "Gemini API key is not configured. Please set GEMINI_API_KEY in the backend environment."
            )

        contents = self._convert_messages(messages)
        if not contents:
            raise ValueError("Cannot call LLM with empty messages list")

        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=temperature if temperature is not None else settings.LLM_TEMPERATURE,
            max_output_tokens=max_output_tokens or settings.LLM_MAX_OUTPUT_TOKENS,
        )

        start_time = time.perf_counter()
        try:
            # Execute async call with timeout guard
            response = await asyncio.wait_for(
                self._client.aio.models.generate_content(
                    model=self.model,
                    contents=contents,
                    config=config,
                ),
                timeout=self.timeout_seconds,
            )
        except asyncio.TimeoutError:
            duration_ms = int((time.perf_counter() - start_time) * 1000)
            logger.warning(f"Gemini API timed out after {duration_ms}ms (limit: {self.timeout_seconds}s)")
            raise LLMTimeoutError(f"Gemini API request timed out after {self.timeout_seconds}s")
        except errors.APIError as e:
            duration_ms = int((time.perf_counter() - start_time) * 1000)
            code = getattr(e, "code", None)
            message = str(e)
            logger.error(f"Gemini APIError ({code}) after {duration_ms}ms: {message}")

            if code == 429 or "RESOURCE_EXHAUSTED" in message or "quota" in message.lower():
                raise LLMQuotaExceededError("Gemini API rate limit or quota exceeded. Please try again shortly.")
            raise LLMException(f"Gemini API returned error ({code}): {message}")
        except Exception as e:
            duration_ms = int((time.perf_counter() - start_time) * 1000)
            logger.error(f"Unexpected error calling Gemini API after {duration_ms}ms: {e}")
            raise LLMException(f"Unexpected Gemini API error: {str(e)}")

        duration_ms = int((time.perf_counter() - start_time) * 1000)

        # Extract text content
        output_text = response.text or ""
        
        # Extract token usage if available
        input_tokens = None
        output_tokens = None
        if hasattr(response, "usage_metadata") and response.usage_metadata:
            input_tokens = getattr(response.usage_metadata, "prompt_token_count", None)
            output_tokens = getattr(response.usage_metadata, "candidates_token_count", None)

        return LLMResponse(
            content=output_text.strip(),
            model=self.model,
            finish_reason="STOP",
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            inference_ms=duration_ms,
            grounding_source=f"Google Gemini ({self.model})",
        )

    async def health_check(self) -> Dict[str, Any]:
        """Perform a safe health and readiness check without exposing the API key."""
        configured = self.is_configured
        return {
            "provider": self.provider_name,
            "model": self.model_name,
            "configured": configured,
            "status": "ready" if configured else "unconfigured",
            "timeout_seconds": self.timeout_seconds,
        }
