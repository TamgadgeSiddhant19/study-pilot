from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base


class Roadmap(Base):
    __tablename__ = "roadmaps"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(100), nullable=False)
    slug = Column(String(50), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), default="Engineering")
    icon = Column(String(50), default="account_tree")
    color = Column(String(20), default="#4f46e5")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    topics = relationship("RoadmapTopic", back_populates="roadmap", cascade="all, delete-orphan", order_by="RoadmapTopic.order_index")


class RoadmapTopic(Base):
    __tablename__ = "roadmap_topics"

    id = Column(Integer, primary_key=True, index=True)
    roadmap_id = Column(Integer, ForeignKey("roadmaps.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(150), nullable=False)
    category = Column(String(100), default="Core")
    description = Column(Text, nullable=True)
    order_index = Column(Integer, default=0)
    status = Column(String(20), default="not_started")  # Default template status: not_started, in_progress, completed, mastered
    mastery_percentage = Column(Integer, default=0)      # Default template mastery: 0 to 100
    estimated_hours = Column(Float, default=2.0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    roadmap = relationship("Roadmap", back_populates="topics")
    tasks = relationship("Task", back_populates="roadmap_topic")
    user_progress = relationship("UserTopicProgress", back_populates="topic", cascade="all, delete-orphan")


class UserTopicProgress(Base):
    """Stores user-specific progress and mastery on a roadmap topic."""
    __tablename__ = "user_topic_progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    topic_id = Column(Integer, ForeignKey("roadmap_topics.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(20), default="not_started", nullable=False)  # not_started, in_progress, completed, mastered
    mastery_percentage = Column(Integer, default=0, nullable=False)      # 0 to 100
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("user_id", "topic_id", name="uq_user_topic_progress"),
    )

    user = relationship("User", backref="topic_progress")
    topic = relationship("RoadmapTopic", back_populates="user_progress")
