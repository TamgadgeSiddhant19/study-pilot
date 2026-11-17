from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    subject = Column(String(100), nullable=False, default="General")
    description = Column(Text, nullable=True)
    priority = Column(String(10), nullable=False, default="P1")  # P0, P1, P2
    status = Column(String(20), nullable=False, default="todo")   # todo, in_progress, completed
    completed = Column(Boolean, default=False)
    estimated_minutes = Column(Integer, default=30)
    actual_minutes = Column(Integer, default=0)
    due_date = Column(String(20), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    order_index = Column(Integer, default=0)
    roadmap_topic_id = Column(Integer, ForeignKey("roadmap_topics.id", ondelete="SET NULL"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    roadmap_topic = relationship("RoadmapTopic", back_populates="tasks")
    user = relationship("User", back_populates="tasks")
    sessions = relationship("StudySession", back_populates="task", cascade="all, delete-orphan")
