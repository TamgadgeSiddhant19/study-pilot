from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class TopicBase(BaseModel):
    title: str
    category: str = "Core"
    description: Optional[str] = None
    order_index: int = 0
    status: str = Field(default="not_started", pattern="^(not_started|in_progress|completed|mastered)$")
    mastery_percentage: int = Field(default=0, ge=0, le=100)
    estimated_hours: float = 2.0


class TopicUpdate(BaseModel):
    status: Optional[str] = Field(default=None, pattern="^(not_started|in_progress|completed|mastered)$")
    mastery_percentage: Optional[int] = Field(default=None, ge=0, le=100)


class TopicResponse(TopicBase):
    id: int
    roadmap_id: int
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class RoadmapBase(BaseModel):
    title: str
    slug: str
    description: Optional[str] = None
    category: str = "Engineering"
    icon: str = "account_tree"
    color: str = "#4f46e5"


class RoadmapResponse(RoadmapBase):
    id: int
    created_at: Optional[datetime] = None
    topics: List[TopicResponse] = []

    model_config = ConfigDict(from_attributes=True)
