from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class CoachConversation(Base):
    __tablename__ = "coach_conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    title = Column(String(150), default="Study Mentorship")
    track = Column(String(100), default="AI Systems Engineer")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", backref="coach_conversations")
    messages = relationship("CoachMessage", back_populates="conversation", cascade="all, delete-orphan", order_by="CoachMessage.id")


class CoachMessage(Base):
    __tablename__ = "coach_messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("coach_conversations.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), nullable=False)  # user, assistant, system
    content = Column(Text, nullable=False)
    grounding_source = Column(String(200), nullable=True)
    inference_ms = Column(Integer, nullable=True)
    depth = Column(String(50), nullable=True)
    tags = Column(String(200), nullable=True)
    structured_plan = Column(Text, nullable=True)  # JSON string
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    conversation = relationship("CoachConversation", back_populates="messages")


class CoachActionProposal(Base):
    """
    Stores agent-generated write proposals requiring explicit user confirmation before execution.
    Protects against unauthorized, automatic, or altered write operations.
    """
    __tablename__ = "coach_action_proposals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    conversation_id = Column(Integer, ForeignKey("coach_conversations.id", ondelete="CASCADE"), nullable=True, index=True)
    action_type = Column(String(50), nullable=False)  # create_tasks, reschedule_tasks
    status = Column(String(20), default="pending", nullable=False)  # pending, confirmed, rejected, expired
    summary = Column(Text, nullable=False)
    payload = Column(Text, nullable=False)  # JSON encoded list of proposed changes
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime(timezone=True), nullable=False)
    executed_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", backref="coach_proposals")
    conversation = relationship("CoachConversation", backref="action_proposals")
