import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.task import Task
from app.models.session import StudySession


@pytest.mark.asyncio
async def test_log_focus_session_with_linked_task(
    auth_client: AsyncClient,
    test_user,
    db_session: AsyncSession,
):
    """Logging a completed focus session should increment task actual_minutes without auto-completing it."""
    # 1. Create a task
    task = Task(
        title="Test Tree Traversal",
        subject="DSA",
        estimated_minutes=45,
        actual_minutes=0,
        completed=False,
        status="todo",
        priority="P1",
        user_id=test_user.id,
    )
    db_session.add(task)
    await db_session.commit()
    await db_session.refresh(task)

    # 2. Log a 25-minute completed pomodoro focus session
    resp = await auth_client.post(
        "/api/v1/sessions",
        json={
            "subject": "Test Tree Traversal",
            "duration_minutes": 25,
            "session_type": "pomodoro",
            "task_id": task.id,
            "completed": True,
            "notes": "Finished binary search tree search function",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["duration_minutes"] == 25
    assert data["session_type"] == "pomodoro"
    assert data["completed"] is True
    assert data["task_id"] == task.id

    # 3. Verify task actual_minutes increased, but completed remains False
    await db_session.refresh(task)
    assert task.actual_minutes == 25
    assert task.completed is False


@pytest.mark.asyncio
async def test_focus_stats_excludes_breaks_and_incomplete(
    auth_client: AsyncClient,
    test_user,
    db_session: AsyncSession,
):
    """Break sessions and incomplete sessions must NOT count toward study minutes."""
    # Get baseline stats before adding break and incomplete sessions
    baseline_resp = await auth_client.get("/api/v1/sessions/stats")
    assert baseline_resp.status_code == 200
    baseline_minutes = baseline_resp.json()["total_minutes_today"]

    # Log a short break (5 mins, completed)
    resp_break = await auth_client.post(
        "/api/v1/sessions",
        json={
            "subject": "Coffee break",
            "duration_minutes": 5,
            "session_type": "short_break",
            "completed": True,
        },
    )
    assert resp_break.status_code == 201

    # Log an incomplete session (30 mins, completed=False)
    resp_inc = await auth_client.post(
        "/api/v1/sessions",
        json={
            "subject": "Interrupted Focus",
            "duration_minutes": 30,
            "session_type": "pomodoro",
            "completed": False,
        },
    )
    assert resp_inc.status_code == 201

    # Check stats
    stats_resp = await auth_client.get("/api/v1/sessions/stats")
    assert stats_resp.status_code == 200
    stats = stats_resp.json()
    # The break (5m) and incomplete (30m) must not be counted in total_minutes_today
    assert stats["total_minutes_today"] == baseline_minutes


@pytest.mark.asyncio
async def test_session_isolation(
    auth_client: AsyncClient,
    auth_client_b: AsyncClient,
):
    """Users should only see their own sessions."""
    # User A logs a session
    await auth_client.post(
        "/api/v1/sessions",
        json={
            "subject": "User A Private Study",
            "duration_minutes": 20,
            "session_type": "pomodoro",
            "completed": True,
        },
    )

    # User B lists sessions
    list_b = await auth_client_b.get("/api/v1/sessions")
    assert list_b.status_code == 200
    sessions_b = list_b.json()
    for s in sessions_b:
        assert s["subject"] != "User A Private Study"
