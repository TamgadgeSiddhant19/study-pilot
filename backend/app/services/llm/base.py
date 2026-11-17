from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class LLMMessage(BaseModel):
    role: str  # "user", "assistant", "system"
    content: str


class LLMResponse(BaseModel):
    content: str
    model: str
    finish_reason: Optional[str] = "STOP"
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    inference_ms: int = 0
    grounding_source: Optional[str] = None


class LLMException(Exception):
    """Base exception for LLM provider errors."""
    pass


class LLMConfigurationError(LLMException):
    """Raised when provider configuration or credentials are missing."""
    pass


class LLMQuotaExceededError(LLMException):
    """Raised when API quota or rate limits are exhausted."""
    pass


class LLMTimeoutError(LLMException):
    """Raised when an inference call times out."""
    pass


class LLMProvider(ABC):
    """Abstract interface for LLM providers."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Name of the provider (e.g., 'gemini', 'deterministic', 'openai')."""
        pass

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Identifier of the active model."""
        pass

    @abstractmethod
    async def generate_chat_response(
        self,
        messages: List[Dict[str, str]],
        system_instruction: Optional[str] = None,
        max_output_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        **kwargs: Any
    ) -> LLMResponse:
        """Generate a chat completion response from the model."""
        pass

    @abstractmethod
    async def health_check(self) -> Dict[str, Any]:
        """Perform a configuration/readiness check without exposing credentials."""
        pass
