import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task
from app.services.srs_engine import calculate_sm2


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    """Test health check returns system status and database connectivity."""
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("healthy", "degraded")
    assert "database" in data
    assert "version" in data


@pytest.mark.asyncio
async def test_task_creation_and_retrieval(auth_client: AsyncClient):
    """Test creating a valid task and retrieving it by ID."""
    payload = {
        "title": "Master HNSW Vector Indexing",
        "subject": "Vector DBs",
        "priority": "P0",
        "status": "todo",
        "estimated_minutes": 60,
        "due_date": "Due Tomorrow",
    }
    create_res = await auth_client.post("/api/v1/tasks", json=payload)
    assert create_res.status_code == 201
    task_data = create_res.json()
    assert task_data["id"] is not None
    assert task_data["title"] == payload["title"]
    assert task_data["completed"] is False
    assert task_data["priority"] == "P0"

    task_id = task_data["id"]

    # Retrieve by ID
    get_res = await auth_client.get(f"/api/v1/tasks/{task_id}")
    assert get_res.status_code == 200
    retrieved = get_res.json()
    assert retrieved["id"] == task_id
    assert retrieved["title"] == payload["title"]
    assert retrieved["due_date"] == "Due Tomorrow"


@pytest.mark.asyncio
async def test_task_validation_failures(auth_client: AsyncClient):
    """Test that invalid task payloads return 422 Unprocessable Entity."""
    # 1. Empty title
    res_empty_title = await auth_client.post("/api/v1/tasks", json={
        "title": "",
        "priority": "P1",
    })
    assert res_empty_title.status_code == 422

    # 2. Invalid priority (must be P0, P1, P2)
    res_bad_priority = await auth_client.post("/api/v1/tasks", json={
        "title": "Valid Title",
        "priority": "P9",
    })
    assert res_bad_priority.status_code == 422

    # 3. Invalid status
    res_bad_status = await auth_client.post("/api/v1/tasks", json={
        "title": "Valid Title",
        "status": "done_forever",
    })
    assert res_bad_status.status_code == 422

    # 4. Zero / negative estimated minutes
    res_bad_duration = await auth_client.post("/api/v1/tasks", json={
        "title": "Valid Title",
        "estimated_minutes": 0,
    })
    assert res_bad_duration.status_code == 422


@pytest.mark.asyncio
async def test_task_partial_update(auth_client: AsyncClient):
    """Test updating task properties partially via PATCH."""
    # Create initial task
    create_res = await auth_client.post("/api/v1/tasks", json={
        "title": "Draft System Architecture",
        "subject": "System Design",
        "priority": "P1",
        "completed": False,
    })
    task_id = create_res.json()["id"]

    # Partial update: title and due_date
    patch_res = await auth_client.patch(f"/api/v1/tasks/{task_id}", json={
        "title": "Draft Low-Latency Architecture",
        "due_date": "Overdue",
    })
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["title"] == "Draft Low-Latency Architecture"
    assert updated["due_date"] == "Overdue"
    assert updated["completed"] is False

    # Partial update: mark completed
    complete_res = await auth_client.patch(f"/api/v1/tasks/{task_id}", json={
        "completed": True,
    })
    assert complete_res.status_code == 200
    completed_data = complete_res.json()
    assert completed_data["completed"] is True
    assert completed_data["status"] == "completed"
    assert completed_data["completed_at"] is not None


@pytest.mark.asyncio
async def test_task_missing_records(auth_client: AsyncClient):
    """Test that requesting, updating, or deleting a non-existent task returns 404."""
    non_existent_id = 999999

    get_res = await auth_client.get(f"/api/v1/tasks/{non_existent_id}")
    assert get_res.status_code == 404

    patch_res = await auth_client.patch(f"/api/v1/tasks/{non_existent_id}", json={"title": "Doesn't Exist"})
    assert patch_res.status_code == 404

    del_res = await auth_client.delete(f"/api/v1/tasks/{non_existent_id}")
    assert del_res.status_code == 404


