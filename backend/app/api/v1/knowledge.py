from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.document import Document, DocumentChunk
from app.schemas.knowledge import (
    DocumentResponse,
    DocumentListResponse,
    DocumentPreviewResponse,
    DocumentChunkPreview,
    RAGSearchRequest,
    RAGSearchResponse,
    RAGSearchResultItem,
)
from app.services.rag.ingestion import DocumentIngestionService
from app.services.rag.retrieval import RAGRetrievalService, extract_section_heading

router = APIRouter(prefix="/knowledge", tags=["RAG Knowledge Base"])


@router.post("/documents", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload and ingest a study document (PDF, Markdown, or Text).
    Validates file integrity, extracts text, generates embeddings, and indexes chunks into pgvector.
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must have a valid filename.",
        )

    try:
        content = await file.read()
        content_type = file.content_type or "application/octet-stream"
        doc = await DocumentIngestionService.ingest_document(
            user_id=current_user.id,
            filename=file.filename,
            content_type=content_type,
            file_bytes=content,
            db=db,
        )
        return doc
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to ingest document: {str(e)}",
        )


@router.get("/documents", response_model=DocumentListResponse)
async def list_documents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all uploaded learning documents belonging to the authenticated user."""
    stmt = (
        select(Document)
        .where(Document.user_id == current_user.id)
        .order_by(Document.created_at.desc())
    )
    docs = (await db.execute(stmt)).scalars().all()
    return DocumentListResponse(documents=list(docs), total=len(docs))


@router.get("/documents/{document_id}", response_model=DocumentResponse)
async def get_document_details(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve metadata, processing status, and chunk count for a document."""
    doc = await db.get(Document, document_id)
    if not doc or doc.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document #{document_id} not found.",
        )
    return doc


@router.get("/documents/{document_id}/preview", response_model=DocumentPreviewResponse)
async def preview_document(
    document_id: int,
    limit: int = 10,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns document metadata and its indexed text chunks for interactive preview and verification.
    Scoped strictly to the authenticated user.
    """
    doc = await db.get(Document, document_id)
    if not doc or doc.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document #{document_id} not found.",
        )

    stmt = (
        select(DocumentChunk)
        .where(DocumentChunk.document_id == document_id, DocumentChunk.user_id == current_user.id)
        .order_by(DocumentChunk.chunk_index.asc())
        .limit(limit)
    )
    chunks = (await db.execute(stmt)).scalars().all()
    chunk_previews = [
        DocumentChunkPreview(
            id=c.id,
            chunk_index=c.chunk_index,
            page_number=c.page_number,
            section=extract_section_heading(c.chunk_text),
            chunk_text=c.chunk_text,
        )
        for c in chunks
    ]
    return DocumentPreviewResponse(
        document_id=doc.id,
        filename=doc.filename,
        content_type=doc.content_type,
        processing_status=doc.processing_status,
        chunk_count=doc.chunk_count,
        chunks=chunk_previews,
        total_chunks=len(chunk_previews),
    )


@router.delete("/documents/{document_id}", status_code=status.HTTP_200_OK)
async def delete_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Deletes document, stored physical file, chunks, and vector embeddings."""
    success = await DocumentIngestionService.delete_document(
        document_id=document_id,
        user_id=current_user.id,
        db=db,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document #{document_id} not found or permission denied.",
        )
    return {"status": "success", "message": f"Document #{document_id} deleted successfully."}


@router.post("/documents/{document_id}/reprocess", response_model=DocumentResponse)
async def reprocess_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Safely retries extraction, chunking, and embedding generation for an existing document."""
    try:
        doc = await DocumentIngestionService.reprocess_document(
            document_id=document_id,
            user_id=current_user.id,
            db=db,
        )
        return doc
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Reprocessing failed: {str(e)}",
        )


@router.post("/search", response_model=RAGSearchResponse)
async def search_learning_materials(
    req: RAGSearchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Semantic similarity search across the authenticated user's indexed learning materials.
    Returns matched passages, source document titles, page numbers, and similarity metrics.
    """
    try:
        chunks = await RAGRetrievalService.retrieve_relevant_chunks(
            query=req.query,
            user_id=current_user.id,
            db=db,
            top_k=req.top_k,
            similarity_threshold=req.similarity_threshold,
        )
        items = [
            RAGSearchResultItem(
                chunk_id=c.chunk_id,
                document_id=c.document_id,
                document_title=c.document_title,
                chunk_text=c.chunk_text,
                page_number=c.page_number,
                section=c.section,
                similarity_score=c.similarity_score,
                distance=c.distance,
            )
            for c in chunks
        ]
        return RAGSearchResponse(query=req.query, results=items, total_found=len(items))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Semantic retrieval failed: {str(e)}",
        )
