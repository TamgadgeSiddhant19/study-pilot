import json
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_

from app.models.user import User
from app.models.task import Task
from app.models.roadmap import Roadmap, RoadmapTopic, UserTopicProgress
from app.models.leetcode import LeetCodeProblem
from app.models.session import StudySession
from app.models.coach import CoachActionProposal
from app.services.rag.retrieval import RAGRetrievalService


# ---------------------------------------------------------------------------
# Tool Input Schemas
# ---------------------------------------------------------------------------

class UserTasksInput(BaseModel):
    status_filter: Optional[str] = Field(default=None, description="Filter by status: 'todo', 'in_progress', 'completed'")
    priority_filter: Optional[str] = Field(default=None, description="Filter by priority: 'P0', 'P1', 'P2'")
    limit: int = Field(default=10, ge=1, le=50, description="Max number of tasks to return")


class RoadmapProgressInput(BaseModel):
    slug: Optional[str] = Field(default=None, description="Specific roadmap slug, e.g. 'ai-systems' or 'backend'")


class FocusHistoryInput(BaseModel):
    days: int = Field(default=7, ge=1, le=30, description="Number of past days to inspect")


class KnowledgeSearchInput(BaseModel):
    query: str = Field(min_length=2, max_length=500, description="Search query for user study notes")
    top_k: int = Field(default=4, ge=1, le=8, description="Number of passages to retrieve")


