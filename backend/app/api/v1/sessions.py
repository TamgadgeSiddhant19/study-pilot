from typing import List, Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.session import StudySession
from app.models.task import Task
from app.schemas.session import SessionCreate, SessionResponse, FocusStatsResponse

router = APIRouter(prefix="/sessions", tags=["Focus Sessions"])


@router.get("", response_model=List[SessionResponse])
async def list_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List study focus sessions strictly belonging to the authenticated user."""
    stmt = (
        select(StudySession)
        .where(StudySession.user_id == current_user.id)
        .order_by(StudySession.created_at.desc())
        .limit(50)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def log_session(
    session_in: SessionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Log a focus study session scoped to the authenticated user."""
    session_data = session_in.model_dump()
    task_id = session_data.get("task_id")

    # If task_id is provided, verify it belongs strictly to this user
    if task_id:
        task = await db.get(Task, task_id)
        if not task or task.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Task with ID {task_id} not found",
            )
        if session_data.get("completed", True) and session_data.get("session_type") not in ("short_break", "long_break"):
            task.actual_minutes = (task.actual_minutes or 0) + session_data["duration_minutes"]

    session = StudySession(
        **session_data,
        user_id=current_user.id,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


@router.get("/stats", response_model=FocusStatsResponse)
async def get_focus_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve real focus session statistics strictly for the authenticated user."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=now.weekday())

    # Today's focus minutes for this user (only completed focus sessions, excluding breaks)
    today_mins = await db.scalar(
        select(func.coalesce(func.sum(StudySession.duration_minutes), 0))
        .where(
            StudySession.user_id == current_user.id,
            StudySession.created_at >= today_start,
            StudySession.completed == True,
            StudySession.session_type.notin_(["short_break", "long_break"]),
        )
    ) or 0

    # Today's session count for this user
    today_count = await db.scalar(
        select(func.count(StudySession.id))
        .where(
            StudySession.user_id == current_user.id,
            StudySession.created_at >= today_start,
            StudySession.completed == True,
            StudySession.session_type.notin_(["short_break", "long_break"]),
        )
    ) or 0

    # Weekly focus minutes for this user
    week_mins = await db.scalar(
        select(func.coalesce(func.sum(StudySession.duration_minutes), 0))
        .where(
            StudySession.user_id == current_user.id,
            StudySession.created_at >= week_start,
            StudySession.completed == True,
            StudySession.session_type.notin_(["short_break", "long_break"]),
        )
    ) or 0

    # Calculate active streak days from user's sessions in the last 30 days
    past_month = today_start - timedelta(days=30)
    distinct_dates_res = await db.execute(
        select(func.date(StudySession.created_at))
        .where(
            StudySession.user_id == current_user.id,
            StudySession.created_at >= past_month,
            StudySession.completed == True,
            StudySession.session_type.notin_(["short_break", "long_break"]),
        )
        .distinct()
    )
    active_dates = {r[0] for r in distinct_dates_res.fetchall()}
    today_date = today_start.date()

    streak = 0
    check_date = today_date
    if check_date in active_dates:
        streak += 1
        check_date -= timedelta(days=1)
        while check_date in active_dates:
            streak += 1
            check_date -= timedelta(days=1)
    elif (check_date - timedelta(days=1)) in active_dates:
        check_date -= timedelta(days=1)
        while check_date in active_dates:
            streak += 1
            check_date -= timedelta(days=1)

    return FocusStatsResponse(
        total_minutes_today=int(today_mins),
        total_sessions_today=int(today_count),
        weekly_hours=round(float(week_mins) / 60.0, 1),
        current_streak_days=streak,
    )
