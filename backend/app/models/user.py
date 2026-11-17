from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)

    # Account type: "student" or "professional"
    account_type = Column(String(50), nullable=False, default="student", index=True)

    # Student specific optional fields
    education_level = Column(String(100), nullable=True)
    institution = Column(String(200), nullable=True)
    learning_stage = Column(String(100), nullable=True)

    # Working Professional specific optional fields
    current_role = Column(String(100), nullable=True)
    experience_range = Column(String(50), nullable=True)
    skill_level = Column(String(50), nullable=True)

    # Study targets & preferences
    target_role = Column(String(100), nullable=True)
    target_date = Column(String(50), nullable=True)
    daily_flight_quota_hours = Column(Float, default=4.0)

    # Onboarding and account status
    is_onboarded = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Compatibility property for any legacy code referencing `user.name`
    @property
    def name(self) -> str:
        return self.full_name

    @name.setter
    def name(self, val: str):
        self.full_name = val

    # Relationships
    tasks = relationship("Task", back_populates="user", cascade="all, delete-orphan")
