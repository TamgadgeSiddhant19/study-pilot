import pytest
from httpx import AsyncClient
from app.core.config import settings
from app.core.security import create_access_token, hash_password
from app.models.user import User
from app.models.task import Task


@pytest.mark.asyncio
async def test_student_registration_success(client: AsyncClient):
    """Test successful registration of a student with role-specific fields."""
    payload = {
        "email": "Student.Jane@University.edu",
        "password": "JanePassword2026!",
        "full_name": "Jane Doe",
        "account_type": "student",
        "education_level": "Undergraduate",
        "institution": "Stanford University",
        "learning_stage": "Fundamentals",
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "student.jane@university.edu"  # normalized lowercase
    assert data["user"]["full_name"] == "Jane Doe"
    assert data["user"]["account_type"] == "student"
    assert data["user"]["institution"] == "Stanford University"
    assert "password" not in data["user"]
    assert "password_hash" not in data["user"]

    # Verify session cookie is set
    assert settings.COOKIE_NAME in response.cookies


@pytest.mark.asyncio
async def test_professional_registration_success(client: AsyncClient):
    """Test successful registration of a working professional."""
    payload = {
        "email": "Engineer.Bob@TechCorp.io",
        "password": "BobSecurePassword2026!",
        "full_name": "Bob Martin",
        "account_type": "professional",
        "current_role": "Backend Engineer",
        "experience_range": "3-5 years",
        "skill_level": "Intermediate",
    }
    response = await client.post("/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["user"]["email"] == "engineer.bob@techcorp.io"
    assert data["user"]["account_type"] == "professional"
    assert data["user"]["current_role"] == "Backend Engineer"
    assert data["user"]["skill_level"] == "Intermediate"


@pytest.mark.asyncio
async def test_duplicate_email_registration_rejected(client: AsyncClient):
    """Test that registering an existing email returns 409 Conflict with generic message."""
    payload = {
        "email": "unique.user@example.com",
        "password": "Password123!",
        "full_name": "First User",
        "account_type": "student",
    }
    first_res = await client.post("/api/v1/auth/register", json=payload)
    assert first_res.status_code == 201

    # Second registration with uppercase variation of the same email
    payload_dup = {
        "email": "UNIQUE.USER@example.com",
        "password": "AnotherPassword456!",
        "full_name": "Duplicate Attempt",
        "account_type": "professional",
    }
    dup_res = await client.post("/api/v1/auth/register", json=payload_dup)
    assert dup_res.status_code == 409
    assert "already exists" in dup_res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_registration_validation_errors(client: AsyncClient):
    """Test validation errors for invalid email, short password, and empty name."""
    # Invalid email
    bad_email = await client.post("/api/v1/auth/register", json={
        "email": "not-an-email",
        "password": "ValidPassword123!",
        "full_name": "Valid Name",
        "account_type": "student",
    })
    assert bad_email.status_code == 422

    # Password too short (< 8 chars)
    short_pw = await client.post("/api/v1/auth/register", json={
        "email": "test@example.com",
        "password": "short",
        "full_name": "Valid Name",
        "account_type": "student",
    })
    assert short_pw.status_code == 422

    # Full name empty
    empty_name = await client.post("/api/v1/auth/register", json={
        "email": "test@example.com",
        "password": "ValidPassword123!",
        "full_name": "   ",
        "account_type": "student",
    })
    assert empty_name.status_code == 422


@pytest.mark.asyncio
async def test_login_success_and_session_cookie(client: AsyncClient, test_user: User):
    """Test login with valid credentials sets cookie and returns JWT."""
    response = await client.post("/api/v1/auth/login", json={
        "email": test_user.email,
        "password": "StrongPassword123!",
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == test_user.email
    assert settings.COOKIE_NAME in response.cookies


@pytest.mark.asyncio
async def test_login_failure_prevents_user_enumeration(client: AsyncClient, test_user: User):
    """Test that wrong password and non-existent email return identical generic 401 error."""
    # Case 1: Existing user with wrong password
    res_wrong_pw = await client.post("/api/v1/auth/login", json={
        "email": test_user.email,
        "password": "IncorrectPassword999!",
    })
    assert res_wrong_pw.status_code == 401

    # Case 2: Non-existent email
    res_no_user = await client.post("/api/v1/auth/login", json={
        "email": "completely_fake_email@domain.com",
        "password": "SomeRandomPassword123!",
    })
    assert res_no_user.status_code == 401

    # Both return the identical error message
    assert res_wrong_pw.json()["detail"] == res_no_user.json()["detail"]
    assert "invalid email or password" in res_wrong_pw.json()["detail"].lower()


@pytest.mark.asyncio
async def test_current_user_me_endpoint(auth_client: AsyncClient, test_user: User):
    """Test retrieving authenticated user profile via GET /auth/me and GET /api/v1/auth/me."""
    res = await auth_client.get("/api/v1/auth/me")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == test_user.id
    assert data["email"] == test_user.email
    assert data["full_name"] == test_user.full_name

    # Direct /auth/me alias
    res_root = await auth_client.get("/auth/me")
    assert res_root.status_code == 200
    assert res_root.json()["id"] == test_user.id


@pytest.mark.asyncio
async def test_cookie_based_authentication(client: AsyncClient, test_user: User):
    """Test that requests with HttpOnly session cookie authenticate successfully."""
    token = create_access_token({"sub": str(test_user.id), "email": test_user.email})
    client.cookies.set(settings.COOKIE_NAME, token)

    res = await client.get("/api/v1/auth/me")
    assert res.status_code == 200
    assert res.json()["email"] == test_user.email


@pytest.mark.asyncio
async def test_unauthenticated_request_rejected(client: AsyncClient):
    """Test that accessing protected endpoints without authentication returns 401."""
    res_me = await client.get("/api/v1/auth/me")
    assert res_me.status_code == 401

    res_tasks = await client.get("/api/v1/tasks")
    assert res_tasks.status_code == 401


@pytest.mark.asyncio
async def test_invalid_and_expired_tokens(client: AsyncClient):
    """Test that forged or expired tokens are rejected with 401."""
    # Forged token
    client.headers["Authorization"] = "Bearer invalid.forged.jwt.token"
    res = await client.get("/api/v1/auth/me")
    assert res.status_code == 401

    # Clean headers
    del client.headers["Authorization"]


@pytest.mark.asyncio
async def test_logout_clears_cookies(client: AsyncClient):
    """Test that POST /auth/logout clears auth session cookies."""
    response = await client.post("/api/v1/auth/logout")
    assert response.status_code == 200
    assert "Logged out successfully" in response.json()["message"]


@pytest.mark.asyncio
async def test_onboarding_and_profile_update(auth_client: AsyncClient, test_user: User):
    """Test updating onboarding fields and marking profile onboarded."""
    patch_payload = {
        "education_level": "Master's Degree",
        "institution": "Carnegie Mellon University",
        "learning_stage": "System Design & Algorithms",
        "target_role": "Staff Distributed Systems Engineer",
        "daily_flight_quota_hours": 5.5,
        "is_onboarded": True,
    }
    patch_res = await auth_client.patch("/api/v1/auth/profile", json=patch_payload)
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["education_level"] == "Master's Degree"
    assert updated["institution"] == "Carnegie Mellon University"
    assert updated["is_onboarded"] is True
    assert updated["target_role"] == "Staff Distributed Systems Engineer"
    assert updated["daily_flight_quota_hours"] == 5.5


@pytest.mark.asyncio
async def test_cross_user_task_isolation(
    auth_client: AsyncClient,
    test_user: User,
    auth_client_b: AsyncClient,
    test_user_b: User,
):
    """Test strict authorization boundaries: User B cannot view, edit, or delete User A's tasks."""
    # 1. User A creates a task
    create_res = await auth_client.post("/api/v1/tasks", json={
        "title": "User A Private Study Task",
        "subject": "Distributed Systems",
        "priority": "P0",
        "due_date": "Today",
    })
    assert create_res.status_code == 201
    user_a_task = create_res.json()
    task_id = user_a_task["id"]

    # 2. User A can retrieve their own task
    get_res_a = await auth_client.get(f"/api/v1/tasks/{task_id}")
    assert get_res_a.status_code == 200
    assert get_res_a.json()["id"] == task_id

    # 3. User B lists tasks -> User A's task MUST NOT appear
    list_res_b = await auth_client_b.get("/api/v1/tasks")
    assert list_res_b.status_code == 200
    tasks_b = list_res_b.json()
    assert not any(t["id"] == task_id for t in tasks_b)

    # 4. User B attempts to GET User A's task directly -> returns 404
    get_res_b = await auth_client_b.get(f"/api/v1/tasks/{task_id}")
    assert get_res_b.status_code == 404

    # 5. User B attempts to UPDATE User A's task -> returns 404
    patch_res_b = await auth_client_b.patch(f"/api/v1/tasks/{task_id}", json={
        "title": "Hacked by User B",
        "completed": True,
    })
    assert patch_res_b.status_code == 404

    # 6. User B attempts to DELETE User A's task -> returns 404
    del_res_b = await auth_client_b.delete(f"/api/v1/tasks/{task_id}")
    assert del_res_b.status_code == 404

    # 7. Verify User A's task is still intact
    verify_res = await auth_client.get(f"/api/v1/tasks/{task_id}")
    assert verify_res.status_code == 200
    assert verify_res.json()["title"] == "User A Private Study Task"
    assert verify_res.json()["completed"] is False
