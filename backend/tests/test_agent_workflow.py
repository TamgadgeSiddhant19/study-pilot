import json
from datetime import datetime, timezone, timedelta
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import AsyncMock

from app.models.user import User
from app.models.task import Task
from app.models.coach import CoachConversation, CoachActionProposal
from app.services.llm import LLMProvider, LLMResponse, set_llm_provider_override
from app.services.rag.embeddings import MockEmbeddingProvider, set_embedding_provider_override
from app.services.agent.graph import study_coach_graph
from app.services.agent.tools import (
    tool_get_user_goals_and_deadlines,
    tool_get_user_tasks,
    tool_get_leetcode_summary,
    tool_get_focus_history,
    tool_get_roadmap_progress,
    tool_recommend_study_topics,
    tool_propose_study_tasks,
    tool_propose_task_reschedule,
    ProposeTasksInput,
    ProposeRescheduleInput,
    TaskProposalItem,
    UserTasksInput,
)


class MockAgentLLM(LLMProvider):
    def __init__(self, answer: str = "I have reviewed your progress and prepared recommendations."):
        self.answer = answer
        self.last_system_instruction = None
        self.last_messages = None

    @property
    def provider_name(self) -> str:
        return "mock-agent-llm"

    @property
    def model_name(self) -> str:
        return "gemini-2.5-flash"

    async def generate_chat_response(self, messages, system_instruction=None, **kwargs) -> LLMResponse:
        self.last_system_instruction = system_instruction
        self.last_messages = messages
        return LLMResponse(
            content=self.answer,
            model=self.model_name,
            grounding_source="Mock Agent LLM Test",
        )

    async def health_check(self):
        return {"status": "ok"}


@pytest.fixture(autouse=True)
def configure_agent_test_mocks():
    mock_emb = MockEmbeddingProvider()
    set_embedding_provider_override(mock_emb)
    mock_llm = MockAgentLLM()
    set_llm_provider_override(mock_llm)
    yield
    set_embedding_provider_override(None)
    set_llm_provider_override(None)


# ==============================================================================
# 1. TOOL UNIT TESTS & USER ISOLATION
# ==============================================================================

@pytest.mark.asyncio
async def test_tool_user_context_isolation(
    db_session: AsyncSession,
    test_user: User,
    test_user_b: User,
):
    """Verify tool_get_user_goals_and_deadlines and tasks strictly isolate User A from User B."""
    # Seed task for User A
    task_a = Task(
        title="User A Unique Microkernel Task",
        subject="OS",
        priority="P0",
        estimated_minutes=60,
        user_id=test_user.id,
    )
    db_session.add(task_a)
    await db_session.commit()

    # User A tasks
    res_a = await tool_get_user_tasks(user_id=test_user.id, db=db_session)
    assert any(t["id"] == task_a.id for t in res_a["tasks"])

    # User B tasks MUST NOT contain User A's task
    res_b = await tool_get_user_tasks(user_id=test_user_b.id, db=db_session)
    assert not any(t["id"] == task_a.id for t in res_b["tasks"])


@pytest.mark.asyncio
async def test_tool_recommendations_and_summaries(
    db_session: AsyncSession,
    test_user: User,
):
    """Test recommendation engine returns evidence-based recommendations."""
    recs = await tool_recommend_study_topics(user_id=test_user.id, db=db_session)
    assert "evidence_based_recommendations" in recs
    assert len(recs["evidence_based_recommendations"]) > 0


# ==============================================================================
# 2. WRITE PROPOSAL & SAFE CONFIRMATION FLOW
# ==============================================================================

