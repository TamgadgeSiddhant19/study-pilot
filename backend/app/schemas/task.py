from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class TaskBase(BaseModel):
    title: str = Field(min_length=1, max_length=200, description="Task title cannot be empty")
    subject: str = Field(default="General", max_length=100)
    description: Optional[str] = Field(default=None, max_length=2000)
    priority: str = Field(default="P1", pattern="^(P0|P1|P2)$", description="Priority must be P0, P1, or P2")
    status: str = Field(default="todo", pattern="^(todo|in_progress|completed)$")
    estimated_minutes: int = Field(default=30, ge=1, le=1440, description="Estimated duration in minutes (1 - 1440)")
    due_date: Optional[str] = Field(default=None, max_length=50)
    roadmap_topic_id: Optional[int] = None
    user_id: Optional[int] = None


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    subject: Optional[str] = Field(default=None, max_length=100)
    description: Optional[str] = Field(default=None, max_length=2000)
    priority: Optional[str] = Field(default=None, pattern="^(P0|P1|P2)$")
    status: Optional[str] = Field(default=None, pattern="^(todo|in_progress|completed)$")
    completed: Optional[bool] = None
    estimated_minutes: Optional[int] = Field(default=None, ge=1, le=1440)
    actual_minutes: Optional[int] = Field(default=None, ge=0)
    due_date: Optional[str] = Field(default=None, max_length=50)
    roadmap_topic_id: Optional[int] = None
    user_id: Optional[int] = None


class TaskResponse(TaskBase):
    id: int
    completed: bool
    actual_minutes: int
    completed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
