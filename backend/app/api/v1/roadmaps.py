from typing import List, Optional, Dict
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.api.deps import get_optional_current_user, get_current_user
from app.models.user import User
from app.models.roadmap import Roadmap, RoadmapTopic, UserTopicProgress
from app.schemas.roadmap import RoadmapResponse, TopicResponse, TopicUpdate

router = APIRouter(prefix="/roadmaps", tags=["Roadmaps"])


def _build_topic_response(topic: RoadmapTopic, user_progress: Optional[UserTopicProgress]) -> TopicResponse:
    """Build TopicResponse applying user-specific status and mastery if tracked, else clean defaults."""
    topic_status = user_progress.status if user_progress else "not_started"
    topic_mastery = user_progress.mastery_percentage if user_progress else 0

    return TopicResponse(
        id=topic.id,
        roadmap_id=topic.roadmap_id,
        title=topic.title,
        category=topic.category,
        description=topic.description,
        order_index=topic.order_index,
        status=topic_status,
        mastery_percentage=topic_mastery,
        estimated_hours=topic.estimated_hours,
        created_at=topic.created_at,
    )


@router.get("", response_model=List[RoadmapResponse])
async def list_roadmaps(
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List roadmaps with milestone topic progress scoped strictly to the authenticated user."""
    # 1. Fetch roadmaps with topics
    result = await db.execute(
        select(Roadmap).options(selectinload(Roadmap.topics)).order_by(Roadmap.id)
    )
    roadmaps = result.scalars().all()

    # 2. Fetch authenticated user's topic progress map
    progress_map: Dict[int, UserTopicProgress] = {}
    if current_user:
        progress_res = await db.execute(
            select(UserTopicProgress).where(UserTopicProgress.user_id == current_user.id)
        )
        for p in progress_res.scalars().all():
            progress_map[p.topic_id] = p

    # 3. Assemble response overlaying user progress
    responses = []
    for rm in roadmaps:
        topics_resp = [
            _build_topic_response(t, progress_map.get(t.id))
            for t in rm.topics
        ]
        responses.append(
            RoadmapResponse(
                id=rm.id,
                title=rm.title,
                slug=rm.slug,
                description=rm.description,
                category=rm.category,
                icon=rm.icon,
                color=rm.color,
                created_at=rm.created_at,
                topics=topics_resp,
            )
        )
    return responses


@router.get("/{slug}", response_model=RoadmapResponse)
async def get_roadmap(
    slug: str,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve single roadmap by slug with personal progress for authenticated user."""
    result = await db.execute(
        select(Roadmap)
        .where(Roadmap.slug == slug)
        .options(selectinload(Roadmap.topics))
    )
    roadmap = result.scalar_one_or_none()
    if not roadmap:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Roadmap not found")

    progress_map: Dict[int, UserTopicProgress] = {}
    if current_user:
        progress_res = await db.execute(
            select(UserTopicProgress).where(UserTopicProgress.user_id == current_user.id)
        )
        for p in progress_res.scalars().all():
            progress_map[p.topic_id] = p

    topics_resp = [
        _build_topic_response(t, progress_map.get(t.id))
        for t in roadmap.topics
    ]
    return RoadmapResponse(
        id=roadmap.id,
        title=roadmap.title,
        slug=roadmap.slug,
        description=roadmap.description,
        category=roadmap.category,
        icon=roadmap.icon,
        color=roadmap.color,
        created_at=roadmap.created_at,
        topics=topics_resp,
    )


@router.patch("/topics/{topic_id}", response_model=TopicResponse)
async def update_topic(
    topic_id: int,
    topic_in: TopicUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update topic mastery and status for the authenticated user without mutating global curriculum."""
    topic = await db.get(RoadmapTopic, topic_id)
    if not topic:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")

    # Fetch or create UserTopicProgress for this user and topic
    stmt = select(UserTopicProgress).where(
        UserTopicProgress.user_id == current_user.id,
        UserTopicProgress.topic_id == topic_id,
    )
    user_prog = (await db.execute(stmt)).scalar_one_or_none()

    if not user_prog:
        user_prog = UserTopicProgress(
            user_id=current_user.id,
            topic_id=topic_id,
            status="not_started",
            mastery_percentage=0,
        )
        db.add(user_prog)

    update_data = topic_in.model_dump(exclude_unset=True)
    if "status" in update_data and update_data["status"] is not None:
        user_prog.status = update_data["status"]
    if "mastery_percentage" in update_data and update_data["mastery_percentage"] is not None:
        user_prog.mastery_percentage = update_data["mastery_percentage"]

    user_prog.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user_prog)

    return _build_topic_response(topic, user_prog)
