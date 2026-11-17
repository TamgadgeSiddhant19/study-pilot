from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.resource import LearningResource
from app.schemas.resource import ResourceCreate, ResourceUpdate, ResourceResponse

router = APIRouter(prefix="/resources", tags=["Resource Library"])


@router.get("", response_model=List[ResourceResponse])
async def list_resources(
    category: Optional[str] = None,
    query_str: Optional[str] = Query(None, alias="q"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List bookmarked learning resources strictly belonging to the authenticated user."""
    query = (
        select(LearningResource)
        .where(LearningResource.user_id == current_user.id)
        .order_by(LearningResource.rating.desc(), LearningResource.id.desc())
    )
    if category:
        query = query.where(LearningResource.category == category)
    if query_str:
        query = query.where(LearningResource.title.ilike(f"%{query_str.strip()}%"))

    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=ResourceResponse, status_code=status.HTTP_201_CREATED)
async def create_resource(
    resource_in: ResourceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Add a new learning resource for the authenticated user."""
    resource = LearningResource(
        **resource_in.model_dump(),
        user_id=current_user.id,
    )
    db.add(resource)
    await db.commit()
    await db.refresh(resource)
    return resource


@router.patch("/{resource_id}", response_model=ResourceResponse)
async def update_resource(
    resource_id: int,
    resource_in: ResourceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a learning resource owned by the authenticated user."""
    stmt = select(LearningResource).where(
        LearningResource.id == resource_id,
        LearningResource.user_id == current_user.id,
    )
    resource = (await db.execute(stmt)).scalar_one_or_none()
    if not resource:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

    update_data = resource_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(resource, field, val)

    await db.commit()
    await db.refresh(resource)
    return resource


@router.delete("/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resource(
    resource_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a learning resource owned by the authenticated user."""
    stmt = select(LearningResource).where(
        LearningResource.id == resource_id,
        LearningResource.user_id == current_user.id,
    )
    resource = (await db.execute(stmt)).scalar_one_or_none()
    if not resource:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

    await db.delete(resource)
    await db.commit()
    return None
