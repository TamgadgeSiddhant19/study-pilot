from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class DocumentResponse(BaseModel):
    id: int
    user_id: int
    filename: str
    content_type: str
    file_size_bytes: int
    processing_status: str
    error_message: Optional[str] = None
    chunk_count: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentListResponse(BaseModel):
    documents: List[DocumentResponse]
    total: int


class RAGSearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=1000, description="Query string to search user study materials")
    top_k: int = Field(default=4, ge=1, le=20)
    similarity_threshold: Optional[float] = Field(default=0.70, ge=0.0, le=2.0)


class RAGSearchResultItem(BaseModel):
    chunk_id: int
    document_id: int
    document_title: str
    chunk_text: str
    page_number: Optional[int] = None
    section: Optional[str] = None
    similarity_score: float
    distance: float


class RAGSearchResponse(BaseModel):
    query: str
    results: List[RAGSearchResultItem]
    total_found: int


class DocumentChunkPreview(BaseModel):
    id: int
    chunk_index: int
    page_number: Optional[int] = None
    section: Optional[str] = None
    chunk_text: str


class DocumentPreviewResponse(BaseModel):
    document_id: int
    filename: str
    content_type: str
    processing_status: str
    chunk_count: int
    chunks: List[DocumentChunkPreview]
    total_chunks: int
