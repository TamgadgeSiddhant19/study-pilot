import io
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.task import Task
from app.models.roadmap import Roadmap, RoadmapTopic, UserTopicProgress
from app.services.rag.embeddings import MockEmbeddingProvider, set_embedding_provider_override
from app.services.llm import LLMProvider, LLMResponse, set_llm_provider_override


class TestCoachMockLLM(LLMProvider):
    @property
    def provider_name(self) -> str:
        return "mock-coach"

    @property
    def model_name(self) -> str:
        return "mock-model"

    async def generate_chat_response(self, messages, system_instruction=None, **kwargs) -> LLMResponse:
        return LLMResponse(
            content="Mock coach reply for multi-user test.",
            model=self.model_name,
            grounding_source="Test Mock",
        )

    async def health_check(self):
        return {"status": "ok"}


@pytest.fixture(autouse=True)
def configure_mock_providers():
    set_embedding_provider_override(MockEmbeddingProvider())
    set_llm_provider_override(TestCoachMockLLM())
    yield
    set_embedding_provider_override(None)
    set_llm_provider_override(None)


# ==============================================================================
# 1. TASK ISOLATION & OWNERSHIP
# ==============================================================================

@pytest.mark.asyncio
async def test_task_isolation_between_users(
    auth_client: AsyncClient,
    auth_client_b: AsyncClient,
    test_user: User,
    test_user_b: User,
):
    """
    User A creates a task.
    User A can read and update it.
    User B cannot read, update, complete, or delete User A's task (returns 404).
    User B's task list does not contain User A's task.
    """
    # 1. User A creates task
    create_resp = await auth_client.post(
        "/api/v1/tasks",
        json={
            "title": "User A Distributed Consensus Task",
            "subject": "Distributed Systems",
            "description": "Raft protocol review",
            "priority": "P0",
            "estimated_minutes": 90,
        },
    )
    assert create_resp.status_code == 201
    task_a = create_resp.json()
    task_a_id = task_a["id"]
    assert task_a["title"] == "User A Distributed Consensus Task"

    # 2. User A can read it
    read_resp = await auth_client.get(f"/api/v1/tasks/{task_a_id}")
    assert read_resp.status_code == 200
    assert read_resp.json()["id"] == task_a_id

    # 3. User B cannot read User A's task
    b_read_resp = await auth_client_b.get(f"/api/v1/tasks/{task_a_id}")
    assert b_read_resp.status_code == 404
    assert "not found" in b_read_resp.json()["detail"].lower()

    # 4. User B cannot update User A's task
    b_patch_resp = await auth_client_b.patch(
        f"/api/v1/tasks/{task_a_id}",
        json={"title": "Hacked Title"},
    )
    assert b_patch_resp.status_code == 404

    # 5. User B cannot complete User A's task
    b_complete_resp = await auth_client_b.patch(
        f"/api/v1/tasks/{task_a_id}",
        json={"completed": True},
    )
    assert b_complete_resp.status_code == 404

    # 6. User B cannot delete User A's task
    b_delete_resp = await auth_client_b.delete(f"/api/v1/tasks/{task_a_id}")
    assert b_delete_resp.status_code == 404

    # 7. User B task list does not contain User A's task
    b_list_resp = await auth_client_b.get("/api/v1/tasks")
    assert b_list_resp.status_code == 200
    b_task_ids = [t["id"] for t in b_list_resp.json()]
    assert task_a_id not in b_task_ids

    # 8. User A deletes their own task successfully
    a_delete_resp = await auth_client.delete(f"/api/v1/tasks/{task_a_id}")
    assert a_delete_resp.status_code == 204


# ==============================================================================
# 2. FOCUS SESSIONS & CROSS-USER TASK ASSOCIATION
# ==============================================================================

