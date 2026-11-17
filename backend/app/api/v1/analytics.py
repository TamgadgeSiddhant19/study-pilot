from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.api.deps import get_optional_current_user, get_current_user
from app.models.user import User
from app.models.task import Task
from app.models.session import StudySession
from app.models.leetcode import LeetCodeProblem

router = APIRouter(prefix="/analytics", tags=["Analytics"])


def _calculate_user_streak(real_sessions: dict, today) -> int:
    """Calculate consecutive active study days leading up to today or yesterday."""
    today_str = today.isoformat()
    yesterday_str = (today - timedelta(days=1)).isoformat()

    current_streak = 0
    if real_sessions.get(today_str, 0) > 0:
        current_streak = 1
        offset = 1
        while True:
            d_str = (today - timedelta(days=offset)).isoformat()
            if real_sessions.get(d_str, 0) > 0:
                current_streak += 1
                offset += 1
            else:
                break
    elif real_sessions.get(yesterday_str, 0) > 0:
        current_streak = 1
        offset = 2
        while True:
            d_str = (today - timedelta(days=offset)).isoformat()
            if real_sessions.get(d_str, 0) > 0:
                current_streak += 1
                offset += 1
            else:
                break
    return current_streak


@router.get("/streak")
async def get_user_streak(
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve detailed user active streak, milestone progress, and contribution grid strictly for authenticated user."""
    now = datetime.now(timezone.utc)
    today = now.date()

    # Query real sessions strictly for this user over the past 60 days
    real_sessions = {}
    if current_user:
        sixty_days_ago = now - timedelta(days=60)
        stmt = (
            select(
                func.date(StudySession.created_at).label("session_date"),
                func.sum(StudySession.duration_minutes).label("total_mins")
            )
            .where(
                StudySession.user_id == current_user.id,
                StudySession.created_at >= sixty_days_ago,
                StudySession.completed == True,
                StudySession.session_type.notin_(["short_break", "long_break"]),
            )
            .group_by(func.date(StudySession.created_at))
        )
        rows = (await db.execute(stmt)).all()
        for r in rows:
            real_sessions[str(r.session_date)] = round(r.total_mins / 60.0, 1)

    current_streak = _calculate_user_streak(real_sessions, today)

    # Next milestone progression: 7 -> 14 -> 30 -> 60 -> 90...
    if current_streak < 7:
        next_milestone = 7
    elif current_streak < 14:
        next_milestone = 14
    elif current_streak < 30:
        next_milestone = 30
    else:
        next_milestone = ((current_streak // 30) + 1) * 30

    days_to_milestone = max(0, next_milestone - current_streak)
    milestone_pct = round((current_streak / next_milestone) * 100, 1) if next_milestone > 0 else 0.0

    daily_records = []
    # Generate past 56 days (8 full weeks of 7 days)
    for i in range(55, -1, -1):
        d = today - timedelta(days=i)
        d_str = d.isoformat()
        hours = real_sessions.get(d_str, 0.0)

        daily_records.append({
            "date": d_str,
            "day_name": d.strftime("%a"),
            "day_of_month": d.day,
            "month_name": d.strftime("%b"),
            "hours": hours,
            "active": hours > 0,
            "is_today": i == 0,
        })

    active_days = [r for r in daily_records if r["active"]]
    total_hours = round(sum(r["hours"] for r in daily_records), 1)
    avg_hours = round(total_hours / max(len(active_days), 1), 1) if active_days else 0.0

    return {
        "current_streak": current_streak,
        "next_milestone": next_milestone,
        "days_to_milestone": days_to_milestone,
        "milestone_progress_pct": milestone_pct,
        "total_active_days": len(active_days),
        "total_hours": total_hours,
        "average_daily_hours": avg_hours,
        "daily_records": daily_records,
    }


@router.get("/overview")
async def get_overview_dashboard(
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve genuine real-time dashboard overview metrics strictly for authenticated user."""
    now = datetime.now(timezone.utc)
    today = now.date()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # 1. Profile information scoped to authenticated user
    if current_user:
        candidate_name = current_user.full_name
        target_role = current_user.target_role or "Set your target role"
        target_date = current_user.target_date or "Flexible"
        quota_hours = current_user.daily_flight_quota_hours or 4.0
        user_id = current_user.id
    else:
        candidate_name = "Learner"
        target_role = "Set your target role"
        target_date = "Flexible"
        quota_hours = 4.0
        user_id = None

    # 2. Flight hours today strictly for this user
    real_sessions = {}
    if user_id:
        user_sessions_mins = await db.scalar(
            select(func.coalesce(func.sum(StudySession.duration_minutes), 0))
            .where(
                StudySession.user_id == user_id,
                StudySession.created_at >= today_start,
                StudySession.completed == True,
                StudySession.session_type.notin_(["short_break", "long_break"]),
            )
        ) or 0
        flight_hours = round(user_sessions_mins / 60.0, 1)

        # 3. Tasks / Milestones strictly for this user
        tasks_total = await db.scalar(
            select(func.count(Task.id)).where(Task.user_id == user_id)
        ) or 0
        tasks_done = await db.scalar(
            select(func.count(Task.id)).where(Task.user_id == user_id, Task.completed == True)
        ) or 0

        # Query past 60 days sessions for accurate streak
        sixty_days_ago = now - timedelta(days=60)
        stmt = (
            select(
                func.date(StudySession.created_at).label("session_date"),
                func.sum(StudySession.duration_minutes).label("total_mins")
            )
            .where(
                StudySession.user_id == user_id,
                StudySession.created_at >= sixty_days_ago,
                StudySession.completed == True,
                StudySession.session_type.notin_(["short_break", "long_break"]),
            )
            .group_by(func.date(StudySession.created_at))
        )
        rows = (await db.execute(stmt)).all()
        for r in rows:
            real_sessions[str(r.session_date)] = round(r.total_mins / 60.0, 1)

        streak_days = _calculate_user_streak(real_sessions, today)

        # 5. User-specific LeetCode problems
        total_lc = await db.scalar(
            select(func.count(LeetCodeProblem.id)).where(LeetCodeProblem.user_id == user_id)
        ) or 0
        easy_lc = await db.scalar(
            select(func.count(LeetCodeProblem.id)).where(LeetCodeProblem.user_id == user_id, LeetCodeProblem.difficulty == "Easy")
        ) or 0
        med_lc = await db.scalar(
            select(func.count(LeetCodeProblem.id)).where(LeetCodeProblem.user_id == user_id, LeetCodeProblem.difficulty == "Medium")
        ) or 0
        hard_lc = await db.scalar(
            select(func.count(LeetCodeProblem.id)).where(LeetCodeProblem.user_id == user_id, LeetCodeProblem.difficulty == "Hard")
        ) or 0
        due_srs = await db.scalar(
            select(func.count(LeetCodeProblem.id)).where(LeetCodeProblem.user_id == user_id, LeetCodeProblem.next_review_at <= now)
        ) or 0
    else:
        flight_hours = 0.0
        tasks_total = 0
        tasks_done = 0
        streak_days = 0
        total_lc = 0
        easy_lc = 0
        med_lc = 0
        hard_lc = 0
        due_srs = 0

    milestones_percentage = int((tasks_done / tasks_total * 100)) if tasks_total > 0 else 0

    if tasks_total == 0:
        on_track_percentage = 0
        weekly_velocity_percentage = 0
    else:
        on_track_percentage = min(100, int((milestones_percentage * 0.7) + (min(100, int(flight_hours / max(quota_hours, 1.0) * 100)) * 0.3)))
        weekly_velocity_percentage = milestones_percentage

    return {
        "candidate_name": candidate_name,
        "target_role": target_role,
        "target_date": target_date,
        "days_remaining": 30,
        "on_track_percentage": on_track_percentage,
        "streak_days": streak_days,
        "weekly_velocity_percentage": weekly_velocity_percentage,
        "daily_flight_quota_hours": quota_hours,
        "flight_hours_today": flight_hours,
        "flight_percentage": min(100, int(flight_hours / max(quota_hours, 0.1) * 100)),
        "milestones_completed": tasks_done,
        "milestones_total": tasks_total,
        "milestones_percentage": milestones_percentage,
        "leetcode": {
            "total_solved": total_lc,
            "easy": easy_lc,
            "medium": med_lc,
            "hard": hard_lc,
            "srs_due": due_srs,
        },
    }
