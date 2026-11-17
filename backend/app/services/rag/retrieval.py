import math
import logging
from dataclasses import dataclass
from typing import List, Optional, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.document import Document, DocumentChunk
from app.core.config import settings
from app.services.rag.embeddings import EmbeddingProvider, get_embedding_provider

logger = logging.getLogger("studypilot.rag.retrieval")


@dataclass
class RetrievedChunk:
    chunk_id: int
    document_id: int
    document_title: str
    chunk_text: str
    page_number: Optional[int]
    distance: float
    similarity_score: float
    section: Optional[str] = None


def extract_section_heading(text: str) -> Optional[str]:
    """
    Extracts section heading, markdown header, or topic title from chunk text.
    Handles Markdown '# Header', '## Subheader', or 'Title:' formatting.
    """
    if not text:
        return None
    for line in text.splitlines():
        trimmed = line.strip()
        if not trimmed:
            continue
        if trimmed.startswith("#"):
            return trimmed.lstrip("#").strip()
        if (trimmed.endswith(":") or trimmed.endswith(" -")) and len(trimmed) <= 80:
            return trimmed.rstrip(":- ").strip()
        if len(trimmed) <= 60 and not trimmed.endswith(".") and not any(ch in trimmed for ch in "{}[]()"):
            return trimmed
    return None


def deduplicate_chunks(chunks: List[RetrievedChunk], max_k: int) -> List[RetrievedChunk]:
    """
    Filters out near-duplicate or heavily overlapping chunks from the same document.
    """
    deduped: List[RetrievedChunk] = []
    seen_texts: List[str] = []

    for c in chunks:
        cleaned = c.chunk_text.strip().lower()
        is_duplicate = False
        for seen in seen_texts:
            if len(cleaned) > 20 and len(seen) > 20 and (cleaned in seen or seen in cleaned):
                is_duplicate = True
                break
        if not is_duplicate:
            deduped.append(c)
            seen_texts.append(cleaned)
        if len(deduped) >= max_k:
            break

    return deduped


def py_cosine_distance(a: List[float], b: List[float]) -> float:
    """Calculates cosine distance in pure Python for SQLite fallback."""
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 1.0
    sim = dot / (norm_a * norm_b)
    # Cosine distance = 1 - sim
    return max(0.0, min(2.0, 1.0 - sim))


class RAGRetrievalService:
    """
    Semantic retrieval service for user learning materials.
    Enforces strict multi-tenant owner scoping and configurable similarity thresholds.
    """

    @classmethod
    async def retrieve_relevant_chunks(
        cls,
        query: str,
        user_id: int,
        db: AsyncSession,
        top_k: Optional[int] = None,
        similarity_threshold: Optional[float] = None,
        embedding_provider: Optional[EmbeddingProvider] = None,
    ) -> List[RetrievedChunk]:
        """
        Embeds the query, retrieves top_k nearest chunks belonging exclusively to user_id,
        and filters by similarity threshold.
        """
        if not query.strip():
            return []

        limit_k = top_k or settings.RAG_DEFAULT_TOP_K or 4
        threshold = similarity_threshold if similarity_threshold is not None else settings.RAG_SIMILARITY_THRESHOLD

        # 1. Embed search query
        provider = embedding_provider or get_embedding_provider()
        query_vector = await provider.embed_query(query)

        # 2. Check dialect to determine whether to use pgvector native operator or SQLite fallback
        try:
            bind = db.get_bind() if hasattr(db, "get_bind") else getattr(db, "bind", None)
            dialect_name = bind.dialect.name if bind else "postgresql"
        except Exception:
            dialect_name = "postgresql"

        retrieved: List[RetrievedChunk] = []

        if dialect_name == "postgresql":
            # PostgreSQL native pgvector similarity query
            distance_col = DocumentChunk.embedding.cosine_distance(query_vector).label("distance")
            stmt = (
                select(DocumentChunk, Document.filename, distance_col)
                .join(Document, DocumentChunk.document_id == Document.id)
                .where(
                    DocumentChunk.user_id == user_id,
                    Document.processing_status == "ready",
                )
                .order_by(distance_col.asc())
                .limit(limit_k * 2)
            )
            rows = (await db.execute(stmt)).all()
            for chunk_row, doc_filename, dist in rows:
                dist_val = float(dist) if dist is not None else 1.0
                if dist_val <= threshold:
                    sim_score = round(max(0.0, 1.0 - dist_val), 4)
                    sec = extract_section_heading(chunk_row.chunk_text)
                    retrieved.append(
                        RetrievedChunk(
                            chunk_id=chunk_row.id,
                            document_id=chunk_row.document_id,
                            document_title=doc_filename,
                            chunk_text=chunk_row.chunk_text,
                            page_number=chunk_row.page_number,
                            distance=round(dist_val, 4),
                            similarity_score=sim_score,
                            section=sec,
                        )
                    )
        else:
            # In-memory / SQLite fallback (for automated test suite)
            stmt = (
                select(DocumentChunk, Document.filename)
                .join(Document, DocumentChunk.document_id == Document.id)
                .where(
                    DocumentChunk.user_id == user_id,
                    Document.processing_status == "ready",
                )
            )
            rows = (await db.execute(stmt)).all()

            scored_chunks: List[Tuple[DocumentChunk, str, float]] = []
            for chunk_row, doc_filename in rows:
                if chunk_row.embedding is not None:
                    # In SQLite, Vector is stored as list or string of floats
                    emb_list = chunk_row.embedding
                    if isinstance(emb_list, str):
                        # Clean bracketed string if needed
                        emb_list = [float(x) for x in emb_list.strip("[]()").split(",") if x.strip()]
                    dist = py_cosine_distance(query_vector, emb_list)
                    if dist <= threshold:
                        scored_chunks.append((chunk_row, doc_filename, dist))

            scored_chunks.sort(key=lambda x: x[2])
            for chunk_row, doc_filename, dist in scored_chunks[:limit_k * 2]:
                sim_score = round(max(0.0, 1.0 - dist), 4)
                sec = extract_section_heading(chunk_row.chunk_text)
                retrieved.append(
                    RetrievedChunk(
                        chunk_id=chunk_row.id,
                        document_id=chunk_row.document_id,
                        document_title=doc_filename,
                        chunk_text=chunk_row.chunk_text,
                        page_number=chunk_row.page_number,
                        distance=round(dist, 4),
                        similarity_score=sim_score,
                        section=sec,
                    )
                )

        return deduplicate_chunks(retrieved, limit_k)

    @classmethod
    def format_grounded_context(cls, chunks: List[RetrievedChunk]) -> str:
        """Formats retrieved chunks into safe, bounded reference context for the LLM."""
        if not chunks:
            return ""

        context_blocks = []
        for idx, chunk in enumerate(chunks, 1):
            page_info = f" (Page {chunk.page_number})" if chunk.page_number else ""
            section_info = f" [Section: {chunk.section}]" if chunk.section else ""
            block = (
                f"[Source {idx}: {chunk.document_title}{page_info}{section_info} | Match: {int(chunk.similarity_score * 100)}% | Chunk ID: {chunk.chunk_id}]\n"
                f"{chunk.chunk_text}"
            )
            context_blocks.append(block)

        return (
            "=== RETRIEVED USER LEARNING MATERIALS (UNTRUSTED REFERENCE CONTEXT) ===\n"
            + "\n\n".join(context_blocks)
            + "\n=== END RETRIEVED MATERIALS ==="
        )