@pytest.mark.asyncio
async def test_session_isolation_and_task_protection(
    auth_client: AsyncClient,
    auth_client_b: AsyncClient,
    test_user: User,
    test_user_b: User,
):
    """
    User A creates a task.
    User B cannot associate a study session with User A's task (returns 404).
    User A logs a study session; User B's focus stats remain at 0.
    """
    # Create task for User A
    task_resp = await auth_client.post(
        "/api/v1/tasks",
        json={"title": "User A Kernel Hacking", "subject": "OS", "priority": "P1"},
    )
    assert task_resp.status_code == 201
    task_a_id = task_resp.json()["id"]

    # User B attempts to log session referencing User A's task
    b_session_resp = await auth_client_b.post(
        "/api/v1/sessions",
        json={
            "task_id": task_a_id,
            "subject": "OS",
            "duration_minutes": 45,
            "session_type": "deep_work",
            "notes": "Unauthorized attempt",
        },
    )
    assert b_session_resp.status_code == 404
    assert "not found" in b_session_resp.json()["detail"].lower()

    # User A logs a valid session
    a_session_resp = await auth_client.post(
        "/api/v1/sessions",
        json={
            "task_id": task_a_id,
            "subject": "OS",
            "duration_minutes": 60,
            "session_type": "deep_work",
            "notes": "Legitimate focus session",
        },
    )
    assert a_session_resp.status_code == 201

    # User A sees focus stats
    a_stats_resp = await auth_client.get("/api/v1/sessions/stats")
    assert a_stats_resp.status_code == 200
    assert a_stats_resp.json()["total_sessions_today"] >= 1
    assert a_stats_resp.json()["total_minutes_today"] >= 60

    # User B focus stats must be empty (0 sessions, 0 minutes)
    b_stats_resp = await auth_client_b.get("/api/v1/sessions/stats")
    assert b_stats_resp.status_code == 200
    assert b_stats_resp.json()["total_sessions_today"] == 0
    assert b_stats_resp.json()["total_minutes_today"] == 0


# ==============================================================================
# 3. LEETCODE PROBLEMS ISOLATION
# ==============================================================================

@pytest.mark.asyncio
async def test_leetcode_problem_isolation(
    auth_client: AsyncClient,
    auth_client_b: AsyncClient,
    test_user: User,
    test_user_b: User,
):
    """
    User A logs a LeetCode problem.
    User B cannot view, update, review, or delete it (returns 404).
    User B's leetcode stats show 0 problems solved.
    """
    # User A logs problem
    lc_resp = await auth_client.post(
        "/api/v1/leetcode",
        json={
            "problem_number": 42,
            "title": "Trapping Rain Water",
            "difficulty": "Hard",
            "status": "Solved",
            "pattern": "two_pointers",
        },
    )
    assert lc_resp.status_code == 201
    prob_id = lc_resp.json()["id"]

    # User B list problems should not contain problem 42
    b_list = await auth_client_b.get("/api/v1/leetcode")
    assert b_list.status_code == 200
    b_ids = [p["id"] for p in b_list.json()]
    assert prob_id not in b_ids

    # User B cannot update problem
    b_put = await auth_client_b.patch(
        f"/api/v1/leetcode/{prob_id}",
        json={"notes": "Exploit note"},
    )
    assert b_put.status_code == 404

    # User B cannot review problem
    b_rev = await auth_client_b.post(
        f"/api/v1/leetcode/{prob_id}/review",
        json={"quality": 5},
    )
    assert b_rev.status_code == 404

    # User B cannot delete problem
    b_del = await auth_client_b.delete(f"/api/v1/leetcode/{prob_id}")
    assert b_del.status_code == 404

    # User B stats must reflect 0
    b_stats = await auth_client_b.get("/api/v1/leetcode/stats")
    assert b_stats.status_code == 200
    assert b_stats.json()["total_solved"] == 0


# ==============================================================================
# 4. LEARNING RESOURCES ISOLATION
# ==============================================================================

@pytest.mark.asyncio
async def test_resource_isolation(
    auth_client: AsyncClient,
    auth_client_b: AsyncClient,
    test_user: User,
    test_user_b: User,
):
    """
    User A creates a private learning resource.
    User B cannot list, update, or delete it.
    """
    res_resp = await auth_client.post(
        "/api/v1/resources",
        json={
            "title": "User A Private Distributed Systems Book",
            "url": "https://example.com/private-book",
            "category": "book",
            "subject": "Distributed Systems",
            "status": "reading",
        },
    )
    assert res_resp.status_code == 201
    res_id = res_resp.json()["id"]

    # User B list does not contain it
    b_list = await auth_client_b.get("/api/v1/resources")
    assert b_list.status_code == 200
    assert res_id not in [r["id"] for r in b_list.json()]

    # User B cannot update
    b_patch = await auth_client_b.patch(
        f"/api/v1/resources/{res_id}",
        json={"status": "completed"},
    )
    assert b_patch.status_code == 404

    # User B cannot delete
    b_del = await auth_client_b.delete(f"/api/v1/resources/{res_id}")
    assert b_del.status_code == 404


# ==============================================================================
# 5. ROADMAP TOPIC PROGRESS ISOLATION
# ==============================================================================

