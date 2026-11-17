from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class LearningResource(Base):
    __tablename__ = "learning_resources"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    title = Column(String(200), nullable=False)
    url = Column(String(500), nullable=False)
    category = Column(String(50), default="documentation")  # article, documentation, course, video, paper, book
    subject = Column(String(100), default="General")
    rating = Column(Integer, default=5)
    notes = Column(Text, nullable=True)
    status = Column(String(30), default="bookmarked")  # bookmarked, reading, completed
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", backref="resources")
