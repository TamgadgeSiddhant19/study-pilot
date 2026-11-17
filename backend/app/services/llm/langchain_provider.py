import asyncio
import logging
import time
from typing import List, Dict, Any, Optional

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import (
    BaseMessage,
    HumanMessage,
    AIMessage,
    SystemMessage,
)

from app.core.config import settings
from app.services.llm.base import (
    LLMProvider,
    LLMResponse,
    LLMException,
    LLMConfigurationError,
    LLMQuotaExceededError,
    LLMTimeoutError,
)

logger = logging.getLogger("studypilot.llm.langchain")


class LangChainGeminiProvider(LLMProvider):
    """
    Google Gemini LLM provider implementation powered by LangChain (langchain-google-genai).
    Maintains provider isolation, manages prompts via LangChain abstractions,
    safely handles API errors, and guarantees server-side secret isolation.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        timeout_seconds: Optional[int] = None,
        max_output_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
    ):
        raw_key = api_key if api_key is not None else settings.GEMINI_API_KEY
        self.api_key = raw_key.strip() if raw_key else ""
        self.model = model or settings.GEMINI_MODEL or "gemini-2.5-flash"
        self.timeout_seconds = timeout_seconds or settings.LLM_TIMEOUT_SECONDS or 30
        self.max_output_tokens = max_output_tokens or settings.LLM_MAX_OUTPUT_TOKENS or 2048
        self.temperature = temperature if temperature is not None else settings.LLM_TEMPERATURE

        self._llm: Optional[ChatGoogleGenerativeAI] = None
        if self.api_key:
            try:
                self._llm = ChatGoogleGenerativeAI(
                    model=self.model,
                    api_key=self.api_key,
                    timeout=float(self.timeout_seconds),
                    max_output_tokens=self.max_output_tokens,
                    temperature=self.temperature,
                    max_retries=1,
                )
            except Exception as e:
                logger.error(f"Failed to initialize LangChain ChatGoogleGenerativeAI: {e}")
                self._llm = None

    @property
    def provider_name(self) -> str:
        return "gemini-langchain"

    @property
    def model_name(self) -> str:
        return self.model

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self._llm is not None)

    def _convert_messages(
        self,
        messages: List[Dict[str, str]],
        system_instruction: Optional[str] = None,
    ) -> List[BaseMessage]:
        """Convert standard role/content dicts into LangChain BaseMessage objects."""
        lc_messages: List[BaseMessage] = []

        if system_instruction:
            lc_messages.append(SystemMessage(content=system_instruction))

        for msg in messages:
            role = msg.get("role", "user").lower()
            content = msg.get("content", "")
            if not content:
                continue

            if role in ("system",):
                lc_messages.append(SystemMessage(content=content))
            elif role in ("assistant", "model", "ai"):
                lc_messages.append(AIMessage(content=content))
            else:
                lc_messages.append(HumanMessage(content=content))

        return lc_messages

    async def generate_chat_response(
        self,
        messages: List[Dict[str, str]],
        system_instruction: Optional[str] = None,
        max_output_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        **kwargs: Any,
    ) -> LLMResponse:
        """Call Gemini via LangChain asynchronously with timeout and error classification."""
        if not self.is_configured:
            raise LLMConfigurationError(
                "Gemini API key is not configured. Please set GEMINI_API_KEY in the backend environment."
            )

        lc_messages = self._convert_messages(messages, system_instruction=system_instruction)
        if not lc_messages:
            raise ValueError("Cannot call LLM with empty messages list")

        start_time = time.perf_counter()
        try:
            # Execute with timeout guard
            response = await asyncio.wait_for(
                self._llm.ainvoke(lc_messages),
                timeout=float(self.timeout_seconds),
            )
        except asyncio.TimeoutError:
            duration_ms = int((time.perf_counter() - start_time) * 1000)
            logger.warning(
                f"LangChain Gemini call timed out after {duration_ms}ms (limit: {self.timeout_seconds}s)"
            )
            raise LLMTimeoutError(f"Gemini API request timed out after {self.timeout_seconds}s")
        except Exception as e:
            duration_ms = int((time.perf_counter() - start_time) * 1000)
            err_msg = str(e)
            logger.error(f"LangChain Gemini invocation error after {duration_ms}ms: {err_msg}")

            # Classify errors accurately
            if "429" in err_msg or "RESOURCE_EXHAUSTED" in err_msg or "quota" in err_msg.lower():
                raise LLMQuotaExceededError(
                    "Gemini API rate limit or quota exceeded. Please try again shortly."
                )
            if "API_KEY_INVALID" in err_msg or "401" in err_msg or "403" in err_msg:
                raise LLMConfigurationError(
                    "Invalid or unauthorized Gemini API key configured."
                )
            if "404" in err_msg or "NOT_FOUND" in err_msg or "is not found for API version" in err_msg:
                raise LLMConfigurationError(
                    f"Configured Gemini model '{self.model}' is not available or not supported."
                )
            raise LLMException(f"Gemini provider error: {err_msg}")

        duration_ms = int((time.perf_counter() - start_time) * 1000)

        # Extract text content from LangChain AIMessage
        content_text = ""
        if isinstance(response.content, str):
            content_text = response.content
        elif isinstance(response.content, list):
            # Complex multipart content
            parts = []
            for part in response.content:
                if isinstance(part, str):
                    parts.append(part)
                elif isinstance(part, dict) and "text" in part:
                    parts.append(part["text"])
            content_text = "".join(parts)
        else:
            content_text = str(response.content)

        # Extract token usage metadata if available
        input_tokens = None
        output_tokens = None
        if hasattr(response, "usage_metadata") and response.usage_metadata:
            input_tokens = response.usage_metadata.get("input_tokens")
            output_tokens = response.usage_metadata.get("output_tokens")
        elif hasattr(response, "response_metadata") and "token_usage" in response.response_metadata:
            usage = response.response_metadata["token_usage"]
            input_tokens = usage.get("prompt_tokens")
            output_tokens = usage.get("completion_tokens")

        return LLMResponse(
            content=content_text.strip(),
            model=self.model,
            finish_reason="STOP",
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            inference_ms=duration_ms,
            grounding_source=f"Google Gemini via LangChain ({self.model})",
        )

    async def health_check(self) -> Dict[str, Any]:
        """Safe readiness check without exposing API key."""
        configured = self.is_configured
        return {
            "provider": self.provider_name,
            "model": self.model_name,
            "configured": configured,
            "status": "ready" if configured else "unconfigured",
            "timeout_seconds": self.timeout_seconds,
        }
