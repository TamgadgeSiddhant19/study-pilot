from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class SessionCreate(BaseModel):
    task_id: Optional[int] = None
    subject: str = Field(default="General Study", max_length=100)
    duration_minutes: int = Field(default=25, ge=1, le=240)
    session_type: str = Field(default="pomodoro", pattern="^(pomodoro|focus|deep_work|review|short_break|long_break)$")
    completed: bool = True
    notes: Optional[str] = None


class SessionResponse(SessionCreate):
    id: int
    completed: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FocusStatsResponse(BaseModel):
    total_minutes_today: int
    total_sessions_today: int
    weekly_hours: float
    current_streak_days: int