class TaskProposalItem(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    subject: str = Field(default="General", max_length=100)
    duration_minutes: int = Field(default=45, ge=5, le=480)
    priority: str = Field(default="P1", pattern="^(P0|P1|P2)$")
    due_date: Optional[str] = Field(default="Upcoming", max_length=50)


class ProposeTasksInput(BaseModel):
    tasks: List[TaskProposalItem] = Field(min_length=1, max_length=10, description="List of proposed study tasks")
    rationale: str = Field(min_length=5, max_length=1000, description="Why these specific tasks are proposed")


class ProposeRescheduleInput(BaseModel):
    task_id: int = Field(description="ID of the task to reschedule")
    new_due_date: str = Field(min_length=2, max_length=50, description="New due date string, e.g. 'Tomorrow', '2026-11-05'")
    new_priority: Optional[str] = Field(default=None, pattern="^(P0|P1|P2)$")
    rationale: str = Field(min_length=5, max_length=500, description="Reason for rescheduling")


# ---------------------------------------------------------------------------
# Service-Wrapping Tool Functions
# All functions strictly enforce authenticated user ownership.
# ---------------------------------------------------------------------------

async def tool_get_user_goals_and_deadlines(user_id: int, db: AsyncSession) -> Dict[str, Any]:
    """Retrieve user's target career role, target interview date, daily flight quota, and experience level."""
    user = await db.get(User, user_id)
    if not user:
        return {"error": "User not found"}

    return {
        "full_name": user.full_name,
        "target_role": user.target_role or "Software / AI Systems Engineer",
        "target_date": user.target_date or "Flexible / Next 3 Months",
        "daily_flight_quota_hours": user.daily_flight_quota_hours or 4.0,
        "learning_stage": user.learning_stage or "Interview Prep",
        "skill_level": getattr(user, "skill_level", "Intermediate") or "Intermediate",
    }


async def tool_get_user_tasks(
    user_id: int,
    db: AsyncSession,
    input_data: Optional[UserTasksInput] = None
) -> Dict[str, Any]:
    """Retrieve pending, overdue, or completed tasks strictly owned by the authenticated user."""
    stmt = select(Task).where(Task.user_id == user_id)
    limit = 10
    if input_data:
        limit = input_data.limit
        if input_data.status_filter:
            stmt = stmt.where(Task.status == input_data.status_filter)
        if input_data.priority_filter:
            stmt = stmt.where(Task.priority == input_data.priority_filter)

    stmt = stmt.order_by(Task.completed.asc(), Task.priority.asc(), Task.id.desc()).limit(limit)
    rows = (await db.execute(stmt)).scalars().all()

    tasks_list = [
        {
            "id": t.id,
            "title": t.title,
            "subject": t.subject,
            "priority": t.priority,
            "status": t.status,
            "completed": t.completed,
            "estimated_minutes": t.estimated_minutes,
            "due_date": t.due_date,
        }
        for t in rows
    ]

    # Also count totals
    total_count = await db.scalar(select(func.count(Task.id)).where(Task.user_id == user_id)) or 0
    completed_count = await db.scalar(
        select(func.count(Task.id)).where(Task.user_id == user_id, Task.completed == True)
    ) or 0

    return {
        "tasks": tasks_list,
        "total_tasks": total_count,
        "completed_tasks": completed_count,
        "pending_tasks_count": total_count - completed_count,
    }


async def tool_get_roadmap_progress(
    user_id: int,
    db: AsyncSession,
    input_data: Optional[RoadmapProgressInput] = None
) -> Dict[str, Any]:
    """Retrieve active roadmaps with the authenticated user's isolated topic mastery percentages."""
    stmt = select(Roadmap)
    if input_data and input_data.slug:
        stmt = stmt.where(Roadmap.slug == input_data.slug)

    roadmaps = (await db.execute(stmt)).scalars().all()
    if not roadmaps:
        return {"roadmaps": [], "summary": "No roadmaps available"}

    # Fetch user's individual progress
    prog_stmt = select(UserTopicProgress).where(UserTopicProgress.user_id == user_id)
    user_progress_rows = (await db.execute(prog_stmt)).scalars().all()
    user_progress_map = {p.topic_id: p for p in user_progress_rows}

    results = []
    for r in roadmaps:
        topics_stmt = select(RoadmapTopic).where(RoadmapTopic.roadmap_id == r.id).order_by(RoadmapTopic.order_index)
        topics = (await db.execute(topics_stmt)).scalars().all()

        topic_summaries = []
        mastered_count = 0
        in_progress_count = 0

        for t in topics:
            up = user_progress_map.get(t.id)
            status = up.status if up else "not_started"
            pct = up.mastery_percentage if up else 0
            if status == "mastered" or pct >= 90:
                mastered_count += 1
            elif status == "in_progress" or pct > 0:
                in_progress_count += 1

            topic_summaries.append({
                "id": t.id,
                "title": t.title,
                "category": t.category,
                "status": status,
                "mastery_percentage": pct,
            })

        total = len(topics)
        overall_pct = int((mastered_count / total * 100)) if total > 0 else 0
        results.append({
            "id": r.id,
            "title": r.title,
            "slug": r.slug,
            "category": r.category,
            "total_topics": total,
            "mastered_topics": mastered_count,
            "in_progress_topics": in_progress_count,
            "overall_mastery_pct": overall_pct,
            "topics": topic_summaries[:8],  # preview top topics
        })

    return {"roadmaps": results}


async def tool_get_leetcode_summary(user_id: int, db: AsyncSession) -> Dict[str, Any]:
    """Retrieve authenticated user's LeetCode practice count, SRS due reviews, and difficulty distribution."""
    now = datetime.now(timezone.utc)

    # Total solved
    solved_stmt = select(LeetCodeProblem).where(
        LeetCodeProblem.user_id == user_id,
        LeetCodeProblem.status == "Solved"
    )
    problems = (await db.execute(solved_stmt)).scalars().all()

    easy = sum(1 for p in problems if p.difficulty.lower() == "easy")
    medium = sum(1 for p in problems if p.difficulty.lower() == "medium")
    hard = sum(1 for p in problems if p.difficulty.lower() == "hard")

    # Due for review
    due_stmt = select(LeetCodeProblem).where(
        LeetCodeProblem.user_id == user_id,
        LeetCodeProblem.next_review_at <= now
    ).order_by(LeetCodeProblem.next_review_at.asc()).limit(5)
    due_problems = (await db.execute(due_stmt)).scalars().all()

    due_list = [
        {
            "id": p.id,
            "problem_number": p.problem_number,
            "title": p.title,
            "difficulty": p.difficulty,
            "pattern": p.pattern,
            "next_review_at": p.next_review_at.isoformat() if p.next_review_at else None,
        }
        for p in due_problems
    ]

    return {
        "total_solved": len(problems),
        "difficulty_breakdown": {"easy": easy, "medium": medium, "hard": hard},
        "due_reviews_count": len(due_problems),
        "due_reviews_preview": due_list,
    }


async def tool_get_focus_history(
    user_id: int,
    db: AsyncSession,
    input_data: Optional[FocusHistoryInput] = None
) -> Dict[str, Any]:
    """Retrieve study session history and focus minutes strictly for the authenticated user."""
    days = input_data.days if input_data else 7
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    # Total minutes today
    today_mins = await db.scalar(
        select(func.coalesce(func.sum(StudySession.duration_minutes), 0))
        .where(StudySession.user_id == user_id, StudySession.created_at >= today_start)
    ) or 0

    # Total sessions in window
    window_stmt = (
        select(StudySession)
        .where(StudySession.user_id == user_id, StudySession.created_at >= cutoff)
        .order_by(StudySession.created_at.desc())
        .limit(10)
    )
    sessions = (await db.execute(window_stmt)).scalars().all()
    total_window_mins = sum(s.duration_minutes for s in sessions)

    return {
        "minutes_today": today_mins,
        "hours_today": round(today_mins / 60.0, 1),
        f"total_minutes_last_{days}_days": total_window_mins,
        f"total_hours_last_{days}_days": round(total_window_mins / 60.0, 1),
        "recent_sessions_count": len(sessions),
    }


async def tool_search_user_knowledge(
    user_id: int,
    db: AsyncSession,
    input_data: KnowledgeSearchInput
) -> Dict[str, Any]:
    """Perform authorized semantic similarity search over the authenticated user's uploaded documents."""
    chunks = await RAGRetrievalService.retrieve_relevant_chunks(
        query=input_data.query,
        user_id=user_id,
        db=db,
        top_k=input_data.top_k,
    )

    results = []
    for c in chunks:
        results.append({
            "chunk_id": c.chunk_id,
            "document_id": c.document_id,
            "document_title": c.document_title,
            "page_number": c.page_number,
            "section": c.section,
            "similarity_score": round(c.similarity_score, 3),
            "snippet": c.chunk_text[:350].strip(),
        })

    return {
        "query": input_data.query,
        "total_found": len(results),
        "results": results,
    }


async def tool_recommend_study_topics(user_id: int, db: AsyncSession) -> Dict[str, Any]:
    """Synthesizes weaknesses across overdue LeetCode reviews, incomplete roadmap topics, and pending tasks."""
    now = datetime.now(timezone.utc)

    # 1. Overdue LeetCode problems
    due_lc_stmt = select(LeetCodeProblem).where(
        LeetCodeProblem.user_id == user_id,
        LeetCodeProblem.next_review_at <= now
    ).limit(3)
    due_lc = (await db.execute(due_lc_stmt)).scalars().all()

    # 2. In-progress or next unstarted roadmap topic
    up_stmt = select(UserTopicProgress).where(
        UserTopicProgress.user_id == user_id,
        UserTopicProgress.status == "in_progress"
    ).limit(2)
    in_prog = (await db.execute(up_stmt)).scalars().all()
    in_prog_topic_ids = [p.topic_id for p in in_prog]

    in_prog_topics = []
    if in_prog_topic_ids:
        t_stmt = select(RoadmapTopic).where(RoadmapTopic.id.in_(in_prog_topic_ids))
        in_prog_topics = (await db.execute(t_stmt)).scalars().all()

    # 3. High-priority incomplete tasks
    p0_stmt = select(Task).where(
        Task.user_id == user_id,
        Task.completed == False,
        Task.priority == "P0"
    ).limit(2)
    p0_tasks = (await db.execute(p0_stmt)).scalars().all()

    recommendations = []
    if p0_tasks:
        for t in p0_tasks:
            recommendations.append(f"Complete urgent task: '{t.title}' ({t.subject}, est {t.estimated_minutes}m)")
    if due_lc:
        for lc in due_lc:
            recommendations.append(f"Spaced repetition revision: LeetCode #{lc.problem_number} '{lc.title}' ({lc.difficulty})")
    if in_prog_topics:
        for top in in_prog_topics:
            recommendations.append(f"Advance roadmap milestone: '{top.title}' in {top.category}")

    if not recommendations:
        recommendations.append("All scheduled tasks and reviews are currently up to date. Ready to explore new roadmap topics or deep work.")

    return {
        "evidence_based_recommendations": recommendations,
        "overdue_reviews_count": len(due_lc),
        "in_progress_milestones_count": len(in_prog_topics),
        "urgent_tasks_count": len(p0_tasks),
    }


# ---------------------------------------------------------------------------
# Write Tools (Proposal Generation)
# Do NOT mutate active records directly. Generates a persisted CoachActionProposal
# requiring explicit authenticated confirmation from the user.
# ---------------------------------------------------------------------------

async def tool_propose_study_tasks(
    user_id: int,
    db: AsyncSession,
    conversation_id: Optional[int],
    input_data: ProposeTasksInput,
) -> Dict[str, Any]:
    """Generates a structured task proposal requiring explicit user confirmation before creation."""
    payload = [t.model_dump() for t in input_data.tasks]
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=2)

    summary = f"Propose creating {len(payload)} task(s): " + ", ".join(t['title'] for t in payload[:3])
    if len(payload) > 3:
        summary += f" and {len(payload) - 3} more."

    proposal = CoachActionProposal(
        user_id=user_id,
        conversation_id=conversation_id,
        action_type="create_tasks",
        status="pending",
        summary=summary,
        payload=json.dumps({"tasks": payload, "rationale": input_data.rationale}),
        expires_at=expires_at,
    )
    db.add(proposal)
    await db.commit()
    await db.refresh(proposal)

    return {
        "proposal_id": proposal.id,
        "action_type": proposal.action_type,
        "status": "pending_confirmation",
        "summary": summary,
        "rationale": input_data.rationale,
        "proposed_tasks": payload,
        "expires_in_hours": 2,
        "confirmation_required": True,
    }


