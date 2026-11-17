from typing import List, Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.leetcode import LeetCodeProblem
from app.schemas.leetcode import (
    LeetCodeCreate,
    LeetCodeUpdate,
    LeetCodeResponse,
    SRSReviewRequest,
    LeetCodeStatsResponse
)
from app.services.srs_engine import calculate_sm2

router = APIRouter(prefix="/leetcode", tags=["LeetCode Tracker"])


@router.get("", response_model=List[LeetCodeResponse])
async def list_problems(
    difficulty: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    srs_due_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List LeetCode problems tracked by the authenticated user."""
    query = (
        select(LeetCodeProblem)
        .where(LeetCodeProblem.user_id == current_user.id)
        .order_by(LeetCodeProblem.problem_number)
    )
    
    if difficulty:
        query = query.where(LeetCodeProblem.difficulty == difficulty)
    if status_filter:
        query = query.where(LeetCodeProblem.status == status_filter)
    if srs_due_only:
        now = datetime.now(timezone.utc)
        query = query.where(LeetCodeProblem.next_review_at <= now)

    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=LeetCodeResponse, status_code=status.HTTP_201_CREATED)
async def log_problem(
    problem_in: LeetCodeCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Log a solved problem for the authenticated user with initial SM-2 SRS schedule."""
    # Check if this problem is already tracked by this user (upsert)
    stmt = select(LeetCodeProblem).where(
        LeetCodeProblem.user_id == current_user.id,
        LeetCodeProblem.problem_number == problem_in.problem_number,
    )
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        for field, val in problem_in.model_dump(exclude_unset=True).items():
            setattr(existing, field, val)
        existing.status = "Solved"
        existing.last_solved_at = datetime.now(timezone.utc)
        existing.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(existing)
        return existing

    reps, interval, ef, next_review = calculate_sm2(
        quality=4, repetitions=0, ease_factor=2.5, interval_days=1
    )
    
    problem = LeetCodeProblem(
        **problem_in.model_dump(),
        user_id=current_user.id,
        repetitions=reps,
        interval_days=interval,
        ease_factor=ef,
        next_review_at=next_review,
        last_solved_at=datetime.now(timezone.utc)
    )
    db.add(problem)
    await db.commit()
    await db.refresh(problem)
    return problem


@router.post("/toggle")
async def toggle_problem_status(
    problem_in: LeetCodeCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Toggle a LeetCode problem between solved and deleted/unsolved for curated sheets."""
    stmt = select(LeetCodeProblem).where(
        LeetCodeProblem.user_id == current_user.id,
        LeetCodeProblem.problem_number == problem_in.problem_number,
    )
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        problem_id = existing.id
        await db.delete(existing)
        await db.commit()
        return {
            "problem_number": problem_in.problem_number,
            "solved": False,
            "id": problem_id,
        }
    else:
        reps, interval, ef, next_review = calculate_sm2(
            quality=4, repetitions=0, ease_factor=2.5, interval_days=1
        )
        problem = LeetCodeProblem(
            **problem_in.model_dump(),
            user_id=current_user.id,
            repetitions=reps,
            interval_days=interval,
            ease_factor=ef,
            next_review_at=next_review,
            last_solved_at=datetime.now(timezone.utc),
            status="Solved",
        )
        db.add(problem)
        await db.commit()
        await db.refresh(problem)
        return {
            "problem_number": problem.problem_number,
            "solved": True,
            "id": problem.id,
        }


@router.get("/stats", response_model=LeetCodeStatsResponse)
async def get_leetcode_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve LeetCode mastery and spaced repetition stats strictly for the authenticated user."""
    uid = current_user.id
    total = await db.scalar(select(func.count(LeetCodeProblem.id)).where(LeetCodeProblem.user_id == uid)) or 0
    easy = await db.scalar(select(func.count(LeetCodeProblem.id)).where(LeetCodeProblem.user_id == uid, LeetCodeProblem.difficulty == "Easy")) or 0
    med = await db.scalar(select(func.count(LeetCodeProblem.id)).where(LeetCodeProblem.user_id == uid, LeetCodeProblem.difficulty == "Medium")) or 0
    hard = await db.scalar(select(func.count(LeetCodeProblem.id)).where(LeetCodeProblem.user_id == uid, LeetCodeProblem.difficulty == "Hard")) or 0

    now = datetime.now(timezone.utc)
    due_reviews = await db.scalar(
        select(func.count(LeetCodeProblem.id)).where(LeetCodeProblem.user_id == uid, LeetCodeProblem.next_review_at <= now)
    ) or 0
    one_day_ago = now - timedelta(days=1)
    overdue_count = await db.scalar(
        select(func.count(LeetCodeProblem.id)).where(LeetCodeProblem.user_id == uid, LeetCodeProblem.next_review_at <= one_day_ago)
    ) or 0

    return LeetCodeStatsResponse(
        total_solved=total,
        easy_count=easy,
        medium_count=med,
        hard_count=hard,
        due_reviews_count=due_reviews,
        overdue_count=overdue_count
    )


@router.patch("/{problem_id}", response_model=LeetCodeResponse)
async def update_problem(
    problem_id: int,
    problem_in: LeetCodeUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a LeetCode problem record owned by the authenticated user."""
    stmt = select(LeetCodeProblem).where(
        LeetCodeProblem.id == problem_id,
        LeetCodeProblem.user_id == current_user.id,
    )
    problem = (await db.execute(stmt)).scalar_one_or_none()
    if not problem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found")

    update_data = problem_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(problem, field, val)

    problem.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(problem)
    return problem


@router.post("/{problem_id}/review", response_model=LeetCodeResponse)
async def review_problem(
    problem_id: int,
    review_in: SRSReviewRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Apply SM-2 spaced repetition update after authenticated user re-solves their problem."""
    stmt = select(LeetCodeProblem).where(
        LeetCodeProblem.id == problem_id,
        LeetCodeProblem.user_id == current_user.id,
    )
    problem = (await db.execute(stmt)).scalar_one_or_none()
    if not problem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found")

    new_reps, new_interval, new_ef, next_rev = calculate_sm2(
        quality=review_in.quality,
        repetitions=problem.repetitions,
        ease_factor=problem.ease_factor,
        interval_days=problem.interval_days
    )

    problem.repetitions = new_reps
    problem.interval_days = new_interval
    problem.ease_factor = new_ef
    problem.next_review_at = next_rev
    problem.last_solved_at = datetime.now(timezone.utc)
    problem.status = "Solved" if review_in.quality >= 3 else "Review Needed"
    problem.attempts += 1
    problem.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(problem)
    return problem


@router.delete("/{problem_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_problem(
    problem_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a tracked problem owned by the authenticated user."""
    stmt = select(LeetCodeProblem).where(
        LeetCodeProblem.id == problem_id,
        LeetCodeProblem.user_id == current_user.id,
    )
    problem = (await db.execute(stmt)).scalar_one_or_none()
    if not problem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found")

    await db.delete(problem)
    await db.commit()
    return None
