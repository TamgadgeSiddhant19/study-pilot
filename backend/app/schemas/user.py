from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class UserBase(BaseModel):
    email: str = Field(description="Normalized email address")
    full_name: str
    account_type: str = "student"
    target_role: Optional[str] = "AI Systems Engineer"
    target_date: Optional[str] = "Nov 15"
    daily_flight_quota_hours: Optional[float] = 4.0


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    full_name: Optional[str] = None
    target_role: Optional[str] = None
    target_date: Optional[str] = None
    daily_flight_quota_hours: Optional[float] = None
    is_active: Optional[bool] = None
    education_level: Optional[str] = None
    institution: Optional[str] = None
    learning_stage: Optional[str] = None
    current_role: Optional[str] = None
    experience_range: Optional[str] = None
    skill_level: Optional[str] = None
    is_onboarded: Optional[bool] = None


class UserResponse(UserBase):
    id: int
    name: Optional[str] = None
    is_active: bool
    is_onboarded: bool = False
    education_level: Optional[str] = None
    institution: Optional[str] = None
    learning_stage: Optional[str] = None
    current_role: Optional[str] = None
    experience_range: Optional[str] = None
    skill_level: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
