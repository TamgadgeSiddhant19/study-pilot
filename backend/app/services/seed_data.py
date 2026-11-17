import asyncio
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal, engine, Base
from app.core.security import hash_password
from app.models.user import User
from app.models.roadmap import Roadmap, RoadmapTopic
from app.models.task import Task
from app.models.session import StudySession
from app.models.leetcode import LeetCodeProblem
from app.models.resource import LearningResource
from app.models.coach import CoachConversation, CoachMessage


async def seed_database(db: AsyncSession):
    # Check if already seeded
    existing_roadmaps = await db.scalar(select(func.count(Roadmap.id)))
    if existing_roadmaps and existing_roadmaps > 0:
        return {"status": "already_seeded", "message": "Database already contains seed data."}

    now = datetime.now(timezone.utc)

    # 0. User Profile (Default Learner)
    user = User(
        email="elena.rostova@studypilot.ai",
        password_hash=hash_password("ElenaPilot2026!"),
        full_name="Elena Rostova",
        account_type="professional",
        current_role="AI Systems Engineer",
        experience_range="3-5 years",
        skill_level="Advanced",
        target_role="AI Systems Engineer",
        target_date="Nov 15",
        daily_flight_quota_hours=4.0,
        is_onboarded=True,
        is_active=True,
    )
    db.add(user)
    await db.flush()

    # 1. Roadmaps & Topics
    ai_roadmap = Roadmap(
        title="AI Systems Engineer",
        slug="ai-systems",
        description="Core architectures, vector index acceleration, RAG, and LLM inference optimization.",
        category="Artificial Intelligence",
        icon="psychology",
        color="#8083ff"
    )
    dsa_roadmap = Roadmap(
        title="DSA Masterclass",
        slug="dsa",
        description="High-frequency algorithmic paradigms, amortized complexities, and graph theory.",
        category="Computer Science",
        icon="code",
        color="#4edea3"
    )
    sys_roadmap = Roadmap(
        title="System Design & Scalability",
        slug="system-design",
        description="Distributed consensus, caching layers, write-heavy databases, and low-latency APIs.",
        category="Architecture",
        icon="account_tree",
        color="#93ccff"
    )

    db.add_all([ai_roadmap, dsa_roadmap, sys_roadmap])
    await db.flush()

    # Topics for AI Systems
    ai_topics = [
        RoadmapTopic(roadmap_id=ai_roadmap.id, title="Vector Embeddings & Metric Spaces", category="Vector Search", order_index=1, status="mastered", mastery_percentage=100, estimated_hours=4.0),
        RoadmapTopic(roadmap_id=ai_roadmap.id, title="HNSW Graph Indexing vs IVFFlat", category="Vector DBs", order_index=2, status="in_progress", mastery_percentage=65, estimated_hours=6.0),
        RoadmapTopic(roadmap_id=ai_roadmap.id, title="Graph Neural Networks & PageRank Ingestion", category="Graph AI", order_index=3, status="in_progress", mastery_percentage=40, estimated_hours=8.0),
        RoadmapTopic(roadmap_id=ai_roadmap.id, title="LLM Inference Quantization & PagedAttention", category="Inference Systems", order_index=4, status="not_started", mastery_percentage=0, estimated_hours=5.0),
    ]
    # Topics for DSA
    dsa_topics = [
        RoadmapTopic(roadmap_id=dsa_roadmap.id, title="Topological Sort & Kahn's Algorithm", category="Graphs", order_index=1, status="mastered", mastery_percentage=100, estimated_hours=3.0),
        RoadmapTopic(roadmap_id=dsa_roadmap.id, title="Dynamic Programming on Trees & DAGs", category="Dynamic Programming", order_index=2, status="in_progress", mastery_percentage=50, estimated_hours=6.0),
        RoadmapTopic(roadmap_id=dsa_roadmap.id, title="Monotonic Deque & Sliding Window Maximum", category="Queue & Stacks", order_index=3, status="not_started", mastery_percentage=0, estimated_hours=4.0),
    ]
    db.add_all(ai_topics + dsa_topics)
    await db.flush()

    # 2. Daily Tasks
    tasks = [
        Task(title="Deep-dive: HNSW Graph Indexing & Distance Pruning", subject="AI Systems", priority="P0", status="in_progress", completed=False, estimated_minutes=60, actual_minutes=45, due_date="Today", roadmap_topic_id=ai_topics[1].id, user_id=user.id),
        Task(title="Solve LeetCode #207 (Course Schedule - Kahn's Algorithm)", subject="DSA - Graphs", priority="P0", status="completed", completed=True, estimated_minutes=30, actual_minutes=30, due_date="Today", completed_at=now - timedelta(hours=3), roadmap_topic_id=dsa_topics[0].id, user_id=user.id),
        Task(title="Implement PageRank matrix power iteration test suite", subject="AI Systems", priority="P1", status="todo", completed=False, estimated_minutes=45, actual_minutes=0, due_date="Today", roadmap_topic_id=ai_topics[2].id, user_id=user.id),
        Task(title="Review FlashAttention v2 forward pass kernel notes", subject="LLM Systems", priority="P1", status="completed", completed=True, estimated_minutes=45, actual_minutes=45, due_date="Today", completed_at=now - timedelta(hours=5), user_id=user.id),
        Task(title="Benchmark Pinecone vs FAISS on 100k 1536-dim vectors", subject="Benchmarking", priority="P1", status="completed", completed=True, estimated_minutes=60, actual_minutes=60, due_date="Today", completed_at=now - timedelta(hours=2), user_id=user.id),
        Task(title="Spaced Repetition review: Daily Temperatures (LC #739)", subject="DSA - Stacks", priority="P2", status="completed", completed=True, estimated_minutes=30, actual_minutes=30, due_date="Today", completed_at=now - timedelta(hours=1), user_id=user.id),
    ]
    db.add_all(tasks)

    # 3. Focus Sessions (Total 210 mins = 3.5h, matching Stitch display!)
    sessions = [
        StudySession(subject="DSA - Course Schedule", duration_minutes=45, session_type="pomodoro", notes="Kahn's BFS cycle detection"),
        StudySession(subject="AI Systems - Vector Search", duration_minutes=60, session_type="deep_work", notes="HNSW heuristic edge selection"),
        StudySession(subject="LLM Systems - FlashAttention", duration_minutes=45, session_type="pomodoro", notes="Tiling and SRAM bandwidth"),
        StudySession(subject="Benchmarking - Vector DBs", duration_minutes=60, session_type="deep_work", notes="Recall @ 10 latency curve"),
    ]
    db.add_all(sessions)

    # 4. LeetCode Problems (Representing the 248 total, with 4 due for SRS)
    problems = [
        LeetCodeProblem(problem_number=207, title="Course Schedule", difficulty="Medium", topics="Graphs, Topo Sort", pattern="Kahn's Algorithm (BFS)", status="Solved", time_complexity="O(V + E)", space_complexity="O(V + E)", notes="In-degree array + queue. If processed != numCourses, return false.", repetitions=3, interval_days=14, next_review_at=now + timedelta(days=10)),
        LeetCodeProblem(problem_number=146, title="LRU Cache", difficulty="Medium", topics="Design, Linked List", pattern="Doubly Linked List + HashMap", status="Solved", time_complexity="O(1)", space_complexity="O(Capacity)", notes="Always update node position to head upon get or put.", repetitions=4, interval_days=21, next_review_at=now + timedelta(days=15)),
        LeetCodeProblem(problem_number=76, title="Minimum Window Substring", difficulty="Hard", topics="Hash Table, String", pattern="Sliding Window with Target Match Map", status="Solved", time_complexity="O(N)", space_complexity="O(K)", notes="Keep count of characters needed, expand right, shrink left when valid.", repetitions=2, interval_days=6, next_review_at=now + timedelta(days=4)),
        LeetCodeProblem(problem_number=1, title="Two Sum", difficulty="Easy", topics="Array, Hash Table", pattern="Complement Lookup", status="Solved", time_complexity="O(N)", space_complexity="O(N)", notes="Single pass using dictionary.", repetitions=5, interval_days=45, next_review_at=now + timedelta(days=30)),
        # Due for immediate re-solve (SRS queue)
        LeetCodeProblem(problem_number=42, title="Trapping Rain Water", difficulty="Hard", topics="Array, Two Pointers", pattern="Two Pointers / Monotonic Stack", status="Review Needed", time_complexity="O(N)", space_complexity="O(1)", notes="Left and right max pointers. Water trapped is bounded by min(leftMax, rightMax) - height[i].", repetitions=1, interval_days=1, next_review_at=now - timedelta(hours=12)),
        LeetCodeProblem(problem_number=300, title="Longest Increasing Subsequence", difficulty="Medium", topics="Binary Search, DP", pattern="Patience Sorting with Bisect", status="Review Needed", time_complexity="O(N log N)", space_complexity="O(N)", notes="tails array stores smallest tail of all increasing subsequences.", repetitions=2, interval_days=3, next_review_at=now - timedelta(hours=4)),
        LeetCodeProblem(problem_number=124, title="Binary Tree Maximum Path Sum", difficulty="Hard", topics="Trees, DFS", pattern="Post-Order Max Path Split", status="Review Needed", time_complexity="O(N)", space_complexity="O(H)", notes="Gain from child = max(0, dfs(child)). Update global max with split path.", repetitions=1, interval_days=1, next_review_at=now - timedelta(hours=2)),
        LeetCodeProblem(problem_number=200, title="Number of Islands", difficulty="Medium", topics="BFS, DFS, Matrix", pattern="Grid Flood Fill", status="Review Needed", time_complexity="O(M * N)", space_complexity="O(M * N)", notes="Sink visited lands by changing '1' to '0'.", repetitions=2, interval_days=3, next_review_at=now - timedelta(minutes=30)),
    ]
    db.add_all(problems)

    # 5. Resources
    resources = [
        LearningResource(title="Hierarchical Navigable Small World (HNSW) Graphs Explained", url="https://arxiv.org/abs/1603.09320", category="paper", subject="AI Systems", rating=5, notes="Foundational paper for vector search.", status="completed"),
        LearningResource(title="vLLM: Easy, Fast, and Cheap LLM Serving with PagedAttention", url="https://vllm.ai", category="documentation", subject="Systems", rating=5, notes="Essential reading on KV-cache memory fragmentation.", status="reading"),
        LearningResource(title="NeetCode 150 Pattern Guide", url="https://neetcode.io", category="course", subject="DSA", rating=5, notes="Categorized spaced repetition roadmap.", status="reading"),
        LearningResource(title="System Design Interview: An Insider's Guide", url="https://bytebytego.com", category="book", subject="Architecture", rating=5, notes="Distributed caching and messaging.", status="bookmarked"),
    ]
    db.add_all(resources)

    # 6. Initial Coach Conversation
    conv = CoachConversation(
        title="Vector Search & Algorithmic Prep",
        track="AI Systems Engineer"
    )
    db.add(conv)
    await db.flush()

    user_msg = CoachMessage(
        conversation_id=conv.id,
        role="user",
        content="I'm struggling to understand why HNSW graph indexing is preferred over IVFFlat for low-latency vector search in production RAG systems. Can you break down the trade-offs and test me with an interview question?",
        grounding_source=None,
        inference_ms=None,
        depth=None,
        tags="#VectorSearch, #HNSW_vs_IVF"
    )
    asst_msg = CoachMessage(
        conversation_id=conv.id,
        role="assistant",
        content=(
            "At scale, vector indexing is fundamentally about balancing recall accuracy, "
            "query p99 latency, and memory footprint. While IVFFlat groups vectors via k-means "
            "clustering into static Voronoi cells, HNSW builds a multi-layer geometric graph structure "
            "that transforms search into high-speed navigation.\n\n"
            "Key Trade-offs for Production:\n"
            "• Latency: HNSW provides logarithmic search time O(log N) with sub-10ms p99 at 95%+ recall.\n"
            "• Memory: HNSW requires significant RAM to store graph edge lists (typically 1.2x to 2x the raw vector size).\n"
            "• Dynamic Updates: HNSW gracefully accommodates incremental vector insertions without requiring global re-clustering."
        ),
        grounding_source="Grounding Verified: Pinecone & FAISS Benchmarks",
        inference_ms=412,
        depth="High",
        tags="#VectorSearch, #HNSW_vs_IVF"
    )
    db.add_all([user_msg, asst_msg])

    await db.commit()
    return {"status": "success", "message": "Database successfully populated with StudyPilot AI seed data."}


async def main():
    async with AsyncSessionLocal() as session:
        result = await seed_database(session)
        print(result)


if __name__ == "__main__":
    asyncio.run(main())
