from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128, description="Password must be at least 8 characters")
    full_name: str = Field(min_length=2, max_length=100, description="Full name of user")
    account_type: Literal["student", "professional"] = "student"
    
    # Optional onboarding fields during registration if provided
    education_level: Optional[str] = None
    institution: Optional[str] = None
    learning_stage: Optional[str] = None
    
    current_role: Optional[str] = None
    experience_range: Optional[str] = None
    skill_level: Optional[str] = None

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("full_name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        cleaned = v.strip()
        if len(cleaned) < 2:
            raise ValueError("Full name must be at least 2 characters")
        return cleaned


class UserLogin(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    account_type: Optional[Literal["student", "professional"]] = None
    
    # Student fields
    education_level: Optional[str] = None
    institution: Optional[str] = None
    learning_stage: Optional[str] = None
    
    # Professional fields
    current_role: Optional[str] = None
    experience_range: Optional[str] = None
    skill_level: Optional[str] = None
    
    # Study goals
    target_role: Optional[str] = None
    target_date: Optional[str] = None
    daily_flight_quota_hours: Optional[float] = None
    is_onboarded: Optional[bool] = None

    @field_validator("full_name")
    @classmethod
    def clean_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            cleaned = v.strip()
            if len(cleaned) < 2:
                raise ValueError("Full name must be at least 2 characters")
            return cleaned
        return v


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    account_type: str
    
    # Student fields
    education_level: Optional[str] = None
    institution: Optional[str] = None
    learning_stage: Optional[str] = None
    
    # Professional fields
    current_role: Optional[str] = None
    experience_range: Optional[str] = None
    skill_level: Optional[str] = None
    
    # Study target fields
    target_role: Optional[str] = "AI Systems Engineer"
    target_date: Optional[str] = "Nov 15"
    daily_flight_quota_hours: Optional[float] = 4.0
    
    is_onboarded: bool = False
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    # Legacy compatibility attribute
    name: Optional[str] = None
    csrf_token: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    csrf_token: str
    user: UserResponse