@pytest.mark.asyncio
async def test_roadmap_topic_mastery_isolation(
    auth_client: AsyncClient,
    auth_client_b: AsyncClient,
    db_session: AsyncSession,
):
    """
    Roadmaps are shared curriculum templates, but user progress is strictly isolated.
    User A marks a topic as mastered (100%).
    User B sees that topic as not_started (0%).
    """
    # Seed a test roadmap and topic
    roadmap = Roadmap(
        title="Test Cloud Architecture",
        slug="test-cloud-arch",
        category="cloud",
    )
    db_session.add(roadmap)
    await db_session.flush()

    topic = RoadmapTopic(
        roadmap_id=roadmap.id,
        title="Event-Driven Microservices",
        category="Architecture",
        order_index=1,
        estimated_hours=4,
    )
    db_session.add(topic)
    await db_session.commit()
    await db_session.refresh(topic)

    # User A updates mastery to 100%
    a_update = await auth_client.patch(
        f"/api/v1/roadmaps/topics/{topic.id}",
        json={"status": "mastered", "mastery_percentage": 100},
    )
    assert a_update.status_code == 200
    assert a_update.json()["status"] == "mastered"
    assert a_update.json()["mastery_percentage"] == 100

    # User A sees 100% mastery
    a_roadmaps = await auth_client.get("/api/v1/roadmaps")
    assert a_roadmaps.status_code == 200
    a_curricula = a_roadmaps.json()
    a_matched_roadmap = next((r for r in a_curricula if r["slug"] == "test-cloud-arch"), None)
    assert a_matched_roadmap is not None
    assert a_matched_roadmap["topics"][0]["status"] == "mastered"
    assert a_matched_roadmap["topics"][0]["mastery_percentage"] == 100

    # User B queries the roadmap -> MUST see not_started and 0%
    b_roadmaps = await auth_client_b.get("/api/v1/roadmaps")
    assert b_roadmaps.status_code == 200
    b_curricula = b_roadmaps.json()
    b_matched_roadmap = next((r for r in b_curricula if r["slug"] == "test-cloud-arch"), None)
    assert b_matched_roadmap is not None
    assert b_matched_roadmap["topics"][0]["status"] == "not_started"
    assert b_matched_roadmap["topics"][0]["mastery_percentage"] == 0


# ==============================================================================
# 6. COACH CONVERSATIONS & CONTEXT RESET ISOLATION
# ==============================================================================

@pytest.mark.asyncio
async def test_coach_conversations_and_reset_isolation(
    auth_client: AsyncClient,
    auth_client_b: AsyncClient,
):
    """
    User A chats with Study Coach.
    User B cannot hijack or send messages to User A's conversation ID (returns 404).
    User B's conversation list is empty.
    User A resetting coach context does not affect User B's conversations.
    """
    # User A sends a message
    a_chat = await auth_client.post(
        "/api/v1/coach/chat",
        json={"message": "Help me understand CAP theorem."},
    )
    assert a_chat.status_code == 200
    conv_id = a_chat.json()["conversation_id"]
    assert conv_id is not None

    # User A sees conversation
    a_convs = await auth_client.get("/api/v1/coach/conversations")
    assert a_convs.status_code == 200
    assert any(c["id"] == conv_id for c in a_convs.json())

    # User B list conversations is empty
    b_convs = await auth_client_b.get("/api/v1/coach/conversations")
    assert b_convs.status_code == 200
    assert not any(c["id"] == conv_id for c in b_convs.json())

    # User B cannot append message to User A's conversation
    b_chat = await auth_client_b.post(
        "/api/v1/coach/chat",
        json={"message": "Infiltrating conversation", "conversation_id": conv_id},
    )
    assert b_chat.status_code == 404
    assert "not found" in b_chat.json()["detail"].lower()

    # User B creates their own conversation
    b_own_chat = await auth_client_b.post(
        "/api/v1/coach/chat",
        json={"message": "What is Python GIL?"},
    )
    assert b_own_chat.status_code == 200
    b_conv_id = b_own_chat.json()["conversation_id"]
    assert b_conv_id != conv_id

    # User A resets their context
    a_reset = await auth_client.post("/api/v1/coach/reset")
    assert a_reset.status_code == 200

    # User A now has 0 conversations
    a_convs_after = await auth_client.get("/api/v1/coach/conversations")
    assert len(a_convs_after.json()) == 0

    # User B's conversation remains intact
    b_convs_after = await auth_client_b.get("/api/v1/coach/conversations")
    assert any(c["id"] == b_conv_id for c in b_convs_after.json())


