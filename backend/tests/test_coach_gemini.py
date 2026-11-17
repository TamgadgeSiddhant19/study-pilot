import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock, patch
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task
from app.models.user import User
from app.models.coach import CoachConversation, CoachMessage
from app.services.llm import (
    LLMProvider,
    LLMResponse,
    LLMQuotaExceededError,
    LLMTimeoutError,
    LLMConfigurationError,
    set_llm_provider_override,
    coach_rate_limiter,
)
from app.services.llm.langchain_provider import LangChainGeminiProvider


class MockGeminiProvider(LLMProvider):
    """Mock Gemini provider for hermetic automated tests without paid external API calls."""

    def __init__(self, response_text: str = "Mocked Gemini explanation on HNSW vs IVF indexing."):
        self.response_text = response_text
        self.call_count = 0
        self.last_messages = []
        self.last_system_instruction = None

    @property
    def provider_name(self) -> str:
        return "gemini-langchain"

    @property
    def model_name(self) -> str:
        return "gemini-2.5-flash"

    async def generate_chat_response(
        self,
        messages,
        system_instruction=None,
        **kwargs,
    ) -> LLMResponse:
        self.call_count += 1
        self.last_messages = messages
        self.last_system_instruction = system_instruction

        return LLMResponse(
            content=self.response_text,
            model=self.model_name,
            finish_reason="STOP",
            input_tokens=42,
            output_tokens=85,
            inference_ms=120,
            grounding_source="Google Gemini via LangChain (gemini-2.5-flash)",
        )

    async def health_check(self):
        return {
            "provider": self.provider_name,
            "model": self.model_name,
            "configured": True,
            "status": "ready",
            "timeout_seconds": 30,
        }


@pytest.fixture(autouse=True)
def clean_llm_state():
    """Ensure rate limiter and LLM provider overrides are reset after each test."""
    set_llm_provider_override(None)
    yield
    set_llm_provider_override(None)


@pytest.mark.asyncio
async def test_coach_health_check_safe_no_secrets(client: AsyncClient):
    """Test GET /api/v1/coach/health returns status without revealing secrets."""
    response = await client.get("/api/v1/coach/health")
    assert response.status_code == 200
    data = response.json()
    assert "provider" in data
    assert "model" in data
    assert "configured" in data
    assert "status" in data
    assert "timeout_seconds" in data
    # Confirm secrets are NEVER present in health payload
    assert "api_key" not in data
    assert "secret" not in data


@pytest.mark.asyncio
async def test_coach_chat_unauthenticated_rejected(client: AsyncClient):
    """Test POST /api/v1/coach/chat rejects unauthenticated requests with 401."""
    payload = {"message": "Can you explain Dijkstra algorithm?"}
    response = await client.post("/api/v1/coach/chat", json=payload)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_coach_chat_input_validation(auth_client: AsyncClient):
    """Test input limits (empty message rejected, >4000 chars rejected)."""
    # Empty message
    res_empty = await auth_client.post("/api/v1/coach/chat", json={"message": ""})
    assert res_empty.status_code == 422

    # Exceedingly long message (>4000 characters)
    too_long = "x" * 4001
    res_long = await auth_client.post("/api/v1/coach/chat", json={"message": too_long})
    assert res_long.status_code == 422