@pytest.mark.asyncio
async def test_task_deletion_lifecycle(auth_client: AsyncClient):
    """Test deleting a task removes it permanently."""
    create_res = await auth_client.post("/api/v1/tasks", json={
        "title": "Temporary Task for Deletion",
        "priority": "P2",
    })
    task_id = create_res.json()["id"]

    # Delete task
    del_res = await auth_client.delete(f"/api/v1/tasks/{task_id}")
    assert del_res.status_code == 204

    # Subsequent GET returns 404
    get_res = await auth_client.get(f"/api/v1/tasks/{task_id}")
    assert get_res.status_code == 404


@pytest.mark.asyncio
async def test_task_database_persistence(auth_client: AsyncClient, db_session: AsyncSession):
    """Test that a task created through the API physically persists in the database table."""
    title = "Verify In-DB Persistence"
    create_res = await auth_client.post("/api/v1/tasks", json={
        "title": title,
        "subject": "Storage Verification",
        "priority": "P0",
        "due_date": "Due Today",
    })
    task_id = create_res.json()["id"]

    # Directly query the database through SQLAlchemy session
    stmt = select(Task).where(Task.id == task_id)
    result = await db_session.execute(stmt)
    db_task = result.scalar_one_or_none()

    assert db_task is not None
    assert db_task.id == task_id
    assert db_task.title == title
    assert db_task.subject == "Storage Verification"


@pytest.mark.asyncio
async def test_task_filtering_and_pagination(auth_client: AsyncClient):
    """Test filtering by status/priority and pagination query parameters."""
    for i in range(5):
        await auth_client.post("/api/v1/tasks", json={
            "title": f"Batch Task {i}",
            "priority": "P0" if i % 2 == 0 else "P1",
            "status": "todo",
        })

    # Filter by priority P0
    p0_res = await auth_client.get("/api/v1/tasks?priority=P0")
    assert p0_res.status_code == 200
    p0_tasks = p0_res.json()
    assert all(t["priority"] == "P0" for t in p0_tasks)

    # Test pagination
    paged_res = await auth_client.get("/api/v1/tasks?limit=2&offset=0")
    assert paged_res.status_code == 200
    assert len(paged_res.json()) <= 2
    assert "X-Total-Count" in paged_res.headers


@pytest.mark.asyncio
async def test_user_profile_endpoint(auth_client: AsyncClient):
    """Test retrieving and updating the learner profile."""
    res = await auth_client.get("/api/v1/users/me")
    assert res.status_code == 200
    user_data = res.json()
    assert "email" in user_data
    assert "full_name" in user_data

    # Update profile
    update_res = await auth_client.patch("/api/v1/users/me", json={
        "target_role": "Principal AI Systems Architect",
        "daily_flight_quota_hours": 5.0,
    })
    assert update_res.status_code == 200
    assert update_res.json()["target_role"] == "Principal AI Systems Architect"
    assert update_res.json()["daily_flight_quota_hours"] == 5.0


def test_sm2_algorithm():
    """Test the SM2 spaced repetition calculation logic."""
    # Test perfect recall
    reps, interval, ef, next_rev = calculate_sm2(quality=5, repetitions=0, ease_factor=2.5, interval_days=1)
    assert reps == 1
    assert interval == 1
    assert ef >= 2.5

    # Test repetition 2
    reps2, interval2, ef2, next_rev2 = calculate_sm2(quality=5, repetitions=1, ease_factor=ef, interval_days=interval)
    assert reps2 == 2
    assert interval2 == 6

    # Test blackout failure (reset)
    reps_fail, interval_fail, ef_fail, _ = calculate_sm2(quality=1, repetitions=5, ease_factor=2.5, interval_days=30)
    assert reps_fail == 0
    assert interval_fail == 1