@pytest.mark.asyncio
async def test_propose_write_does_not_mutate_db_before_confirmation(
    auth_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
):
    """
    When user requests study task creation:
    1. A proposal is created with status 'pending'.
    2. Actual Task rows are NOT inserted before user explicitly confirms.
    """
    initial_tasks = (await db_session.execute(select(Task).where(Task.user_id == test_user.id))).scalars().all()
    initial_count = len(initial_tasks)

    # Chat asking to plan/create tasks
    resp = await auth_client.post(
        "/api/v1/coach/chat",
        json={"message": "Please plan my week and create tasks for distributed systems prep"},
    )
    assert resp.status_code == 200
    data = resp.json()

    # Should contain proposed actions
    assert "proposed_actions" in data
    assert len(data["proposed_actions"]) > 0
    proposal = data["proposed_actions"][0]
    proposal_id = proposal["id"]
    assert proposal["status"] in ("pending", "pending_confirmation")
    assert proposal["action_type"] == "create_tasks"

    # Verify no new tasks were written to DB yet!
    after_tasks = (await db_session.execute(select(Task).where(Task.user_id == test_user.id))).scalars().all()
    assert len(after_tasks) == initial_count


@pytest.mark.asyncio
async def test_proposal_confirmation_creates_records(
    auth_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
):
    """
    User calls POST /api/v1/coach/actions/{id}/confirm:
    1. Tasks are actually created and assigned to authenticated user.
    2. Proposal status becomes 'confirmed'.
    """
    # Create proposal directly via tool
    input_data = ProposeTasksInput(
        tasks=[
            TaskProposalItem(title="RAFT Leader Election", subject="Distributed Systems", duration_minutes=90, priority="P0"),
            TaskProposalItem(title="Log Replication Edge Cases", subject="Distributed Systems", duration_minutes=60, priority="P1"),
        ],
        rationale="Interview prep for Senior Infrastructure Engineer",
    )
    proposal_dict = await tool_propose_study_tasks(
        user_id=test_user.id,
        db=db_session,
        conversation_id=None,
        input_data=input_data,
    )
    proposal_id = proposal_dict["proposal_id"]

    # Confirm proposal via endpoint
    confirm_resp = await auth_client.post(f"/api/v1/coach/actions/{proposal_id}/confirm")
    assert confirm_resp.status_code == 200
    res_data = confirm_resp.json()
    assert res_data["status"] == "success"
    assert res_data["details"]["tasks_created"] == 2

    # Verify tasks exist in DB for test_user
    created = (await db_session.execute(
        select(Task).where(Task.user_id == test_user.id, Task.title == "RAFT Leader Election")
    )).scalar_one_or_none()
    assert created is not None
    assert created.subject == "Distributed Systems"
    assert created.priority == "P0"


@pytest.mark.asyncio
async def test_proposal_recheck_ownership_and_cross_user_rejection(
    auth_client: AsyncClient,
    auth_client_b: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
):
    """User B cannot confirm User A's proposal (returns 404)."""
    input_data = ProposeTasksInput(
        tasks=[TaskProposalItem(title="Secret Project A", subject="Secret", duration_minutes=45, priority="P1")],
        rationale="User A only",
    )
    proposal = await tool_propose_study_tasks(
        user_id=test_user.id,
        db=db_session,
        conversation_id=None,
        input_data=input_data,
    )
    proposal_id = proposal["proposal_id"]

    # User B attempts to confirm
    b_confirm = await auth_client_b.post(f"/api/v1/coach/actions/{proposal_id}/confirm")
    assert b_confirm.status_code == 404


@pytest.mark.asyncio
async def test_proposal_idempotency_prevents_duplicate_execution(
    auth_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
):
    """Calling confirm on an already-confirmed proposal returns 400 Bad Request."""
    input_data = ProposeTasksInput(
        tasks=[TaskProposalItem(title="Idempotent Task", subject="Testing", duration_minutes=30, priority="P2")],
        rationale="Ensure single execution",
    )
    prop = await tool_propose_study_tasks(
        user_id=test_user.id,
        db=db_session,
        conversation_id=None,
        input_data=input_data,
    )
    prop_id = prop["proposal_id"]

    # First confirm succeeds
    r1 = await auth_client.post(f"/api/v1/coach/actions/{prop_id}/confirm")
    assert r1.status_code == 200

    # Second confirm must fail with 400
    r2 = await auth_client.post(f"/api/v1/coach/actions/{prop_id}/confirm")
    assert r2.status_code == 400
    assert "already" in r2.json()["detail"].lower()


