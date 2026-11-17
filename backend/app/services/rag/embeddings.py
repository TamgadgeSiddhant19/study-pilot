import asyncio
import hashlib
import logging
import math
from abc import ABC, abstractmethod
from typing import List, Optional

from langchain_google_genai import GoogleGenerativeAIEmbeddings
from app.core.config import settings

logger = logging.getLogger("studypilot.rag.embeddings")


class EmbeddingException(Exception):
    """Base exception for embedding generation failures."""
    pass


class EmbeddingConfigurationError(EmbeddingException):
    """Raised when embedding provider API keys or configuration are missing."""
    pass


class EmbeddingQuotaError(EmbeddingException):
    """Raised when embedding API rate limit or quota is exhausted."""
    pass


class EmbeddingTimeoutError(EmbeddingException):
    """Raised when an embedding request times out."""
    pass


class EmbeddingProvider(ABC):
    """Abstract interface for text embedding providers."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        pass

    @property
    @abstractmethod
    def dimension(self) -> int:
        pass

    @abstractmethod
    async def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Batch embed a list of document chunks."""
        pass

    @abstractmethod
    async def embed_query(self, text: str) -> List[float]:
        """Embed a single search query."""
        pass


class GoogleGeminiEmbeddingProvider(EmbeddingProvider):
    """
    Official Google Gemini embedding provider using LangChain's GoogleGenerativeAIEmbeddings.
    Defaults to 'models/text-embedding-004' (768 dimensions).
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        dimension: Optional[int] = None,
    ):
        raw_key = api_key if api_key is not None else settings.GEMINI_API_KEY
        self.api_key = raw_key.strip() if raw_key else ""
        self.model = model or settings.EMBEDDING_MODEL or "models/text-embedding-004"
        self._dimension = dimension or settings.EMBEDDING_DIMENSION or 768

        self._client: Optional[GoogleGenerativeAIEmbeddings] = None
        if self.api_key:
            try:
                self._client = GoogleGenerativeAIEmbeddings(
                    model=self.model,
                    google_api_key=self.api_key,
                )
            except Exception as e:
                logger.error(f"Failed to initialize GoogleGenerativeAIEmbeddings: {e}")
                self._client = None

    @property
    def provider_name(self) -> str:
        return "gemini"

    @property
    def dimension(self) -> int:
        return self._dimension

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self._client is not None)

    async def embed_documents(self, texts: List[str]) -> List[List[float]]:
        if not self.is_configured:
            raise EmbeddingConfigurationError(
                "Gemini API key is not configured for embeddings. Please set GEMINI_API_KEY."
            )
        if not texts:
            return []

        # Batch in chunks of 20 to respect API payload limits
        batch_size = 20
        all_embeddings: List[List[float]] = []

        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            try:
                # Add 30s timeout guard per batch
                batch_embeddings = await asyncio.wait_for(
                    self._client.aembed_documents(batch),
                    timeout=30.0,
                )
                all_embeddings.extend(batch_embeddings)
            except asyncio.TimeoutError:
                raise EmbeddingTimeoutError("Embedding generation timed out after 30 seconds.")
            except Exception as e:
                err_msg = str(e)
                logger.error(f"Error during Gemini batch embedding: {err_msg}")
                if "429" in err_msg or "RESOURCE_EXHAUSTED" in err_msg or "quota" in err_msg.lower():
                    raise EmbeddingQuotaError("Gemini embedding rate limit or quota exceeded.")
                raise EmbeddingException(f"Gemini embedding error: {err_msg}")

        return all_embeddings

    async def embed_query(self, text: str) -> List[float]:
        if not self.is_configured:
            raise EmbeddingConfigurationError(
                "Gemini API key is not configured for embeddings. Please set GEMINI_API_KEY."
            )
        if not text.strip():
            raise ValueError("Cannot embed an empty query.")

        try:
            query_vector = await asyncio.wait_for(
                self._client.aembed_query(text.strip()),
                timeout=15.0,
            )
            return query_vector
        except asyncio.TimeoutError:
            raise EmbeddingTimeoutError("Query embedding timed out after 15 seconds.")
        except Exception as e:
            err_msg = str(e)
            logger.error(f"Error during Gemini query embedding: {err_msg}")
            if "429" in err_msg or "RESOURCE_EXHAUSTED" in err_msg or "quota" in err_msg.lower():
                raise EmbeddingQuotaError("Gemini embedding rate limit or quota exceeded.")
            raise EmbeddingException(f"Gemini embedding error: {err_msg}")


class MockEmbeddingProvider(EmbeddingProvider):
    """
    Deterministic pseudo-semantic embedding provider for hermetic automated tests.
    Generates normalized unit vectors of dimension 768 based on keyword hashing.
    Enables zero-cost, reproducible vector similarity tests.
    """

    def __init__(self, dimension: Optional[int] = None):
        self._dimension = dimension or settings.EMBEDDING_DIMENSION or 768

    @property
    def provider_name(self) -> str:
        return "mock"

    @property
    def dimension(self) -> int:
        return self._dimension

    def _generate_vector(self, text: str) -> List[float]:
        # Hash text words into 768 pseudo-semantic dimensions
        vec = [0.0] * self._dimension
        words = text.lower().split()
        for word in words:
            # Deterministic hash bucket
            h = int(hashlib.md5(word.encode("utf-8")).hexdigest(), 16)
            idx = h % self._dimension
            vec[idx] += 1.0

        # L2-normalize
        norm = math.sqrt(sum(x * x for x in vec))
        if norm == 0.0:
            vec[0] = 1.0
        else:
            vec = [x / norm for x in vec]
        return vec

    async def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return [self._generate_vector(t) for t in texts]

    async def embed_query(self, text: str) -> List[float]:
        return self._generate_vector(text)


_embedding_provider_override: Optional[EmbeddingProvider] = None


def set_embedding_provider_override(provider: Optional[EmbeddingProvider]) -> None:
    """Set or clear a global override for the embedding provider (useful for tests)."""
    global _embedding_provider_override
    _embedding_provider_override = provider


def get_embedding_provider() -> EmbeddingProvider:
    """Factory returning active embedding provider (Gemini, Mock, or Test Override)."""
    if _embedding_provider_override is not None:
        return _embedding_provider_override

    provider_name = (settings.EMBEDDING_PROVIDER or "gemini").lower().strip()
    if provider_name == "mock":
        return MockEmbeddingProvider(dimension=settings.EMBEDDING_DIMENSION)

    return GoogleGeminiEmbeddingProvider(
        api_key=settings.GEMINI_API_KEY,
        model=settings.EMBEDDING_MODEL,
        dimension=settings.EMBEDDING_DIMENSION,
    )
