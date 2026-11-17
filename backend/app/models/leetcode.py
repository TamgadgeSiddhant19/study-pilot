from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class LeetCodeProblem(Base):
    __tablename__ = "leetcode_problems"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    problem_number = Column(Integer, index=True, nullable=False)
    title = Column(String(200), nullable=False)
    url = Column(String(300), nullable=True)
    difficulty = Column(String(20), nullable=False, default="Medium")  # Easy, Medium, Hard
    topics = Column(String(250), default="")  # e.g., "Graphs, Topo Sort"
    pattern = Column(String(100), default="") # e.g., "DFS / BFS Cycle Detection"
    status = Column(String(30), default="Solved")  # Solved, In Progress, Review Needed
    time_complexity = Column(String(50), default="O(N)")
    space_complexity = Column(String(50), default="O(N)")
    notes = Column(Text, nullable=True)
    attempts = Column(Integer, default=1)
    
    # Spaced Repetition (SM-2 parameters)
    last_solved_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    next_review_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    interval_days = Column(Integer, default=1)
    repetitions = Column(Integer, default=1)
    ease_factor = Column(Float, default=2.5)
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", backref="leetcode_problems")
