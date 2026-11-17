from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class ResourceBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    url: str = Field(min_length=3, max_length=500)
    category: str = Field(default="documentation", pattern="^(article|documentation|course|video|paper|book)$")
    subject: str = Field(default="General", max_length=100)
    rating: int = Field(default=5, ge=1, le=5)
    notes: Optional[str] = None
    status: str = Field(default="bookmarked", pattern="^(bookmarked|reading|completed)$")


class ResourceCreate(ResourceBase):
    pass


class ResourceUpdate(BaseModel):
    title: Optional[str] = None
    url: Optional[str] = None
    category: Optional[str] = None
    subject: Optional[str] = None
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    notes: Optional[str] = None
    status: Optional[str] = None


class ResourceResponse(ResourceBase):
    id: int
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
