import pytest
import pytest_asyncio
from typing import AsyncGenerator
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import hash_password, create_access_token
from app.models.user import User
from app.main import app as fastapi_app
import app.models  # ensure all models are registered

# Isolated in-memory SQLite database specifically for test executions
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_db():
    """Create all schema tables in the isolated test database."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide a transactional database session for an individual test."""
    async with TestingSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Provide an unauthenticated HTTPX AsyncClient with get_db overridden to use test DB."""
    async def override_get_db():
        yield db_session

    fastapi_app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    fastapi_app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> User:
    """Create or retrieve default authenticated test user."""
    from sqlalchemy import select
    res = await db_session.execute(select(User).where(User.email == "testuser@studypilot.ai"))
    existing = res.scalar_one_or_none()
    if existing:
        return existing

    user = User(
        email="testuser@studypilot.ai",
        password_hash=hash_password("StrongPassword123!"),
        full_name="Alex River",
        account_type="student",
        education_level="Undergraduate",
        institution="MIT",
        learning_stage="Interview Prep",
        is_onboarded=True,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def auth_client(client: AsyncClient, test_user: User) -> AsyncClient:
    """Provide AsyncClient authenticated as test_user via Bearer token."""
    token = create_access_token({"sub": str(test_user.id), "email": test_user.email})
    client.headers["Authorization"] = f"Bearer {token}"
    return client


@pytest_asyncio.fixture
async def test_user_b(db_session: AsyncSession) -> User:
    """Create or retrieve a second test user for cross-user authorization tests."""
    from sqlalchemy import select
    res = await db_session.execute(select(User).where(User.email == "user_b@studypilot.ai"))
    existing = res.scalar_one_or_none()
    if existing:
        return existing

    user_b = User(
        email="user_b@studypilot.ai",
        password_hash=hash_password("StrongPassword456!"),
        full_name="Devon Vance",
        account_type="professional",
        current_role="Staff Systems Engineer",
        experience_range="5+ years",
        skill_level="Expert",
        is_onboarded=True,
        is_active=True,
    )
    db_session.add(user_b)
    await db_session.commit()
    await db_session.refresh(user_b)
    return user_b


@pytest_asyncio.fixture
async def auth_client_b(db_session: AsyncSession, test_user_b: User) -> AsyncGenerator[AsyncClient, None]:
    """Provide AsyncClient authenticated as test_user_b."""
    async def override_get_db():
        yield db_session

    fastapi_app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=fastapi_app)
    token = create_access_token({"sub": str(test_user_b.id), "email": test_user_b.email})
    headers = {"Authorization": f"Bearer {token}"}
    async with AsyncClient(transport=transport, base_url="http://test", headers=headers) as ac:
        yield ac