async def tool_propose_task_reschedule(
    user_id: int,
    db: AsyncSession,
    conversation_id: Optional[int],
    input_data: ProposeRescheduleInput,
) -> Dict[str, Any]:
    """Generates a task reschedule proposal requiring explicit user confirmation before modifying task."""
    task = await db.get(Task, input_data.task_id)
    if not task or task.user_id != user_id:
        return {"error": f"Task #{input_data.task_id} not found or permission denied"}

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=2)
    summary = f"Reschedule Task #{task.id} ('{task.title}') to '{input_data.new_due_date}'"
    if input_data.new_priority:
        summary += f" with priority '{input_data.new_priority}'"

    payload_data = {
        "task_id": task.id,
        "task_title": task.title,
        "current_due_date": task.due_date,
        "new_due_date": input_data.new_due_date,
        "current_priority": task.priority,
        "new_priority": input_data.new_priority or task.priority,
        "rationale": input_data.rationale,
    }

    proposal = CoachActionProposal(
        user_id=user_id,
        conversation_id=conversation_id,
        action_type="reschedule_task",
        status="pending",
        summary=summary,
        payload=json.dumps(payload_data),
        expires_at=expires_at,
    )
    db.add(proposal)
    await db.commit()
    await db.refresh(proposal)

    return {
        "proposal_id": proposal.id,
        "action_type": proposal.action_type,
        "status": "pending_confirmation",
        "summary": summary,
        "details": payload_data,
        "confirmation_required": True,
    }

