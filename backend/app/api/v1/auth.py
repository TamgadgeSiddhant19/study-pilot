from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Response, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    generate_csrf_token,
)
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.auth import (
    UserRegister,
    UserLogin,
    UserProfileUpdate,
    UserResponse,
    TokenResponse,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _set_auth_cookies(response: Response, token: str, csrf_token: str) -> None:
    """Set secure session and CSRF cookies on the response."""
    is_production = settings.ENVIRONMENT != "development"
    max_age_seconds = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60

    # HttpOnly JWT session cookie
    response.set_cookie(
        key=settings.COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=is_production,
        max_age=max_age_seconds,
        path="/",
    )

    # Browser-accessible CSRF cookie
    response.set_cookie(
        key=settings.CSRF_COOKIE_NAME,
        value=csrf_token,
        httponly=False,
        samesite="lax",
        secure=is_production,
        max_age=max_age_seconds,
        path="/",
    )


def _clear_auth_cookies(response: Response) -> None:
    """Clear session and CSRF cookies."""
    response.delete_cookie(key=settings.COOKIE_NAME, path="/")
    response.delete_cookie(key=settings.CSRF_COOKIE_NAME, path="/")


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_in: UserRegister,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Register a new user account with Argon2 password hashing.
    
    Prevents duplicate accounts via database check and unique constraint.
    Sets HttpOnly session cookie and returns authentication token.
    """
    normalized_email = user_in.email.strip().lower()

    # Check for duplicate email
    stmt = select(User).where(User.email == normalized_email)
    existing_user = (await db.execute(stmt)).scalar_one_or_none()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        )

    # Hash password with Argon2
    hashed_pwd = hash_password(user_in.password)

    # Create new user record
    new_user = User(
        email=normalized_email,
        password_hash=hashed_pwd,
        full_name=user_in.full_name,
        account_type=user_in.account_type,
        education_level=user_in.education_level,
        institution=user_in.institution,
        learning_stage=user_in.learning_stage,
        current_role=user_in.current_role,
        experience_range=user_in.experience_range,
        skill_level=user_in.skill_level,
        is_onboarded=False,
        is_active=True,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Issue JWT token & CSRF token
    access_token = create_access_token({"sub": str(new_user.id), "email": new_user.email})
    csrf_token = generate_csrf_token()

    _set_auth_cookies(response, access_token, csrf_token)

    user_resp = UserResponse.model_validate(new_user)
    user_resp.name = new_user.full_name
    user_resp.csrf_token = csrf_token

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        csrf_token=csrf_token,
        user=user_resp,
    )


DEMO_EMAIL = "demo@studypilot.io"
DEMO_PASSWORD = "Demo@123456"


async def _get_or_create_demo_user(db: AsyncSession) -> User:
    """Retrieve or automatically create the development demo account with initial data."""
    stmt = select(User).where(User.email == DEMO_EMAIL)
    user = (await db.execute(stmt)).scalar_one_or_none()

    if not user:
        demo_pwd_hash = hash_password(DEMO_PASSWORD)
        user = User(
            email=DEMO_EMAIL,
            password_hash=demo_pwd_hash,
            full_name="Alex Mercer (Demo Student)",
            account_type="student",
            education_level="Bachelor of Computer Science",
            institution="Stanford University",
            learning_stage="Final Year",
            target_role="Full-Stack AI Engineer",
            target_date="Nov 15",
            daily_flight_quota_hours=4.0,
            is_onboarded=True,
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        # Seed starter tasks for the demo user
        try:
            from app.models.task import Task
            starter_tasks = [
                Task(
                    title="Design System Architecture Diagram",
                    subject="System Design",
                    description="Review distributed caching and replication strategies for study planner",
                    priority="P0",
                    status="in_progress",
                    completed=False,
                    estimated_minutes=45,
                    actual_minutes=20,
                    user_id=user.id,
                ),
                Task(
                    title="Dynamic Programming: 2D Grid Traversal",
                    subject="LeetCode / Algorithms",
                    description="Solve Unique Paths II and Minimum Path Sum with space optimization",
                    priority="P1",
                    status="todo",
                    completed=False,
                    estimated_minutes=35,
                    actual_minutes=0,
                    user_id=user.id,
                ),
                Task(
                    title="Complete Microservices Auth Middleware",
                    subject="Backend Engineering",
                    description="Verify Argon2 hashing and HttpOnly JWT cookie persistence",
                    priority="P1",
                    status="completed",
                    completed=True,
                    estimated_minutes=30,
                    actual_minutes=30,
                    user_id=user.id,
                ),
            ]
            db.add_all(starter_tasks)
            await db.commit()
        except Exception:
            await db.rollback()

    return user


@router.post("/demo", response_model=TokenResponse)
async def login_demo(
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Direct one-click login endpoint for development and demonstration."""
    user = await _get_or_create_demo_user(db)

    access_token = create_access_token({"sub": str(user.id), "email": user.email})
    csrf_token = generate_csrf_token()

    _set_auth_cookies(response, access_token, csrf_token)

    user_resp = UserResponse.model_validate(user)
    user_resp.name = user.full_name
    user_resp.csrf_token = csrf_token

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        csrf_token=csrf_token,
        user=user_resp,
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    credentials: UserLogin,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate a user using email and password.
    
    Returns generic 401 error on invalid credentials without exposing
    whether the email exists in the system.
    """
    normalized_email = credentials.email.strip().lower()

    if normalized_email == DEMO_EMAIL and credentials.password == DEMO_PASSWORD:
        user = await _get_or_create_demo_user(db)
    else:
        stmt = select(User).where(User.email == normalized_email)
        user = (await db.execute(stmt)).scalar_one_or_none()

    # Constant-time comparison or generic failure preventing email enumeration
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Please contact support.",
        )

    access_token = create_access_token({"sub": str(user.id), "email": user.email})
    csrf_token = generate_csrf_token()

    _set_auth_cookies(response, access_token, csrf_token)

    user_resp = UserResponse.model_validate(user)
    user_resp.name = user.full_name
    user_resp.csrf_token = csrf_token

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        csrf_token=csrf_token,
        user=user_resp,
    )


@router.post("/logout")
async def logout(response: Response) -> Dict[str, str]:
    """Log out current user by terminating session cookies."""
    _clear_auth_cookies(response)
    return {"message": "Logged out successfully."}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Retrieve details of the currently authenticated user."""
    resp = UserResponse.model_validate(current_user)
    resp.name = current_user.full_name
    return resp


@router.patch("/profile", response_model=UserResponse)
async def update_profile(
    profile_in: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Update profile fields, complete onboarding, or modify study targets."""
    update_data = profile_in.model_dump(exclude_unset=True)

    for field, val in update_data.items():
        if hasattr(current_user, field):
            setattr(current_user, field, val)

    await db.commit()
    await db.refresh(current_user)

    resp = UserResponse.model_validate(current_user)
    resp.name = current_user.full_name
    return resp
