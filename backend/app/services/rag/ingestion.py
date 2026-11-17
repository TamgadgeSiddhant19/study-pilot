import logging
from typing import Optional
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document, DocumentChunk
from app.services.rag.storage import DocumentStorageManager
from app.services.rag.extraction import DocumentExtractor
from app.services.rag.chunking import ParagraphChunker
from app.services.rag.embeddings import (
    EmbeddingProvider,
    get_embedding_provider,
    EmbeddingException,
)

logger = logging.getLogger("studypilot.rag.ingestion")


class DocumentIngestionService:
    """
    Coordinates document ingestion:
    validation -> storage -> text extraction -> chunking -> embedding -> persistence.
    """

    @classmethod
    async def ingest_document(
        cls,
        user_id: int,
        filename: str,
        content_type: str,
        file_bytes: bytes,
        db: AsyncSession,
        embedding_provider: Optional[EmbeddingProvider] = None,
    ) -> Document:
        """Uploads, validates, extracts, chunks, embeds, and saves a learning document."""
        # 1. Validate file format and magic bytes before saving
        DocumentExtractor.validate_file_type(filename, content_type, file_bytes)

        # 2. Save file to private user storage
        storage_path, content_hash = DocumentStorageManager.save_file(
            user_id=user_id,
            filename=filename,
            content=file_bytes,
        )

        # 3. Create initial Document DB record
        doc = Document(
            user_id=user_id,
            filename=filename,
            content_type=content_type,
            storage_path=storage_path,
            file_size_bytes=len(file_bytes),
            content_hash=content_hash,
            processing_status="uploaded",
            chunk_count=0,
        )
        db.add(doc)
        await db.commit()
        await db.refresh(doc)

        # 4. Process document content
        provider = embedding_provider or get_embedding_provider()
        await cls._process_document_content(doc=doc, file_bytes=file_bytes, db=db, provider=provider)
        return doc

    @classmethod
    async def reprocess_document(
        cls,
        document_id: int,
        user_id: int,
        db: AsyncSession,
        embedding_provider: Optional[EmbeddingProvider] = None,
    ) -> Document:
        """Safely re-extracts, re-chunks, and re-embeds an existing document."""
        doc = await db.get(Document, document_id)
        if not doc or doc.user_id != user_id:
            raise ValueError(f"Document #{document_id} not found or access denied.")

        # Read stored file bytes
        file_bytes = DocumentStorageManager.read_file(doc.storage_path)

        # Remove previous chunks to avoid duplicates during retry
        await db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == doc.id))
        await db.commit()

        provider = embedding_provider or get_embedding_provider()
        await cls._process_document_content(doc=doc, file_bytes=file_bytes, db=db, provider=provider)
        return doc

    @classmethod
    async def delete_document(cls, document_id: int, user_id: int, db: AsyncSession) -> bool:
        """Deletes document record, associated chunks, embeddings, and stored physical file."""
        doc = await db.get(Document, document_id)
        if not doc or doc.user_id != user_id:
            return False

        # 1. Delete physical file from storage
        DocumentStorageManager.delete_file(doc.storage_path)

        # 2. Delete database record (cascades to chunks)
        await db.delete(doc)
        await db.commit()
        return True

    @classmethod
    async def _process_document_content(
        cls,
        doc: Document,
        file_bytes: bytes,
        db: AsyncSession,
        provider: EmbeddingProvider,
    ) -> None:
        """Internal processing pipeline: extract -> chunk -> embed -> persist."""
        doc.processing_status = "processing"
        doc.error_message = None
        await db.commit()

        try:
            # 1. Extract text page-by-page
            pages = DocumentExtractor.extract_text(
                filename=doc.filename,
                content_type=doc.content_type,
                content=file_bytes,
            )

            # 2. Chunk text preserving page boundaries
            chunker = ParagraphChunker()
            text_chunks = chunker.chunk_pages(pages)
            if not text_chunks:
                raise ValueError("No extractable chunks found in document.")

            # 3. Generate embeddings
            raw_texts = [c.text for c in text_chunks]
            embeddings = await provider.embed_documents(raw_texts)

            if len(embeddings) != len(text_chunks):
                raise ValueError(
                    f"Mismatch: Extracted {len(text_chunks)} chunks but generated {len(embeddings)} embeddings."
                )

            # 4. Persist chunks in DB
            for chunk_meta, emb_vec in zip(text_chunks, embeddings):
                db_chunk = DocumentChunk(
                    document_id=doc.id,
                    user_id=doc.user_id,
                    chunk_index=chunk_meta.chunk_index,
                    chunk_text=chunk_meta.text,
                    page_number=chunk_meta.page_number,
                    token_count=chunk_meta.token_count,
                    embedding=emb_vec,
                )
                db.add(db_chunk)

            doc.processing_status = "ready"
            doc.chunk_count = len(text_chunks)
            doc.error_message = None
            await db.commit()
            await db.refresh(doc)
            logger.info(f"Document #{doc.id} ('{doc.filename}') successfully processed into {len(text_chunks)} chunks.")

        except Exception as e:
            logger.error(f"Failed to process document #{doc.id}: {e}")
            await db.rollback()

            # Clean up partial chunks on failure
            await db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == doc.id))

            doc.processing_status = "failed"
            doc.error_message = str(e)
            doc.chunk_count = 0
            await db.commit()
            await db.refresh(doc)
            raise e
