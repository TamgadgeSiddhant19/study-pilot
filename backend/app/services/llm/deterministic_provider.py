import time
from typing import List, Dict, Any, Optional

from app.services.llm.base import LLMProvider, LLMResponse


class DeterministicProvider(LLMProvider):
    """
    Deterministic rule-based educational mentor.
    Used for automated unit testing, offline development, and zero-configuration setups.
    """

    def __init__(self, model: str = "rule-based-curriculum-v2"):
        self._model = model

    @property
    def provider_name(self) -> str:
        return "deterministic"

    @property
    def model_name(self) -> str:
        return self._model

    async def generate_chat_response(
        self,
        messages: List[Dict[str, str]],
        system_instruction: Optional[str] = None,
        max_output_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        **kwargs: Any,
    ) -> LLMResponse:
        start_time = time.perf_counter()

        last_user_query = ""
        for msg in reversed(messages):
            if msg.get("role") == "user":
                last_user_query = msg.get("content", "").strip()
                break

        query_lower = last_user_query.lower()

        # Domain concept explanations
        if any(w in query_lower for w in ["hnsw", "ivf", "vector", "embedding"]):
            grounding = "Curriculum Verified: FAISS & Vector Indexing Benchmarks"
            content = (
                "**Vector Indexing & Similarity Search:**\n\n"
                "At scale, vector indexing balances **recall accuracy**, **p99 latency**, and **RAM overhead**:\n\n"
                "• **IVFFlat (Inverted File Flat):** Partitions vectors into Voronoi cells via k-means clustering. "
                "Fast index build time and low RAM, but query latency scales poorly with cluster probes (`nprobe`).\n"
                "• **HNSW (Hierarchical Navigable Small World):** Builds multi-layer geometric graphs. "
                "Provides logarithmic O(log N) search with sub-10ms p99 at 95%+ recall, but requires 1.5x–2x RAM for edge lists.\n\n"
                "**Recommendation for Your Plan:** For real-time retrieval with high accuracy, prioritize HNSW. "
                "For memory-constrained environments (>10M vectors on a single node), evaluate IVF-PQ (Product Quantization)."
            )
        elif any(w in query_lower for w in ["topological", "course schedule", "dag", "kahn"]):
            grounding = "Curriculum Verified: Graph Algorithms & DAG Scheduling"
            content = (
                "**Topological Sorting & Cycle Detection (Kahn's BFS):**\n\n"
                "Topological ordering applies to Directed Acyclic Graphs (DAGs) where tasks have dependencies.\n\n"
                "**Algorithm Steps (O(V + E) Time, O(V) Space):**\n"
                "1. Calculate the **in-degree** (number of incoming prerequisites) for each node.\n"
                "2. Push all nodes with `in_degree == 0` into a FIFO queue.\n"
                "3. Pop from the queue, append to order, decrement in-degree of all outgoing neighbors.\n"
                "4. If a neighbor reaches `in_degree == 0`, push it into the queue.\n"
                "5. **Cycle Detection:** If the processed node count is less than `V`, a cycle exists (deadlock)."
            )
        elif any(w in query_lower for w in ["dynamic programming", "memoization", "dp"]):
            grounding = "Curriculum Verified: Algorithmic Paradigms"
            content = (
                "**Dynamic Programming & Memoization:**\n\n"
                "Dynamic programming breaks problems into overlapping subproblems with optimal substructure.\n\n"
                "• **Memoization (Top-Down):** Recursion with a cache table (hash map or array). You only compute subproblems you actually need.\n"
                "• **Tabulation (Bottom-Up):** Iterative array filling starting from base cases. Avoids recursion stack overflow.\n\n"
                "**Rule of Thumb:** Start by identifying the recurrence relation `dp[i]` and base cases before writing code."
            )
        elif any(w in query_lower for w in ["plan", "schedule", "week", "today", "what should i study"]):
            grounding = "Student Flight Plan: Personalized Priority Engine"
            content = (
                "**Study Recommendations Based on Your Progress:**\n\n"
                "1. **Core Focus Block (90m):** Tackle your highest-priority pending task today with deep focus.\n"
                "2. **Problem Solving (45m):** Solve 1 medium algorithmic problem to reinforce active recall.\n"
                "3. **Spaced Revision (15m):** Review flashcards or summary notes from previous sessions.\n\n"
                "Would you like me to synthesize a structured multi-day study schedule and apply it to your task board?"
            )
        else:
            grounding = "StudyPilot AI Study Coach"
            content = (
                f"I have reviewed your question: *'{last_user_query}'*.\n\n"
                "As your AI Study Coach, I can help you with:\n"
                "• Explaining technical concepts (DSA, Machine Learning, System Design)\n"
                "• Prioritizing your daily and weekly study tasks\n"
                "• Breaking down complex topics into actionable milestones\n"
                "• Checking feasibility of your target deadlines\n\n"
                "Feel free to ask specific questions or request a tailored study roadmap!"
            )

        duration_ms = int((time.perf_counter() - start_time) * 1000)

        return LLMResponse(
            content=content,
            model=self._model,
            finish_reason="STOP",
            input_tokens=len(last_user_query.split()),
            output_tokens=len(content.split()),
            inference_ms=max(10, duration_ms),
            grounding_source=grounding,
        )

    async def health_check(self) -> Dict[str, Any]:
        return {
            "provider": self.provider_name,
            "model": self.model_name,
            "configured": True,
            "status": "ready",
            "mode": "deterministic_offline",
        }
