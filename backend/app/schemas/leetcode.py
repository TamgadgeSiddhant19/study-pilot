from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class LeetCodeBase(BaseModel):
    problem_number: int = Field(ge=1)
    title: str = Field(min_length=1, max_length=200)
    url: Optional[str] = None
    difficulty: str = Field(default="Medium", pattern="^(Easy|Medium|Hard)$")
    topics: str = "General"
    pattern: str = ""
    status: str = Field(default="Solved", pattern="^(Solved|In Progress|Review Needed)$")
    time_complexity: str = "O(N)"
    space_complexity: str = "O(N)"
    notes: Optional[str] = None
    attempts: int = Field(default=1, ge=1)


class LeetCodeCreate(LeetCodeBase):
    pass


class LeetCodeUpdate(BaseModel):
    title: Optional[str] = None
    url: Optional[str] = None
    difficulty: Optional[str] = Field(default=None, pattern="^(Easy|Medium|Hard)$")
    topics: Optional[str] = None
    pattern: Optional[str] = None
    status: Optional[str] = Field(default=None, pattern="^(Solved|In Progress|Review Needed)$")
    time_complexity: Optional[str] = None
    space_complexity: Optional[str] = None
    notes: Optional[str] = None
    attempts: Optional[int] = None


class SRSReviewRequest(BaseModel):
    quality: int = Field(ge=0, le=5, description="0=complete blackout, 3=pass with effort, 5=perfect recall")


class LeetCodeResponse(LeetCodeBase):
    id: int
    last_solved_at: Optional[datetime] = None
    next_review_at: Optional[datetime] = None
    interval_days: int
    repetitions: int
    ease_factor: float
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class LeetCodeStatsResponse(BaseModel):
    total_solved: int
    easy_count: int
    medium_count: int
    hard_count: int
    due_reviews_count: int
    overdue_count: int
