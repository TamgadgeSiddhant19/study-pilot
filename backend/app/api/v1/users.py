from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.user import UserResponse, UserUpdate

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user),
):
    """Retrieve profile for the authenticated user."""
    resp = UserResponse.model_validate(current_user)
    resp.name = current_user.full_name
    return resp


@router.patch("/me", response_model=UserResponse)
async def update_current_user_profile(
    user_in: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update profile details for the authenticated user."""
    update_data = user_in.model_dump(exclude_unset=True)
    if "name" in update_data and "full_name" not in update_data:
        update_data["full_name"] = update_data.pop("name")

    for field, val in update_data.items():
        if hasattr(current_user, field):
            setattr(current_user, field, val)

    await db.commit()
    await db.refresh(current_user)

    resp = UserResponse.model_validate(current_user)
    resp.name = current_user.full_name
    return resp