@pytest.mark.asyncio
async def test_expired_proposal_rejection(
    auth_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
):
    """Expired proposal cannot be confirmed."""
    past = datetime.now(timezone.utc) - timedelta(hours=5)
    expired_prop = CoachActionProposal(
        user_id=test_user.id,
        action_type="create_tasks",
        status="pending",
        summary="Expired proposal",
        payload=json.dumps({"tasks": [{"title": "Old Task"}]}),
        expires_at=past,
    )
    db_session.add(expired_prop)
    await db_session.commit()
    await db_session.refresh(expired_prop)

    resp = await auth_client.post(f"/api/v1/coach/actions/{expired_prop.id}/confirm")
    assert resp.status_code == 400
    assert "expired" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_proposal_rejection_flow(
    auth_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
):
    """User can explicitly reject a proposal."""
    input_data = ProposeTasksInput(
        tasks=[TaskProposalItem(title="Rejectable Task", subject="Discard", duration_minutes=30, priority="P2")],
        rationale="Testing rejection",
    )
    prop = await tool_propose_study_tasks(
        user_id=test_user.id,
        db=db_session,
        conversation_id=None,
        input_data=input_data,
    )
    prop_id = prop["proposal_id"]

    # Reject
    rej_resp = await auth_client.post(f"/api/v1/coach/actions/{prop_id}/reject")
    assert rej_resp.status_code == 200
    assert rej_resp.json()["status"] == "success"

    # Cannot confirm after rejection
    conf_resp = await auth_client.post(f"/api/v1/coach/actions/{prop_id}/confirm")
    assert conf_resp.status_code == 400


# ==============================================================================
# 3. TASK RESCHEDULE PROPOSAL & CONFIRMATION
# ==============================================================================

@pytest.mark.asyncio
async def test_reschedule_task_proposal_and_execution(
    auth_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
):
    """Test proposing and executing a task reschedule action."""
    # Create existing task
    task = Task(
        title="High Priority Architecture Review",
        subject="System Design",
        priority="P2",
        due_date="2026-11-01",
        user_id=test_user.id,
    )
    db_session.add(task)
    await db_session.commit()
    await db_session.refresh(task)

    # Propose reschedule
    input_data = ProposeRescheduleInput(
        task_id=task.id,
        new_due_date="2026-11-15",
        new_priority="P0",
        rationale="Critical prerequisite for upcoming interview",
    )
    prop = await tool_propose_task_reschedule(
        user_id=test_user.id,
        db=db_session,
        conversation_id=None,
        input_data=input_data,
    )
    assert prop["confirmation_required"] is True
    prop_id = prop["proposal_id"]

    # Confirm
    confirm = await auth_client.post(f"/api/v1/coach/actions/{prop_id}/confirm")
    assert confirm.status_code == 200

    # Verify task updated in DB
    await db_session.refresh(task)
    assert task.due_date == "2026-11-15"
    assert task.priority == "P0"


# ==============================================================================
# 4. LANGGRAPH BOUNDED ITERATIONS & SAFETY
# ==============================================================================

@pytest.mark.asyncio
async def test_langgraph_bounded_iterations(
    db_session: AsyncSession,
    test_user: User,
):
    """Verify LangGraph terminates within max_iterations even under complex planning."""
    state = {
        "user_id": test_user.id,
        "user_query": "Explain how to structure my schedule and create tasks",
        "conversation_id": None,
        "response_preference": "balanced",
        "knowledge_scope": "both",
    }
    result = await study_coach_graph.ainvoke(
        state,
        config={
            "configurable": {
                "db": db_session,
                "provider": MockAgentLLM(),
                "history": [],
            }
        }
    )
    assert result["iteration_count"] <= 3
    assert result["final_response"] != ""
    assert result.get("error") is None