# ==============================================================================
# 7. RAG KNOWLEDGE BASE & RETRIEVAL ISOLATION
# ==============================================================================

@pytest.mark.asyncio
async def test_rag_knowledge_document_and_retrieval_isolation(
    auth_client: AsyncClient,
    auth_client_b: AsyncClient,
):
    """
    User A uploads a private study document.
    User B cannot retrieve or delete it.
    User B semantic search NEVER returns chunks from User A's document.
    """
    doc_content = b"# Proprietary Paxos Notes\n\nPaxos achieves consensus in asynchronous networks using proposer, acceptor, and learner roles."
    files = {"file": ("paxos_notes.md", doc_content, "text/markdown")}

    # User A uploads document
    upload_resp = await auth_client.post("/api/v1/knowledge/documents", files=files)
    assert upload_resp.status_code == 201
    doc_a = upload_resp.json()
    doc_a_id = doc_a["id"]

    # User A lists document
    a_docs = await auth_client.get("/api/v1/knowledge/documents")
    assert a_docs.status_code == 200
    assert any(d["id"] == doc_a_id for d in a_docs.json()["documents"])

    # User B list documents has 0 or doesn't have doc_a_id
    b_docs = await auth_client_b.get("/api/v1/knowledge/documents")
    assert b_docs.status_code == 200
    assert not any(d["id"] == doc_a_id for d in b_docs.json()["documents"])

    # User B cannot get document details
    b_get_doc = await auth_client_b.get(f"/api/v1/knowledge/documents/{doc_a_id}")
    assert b_get_doc.status_code == 404

    # User B cannot delete document
    b_del_doc = await auth_client_b.delete(f"/api/v1/knowledge/documents/{doc_a_id}")
    assert b_del_doc.status_code == 404

    # User A searches for "consensus in asynchronous networks" -> finds it
    a_search = await auth_client.post(
        "/api/v1/knowledge/search",
        json={"query": "consensus in asynchronous networks", "top_k": 3},
    )
    assert a_search.status_code == 200
    assert a_search.json()["total_found"] > 0
    assert any(r["document_id"] == doc_a_id for r in a_search.json()["results"])

    # User B searches for "consensus in asynchronous networks" -> MUST RETURN 0 RESULTS
    b_search = await auth_client_b.post(
        "/api/v1/knowledge/search",
        json={"query": "consensus in asynchronous networks", "top_k": 3},
    )
    assert b_search.status_code == 200
    assert b_search.json()["total_found"] == 0
    assert len(b_search.json()["results"]) == 0


# ==============================================================================
# 8. DASHBOARD ANALYTICS & EMPTY STATES ISOLATION
# ==============================================================================

@pytest.mark.asyncio
async def test_dashboard_analytics_isolation(
    auth_client: AsyncClient,
    auth_client_b: AsyncClient,
    test_user: User,
    test_user_b: User,
):
    """
    User A has tasks and study sessions recorded.
    User B has zero tasks and zero sessions.
    User A dashboard shows active metrics.
    User B dashboard shows genuine empty state (0 tasks, 0 flight hours, 0 streak).
    """
    # User A creates and completes a task
    t_resp = await auth_client.post(
        "/api/v1/tasks",
        json={"title": "Analytics Task A", "subject": "Backend", "priority": "P1"},
    )
    assert t_resp.status_code == 201
    task_id = t_resp.json()["id"]
    await auth_client.patch(f"/api/v1/tasks/{task_id}", json={"completed": True})

    # User A logs session
    await auth_client.post(
        "/api/v1/sessions",
        json={"subject": "Backend", "duration_minutes": 120, "session_type": "deep_work"},
    )

    # User A overview dashboard
    a_dash = await auth_client.get("/api/v1/analytics/overview")
    assert a_dash.status_code == 200
    a_data = a_dash.json()
    assert a_data["milestones_completed"] >= 1
    assert a_data["flight_hours_today"] >= 2.0

    # User B overview dashboard -> MUST SHOW EMPTY STATE (0 completed, 0 flight hours)
    b_dash = await auth_client_b.get("/api/v1/analytics/overview")
    assert b_dash.status_code == 200
    b_data = b_dash.json()
    assert b_data["candidate_name"] == test_user_b.full_name
    assert b_data["milestones_completed"] == 0
    assert b_data["flight_hours_today"] == 0.0
    assert b_data["streak_days"] == 0
