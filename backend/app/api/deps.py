import logging
from typing import Optional
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User

logger = logging.getLogger("studypilot.auth")

# Optional bearer schema for OpenAPI documentation
bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    bearer_token: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Dependency that extracts and validates the authenticated user.
    
    Supports both:
    1. HttpOnly session cookie (settings.COOKIE_NAME)
    2. Authorization: Bearer <token> header
    """
    token = None

    # 1. Check Bearer token from Authorization header first
    if bearer_token and bearer_token.credentials:
        token = bearer_token.credentials

    # 2. Check HttpOnly cookie
    if not token:
        token = request.cookies.get(settings.COOKIE_NAME)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 3. Decode JWT
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = int(payload["sub"])
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 4. Fetch user from database
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )

    return user


async def get_optional_current_user(
    request: Request,
    bearer_token: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Dependency that retrieves user if authenticated, or None if unauthenticated."""
    try:
        return await get_current_user(request, bearer_token, db)
    except HTTPException:
        return None
