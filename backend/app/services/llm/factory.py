from typing import Optional
from app.core.config import settings
from app.services.llm.base import LLMProvider
from app.services.llm.langchain_provider import LangChainGeminiProvider
from app.services.llm.gemini_provider import GeminiProvider
from app.services.llm.deterministic_provider import DeterministicProvider

_override_provider: Optional[LLMProvider] = None


def set_llm_provider_override(provider: Optional[LLMProvider]) -> None:
    """Set or clear a global override for the LLM provider (useful for tests)."""
    global _override_provider
    _override_provider = provider


def get_llm_provider() -> LLMProvider:
    """
    Factory function returning the configured LLM provider.
    Priority:
    1. Test/custom override (if set)
    2. LangChain Gemini provider (if LLM_PROVIDER is "gemini")
    3. Deterministic provider (if LLM_PROVIDER is "deterministic" or fallback)
    """
    if _override_provider is not None:
        return _override_provider

    provider_name = (settings.LLM_PROVIDER or "gemini").lower().strip()

    if provider_name == "gemini":
        return LangChainGeminiProvider(
            api_key=settings.GEMINI_API_KEY,
            model=settings.GEMINI_MODEL,
            timeout_seconds=settings.LLM_TIMEOUT_SECONDS,
            max_output_tokens=settings.LLM_MAX_OUTPUT_TOKENS,
            temperature=settings.LLM_TEMPERATURE,
        )
    elif provider_name == "deterministic":
        return DeterministicProvider()
    else:
        # Fallback to deterministic
        return DeterministicProvider()