@pytest.mark.asyncio
async def test_coach_chat_success_with_mocked_gemini(auth_client: AsyncClient):
    """Test authenticated chat with mocked Gemini provider via LangChain."""
    mock_provider = MockGeminiProvider("HNSW creates a multi-layer graph for fast similarity search.")
    set_llm_provider_override(mock_provider)

    payload = {
        "message": "Explain HNSW indexing trade-offs.",
        "response_preference": "balanced",
    }
    response = await auth_client.post("/api/v1/coach/chat", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["role"] == "assistant"
    assert "HNSW creates a multi-layer graph" in data["content"]
    assert "Gemini" in data["grounding_source"]
    assert data["conversation_id"] is not None
    assert mock_provider.call_count == 1


@pytest.mark.asyncio
async def test_coach_chat_grounded_in_user_study_data(
    auth_client: AsyncClient, test_user: User, db_session: AsyncSession
):
    """Test that authenticated user's actual database progress is injected into system instruction."""
    # Isolate tasks for test_user so this test is order-independent
    await db_session.execute(delete(Task).where(Task.user_id == test_user.id))
    await db_session.commit()

    # Seed a real task for test_user
    task = Task(
        title="Master Kahn BFS Algorithm",
        subject="DSA - Graphs",
        priority="P0",
        status="todo",
        completed=False,
        user_id=test_user.id,
    )
    db_session.add(task)
    await db_session.commit()

    mock_provider = MockGeminiProvider()
    set_llm_provider_override(mock_provider)

    payload = {"message": "What should I study next?"}
    response = await auth_client.post("/api/v1/coach/chat", json=payload)
    assert response.status_code == 200

    # Verify that the system instruction was passed user's actual name and tasks
    assert mock_provider.last_system_instruction is not None
    assert test_user.full_name in mock_provider.last_system_instruction
    assert "Master Kahn BFS Algorithm" in mock_provider.last_system_instruction


@pytest.mark.asyncio
async def test_coach_chat_response_preference_adaptation(auth_client: AsyncClient):
    """Test that response_preference adjusts prompt instruction."""
    mock_provider = MockGeminiProvider()
    set_llm_provider_override(mock_provider)

    # Step-by-step
    await auth_client.post(
        "/api/v1/coach/chat",
        json={"message": "Explain quicksort", "response_preference": "step_by_step"},
    )
    assert "STEP-BY-STEP TEACHING" in mock_provider.last_system_instruction

    # Concise
    await auth_client.post(
        "/api/v1/coach/chat",
        json={"message": "Explain quicksort", "response_preference": "concise"},
    )
    assert "RESPONSE STYLE: CONCISE" in mock_provider.last_system_instruction


@pytest.mark.asyncio
async def test_coach_chat_rate_limiting(auth_client: AsyncClient, test_user: User):
    """Test that exceeding per-user rate limit returns 429 Too Many Requests."""
    mock_provider = MockGeminiProvider()
    set_llm_provider_override(mock_provider)

    user_key = f"user_{test_user.id}"
    coach_rate_limiter.reset_for(user_key)

    # Send requests up to limit
    for i in range(coach_rate_limiter.max_requests):
        res = await auth_client.post("/api/v1/coach/chat", json={"message": f"Query {i}"})
        assert res.status_code == 200

    # Next request should be rate-limited
    res_limited = await auth_client.post("/api/v1/coach/chat", json={"message": "Exceeded"})
    assert res_limited.status_code == 429
    assert "Rate limit exceeded" in res_limited.json()["detail"]
    assert "Retry-After" in res_limited.headers

    # Reset after test
    coach_rate_limiter.reset_for(user_key)


@pytest.mark.asyncio
async def test_coach_chat_honest_error_on_unconfigured_key(auth_client: AsyncClient):
    """Test honest 503 error response when Gemini API key is missing (no fake simulations)."""
    unconfigured_provider = LangChainGeminiProvider(api_key="")
    set_llm_provider_override(unconfigured_provider)

    payload = {"message": "Can you explain dynamic programming memoization?"}
    response = await auth_client.post("/api/v1/coach/chat", json=payload)
    assert response.status_code == 503
    data = response.json()
    assert "unconfigured" in data["detail"].lower() or "not configured" in data["detail"].lower()


@pytest.mark.asyncio
async def test_coach_chat_honest_error_on_quota_exhaustion(auth_client: AsyncClient):
    """Test honest 429 error response when Gemini quota is exhausted (no fake simulations)."""
    failing_provider = AsyncMock(spec=LLMProvider)
    failing_provider.provider_name = "gemini-langchain"
    failing_provider.model_name = "gemini-2.5-flash"
    failing_provider.generate_chat_response.side_effect = LLMQuotaExceededError("Rate limit reached")

    set_llm_provider_override(failing_provider)

    payload = {"message": "How does topological sorting work?"}
    response = await auth_client.post("/api/v1/coach/chat", json=payload)
    assert response.status_code == 429
    data = response.json()
    assert "quota" in data["detail"].lower() or "rate limit" in data["detail"].lower()


@pytest.mark.asyncio
async def test_coach_chat_honest_error_on_timeout(auth_client: AsyncClient):
    """Test honest 504 error response on provider timeout."""
    timing_out_provider = AsyncMock(spec=LLMProvider)
    timing_out_provider.provider_name = "gemini-langchain"
    timing_out_provider.model_name = "gemini-2.5-flash"
    timing_out_provider.generate_chat_response.side_effect = LLMTimeoutError("Inference timed out after 30s")

    set_llm_provider_override(timing_out_provider)

    payload = {"message": "Design a distributed cache"}
    response = await auth_client.post("/api/v1/coach/chat", json=payload)
    assert response.status_code == 504
    data = response.json()
    assert "timed out" in data["detail"].lower()


@pytest.mark.asyncio
async def test_coach_chat_conversation_continuity(auth_client: AsyncClient, db_session: AsyncSession):
    """Test conversation creation and continuing existing conversation via conversation_id."""
    mock_provider = MockGeminiProvider("First turn answer.")
    set_llm_provider_override(mock_provider)

    # 1. Start fresh conversation
    res1 = await auth_client.post("/api/v1/coach/chat", json={"message": "First question"})
    assert res1.status_code == 200
    conv_id = res1.json()["conversation_id"]
    assert conv_id is not None

    # 2. Continue the same conversation
    mock_provider.response_text = "Second turn answer."
    res2 = await auth_client.post(
        "/api/v1/coach/chat",
        json={"message": "Follow-up question", "conversation_id": conv_id},
    )
    assert res2.status_code == 200
    assert res2.json()["conversation_id"] == conv_id

    # 3. Retrieve conversations list and verify messages
    convs_res = await auth_client.get("/api/v1/coach/conversations")
    assert convs_res.status_code == 200
    conv_list = convs_res.json()
    matching = [c for c in conv_list if c["id"] == conv_id]
    assert len(matching) == 1
    # Should have user1, assistant1, user2, assistant2
    assert len(matching[0]["messages"]) >= 4


@pytest.mark.asyncio
async def test_coach_plan_generation_and_application(
    auth_client: AsyncClient, test_user: User, db_session: AsyncSession
):
    """Test deterministic study plan generation and applying it to authenticated user tasks."""
    plan_payload = {
        "learning_goal": "AI Systems & LLM Inference",
        "available_hours_per_day": 3.0,
        "deadline_days": 14,
        "current_skill_level": "Intermediate",
    }
    plan_res = await auth_client.post("/api/v1/coach/plan", json=plan_payload)
    assert plan_res.status_code == 200
    plan_data = plan_res.json()

    assert plan_data["target_role"] == "AI Systems & LLM Inference"
    assert plan_data["feasibility_score"] >= 0
    assert len(plan_data["proposed_tasks"]) > 0

    # Apply the proposed plan
    apply_res = await auth_client.post("/api/v1/coach/plan/apply", json=plan_data)
    assert apply_res.status_code == 201
    assert apply_res.json()["tasks_created"] == len(plan_data["proposed_tasks"])

    # Verify tasks are assigned to test_user in DB
    created_tasks_res = await db_session.execute(
        select(Task).where(Task.user_id == test_user.id)
    )
    created_tasks = created_tasks_res.scalars().all()
    assert len(created_tasks) >= len(plan_data["proposed_tasks"])
