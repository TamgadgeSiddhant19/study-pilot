import json
import time
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.task import Task
from app.models.session import StudySession
from app.models.leetcode import LeetCodeProblem
from app.models.coach import CoachConversation, CoachMessage
from app.models.user import User
from app.schemas.coach import StructuredStudyPlan, PlannedTaskItem
from app.core.config import settings
from app.services.llm import (
    get_llm_provider,
    LLMProvider,
    LLMConfigurationError,
    LLMQuotaExceededError,
    LLMTimeoutError,
    LLMException,
)
from app.services.llm.deterministic_provider import DeterministicProvider


class StudyCoachAgent:
    """
    Explicit, testable AI Study Coach agent powered by Google Gemini with deterministic fallback.
    
    Workflow Steps:
    1. Gather Context: Queries user's verified tasks, active streak, focus hours, and targets.
    2. Assess Feasibility: Evaluates total hours required vs. (available hours * deadline days).
    3. Ground System Instruction: Injects verified progress data to prevent hallucinations.
    4. Multi-Turn LLM Reasoning: Dispatches prompt with history to Gemini (or Deterministic fallback).
    5. Fallback Guarantee: Recovers smoothly from quota limits, missing keys, or network timeouts.
    """

    @classmethod
    async def get_user_progress_context(
        cls,
        db: AsyncSession,
        user: Optional[User] = None
    ) -> Dict[str, Any]:
        """Tool: Retrieve current user's actual verified study progress and statistics from DB in minimal round-trips."""
        user_id = user.id if user else None

        # 1. Combined single-roundtrip stats query strictly scoped to authenticated user
        if user_id:
            stats_stmt = select(
                select(func.count(Task.id)).where(Task.user_id == user_id).scalar_subquery().label("total_tasks"),
                select(func.count(Task.id)).where((Task.user_id == user_id) & (Task.completed == True)).scalar_subquery().label("completed_tasks"),
                select(func.coalesce(func.sum(StudySession.duration_minutes), 0)).where(StudySession.user_id == user_id).scalar_subquery().label("focus_mins"),
                select(func.count(LeetCodeProblem.id)).where((LeetCodeProblem.user_id == user_id) & (LeetCodeProblem.status == "Solved")).scalar_subquery().label("leetcode_solved"),
            )
        else:
            stats_stmt = select(
                select(func.count(Task.id)).where(Task.id == -1).scalar_subquery().label("total_tasks"),
                select(func.count(Task.id)).where(Task.id == -1).scalar_subquery().label("completed_tasks"),
                select(func.coalesce(func.sum(StudySession.duration_minutes), 0)).where(StudySession.id == -1).scalar_subquery().label("focus_mins"),
                select(func.count(LeetCodeProblem.id)).where(LeetCodeProblem.id == -1).scalar_subquery().label("leetcode_solved"),
            )

        stats_row = (await db.execute(stats_stmt)).first()
        task_count = stats_row[0] if stats_row else 0
        completed_task_count = stats_row[1] if stats_row else 0
        focus_mins = stats_row[2] if stats_row else 0
        leetcode_solved = stats_row[3] if stats_row else 0
        total_focus_hours = round(focus_mins / 60.0, 1)

        # 2. Retrieve top pending tasks (limit 5)
        pending_tasks_query = (
            select(Task.title, Task.priority, Task.subject)
            .where(Task.completed == False)
            .order_by(Task.priority.asc(), Task.id.asc())
            .limit(5)
        )
        if user_id:
            pending_tasks_query = pending_tasks_query.where(Task.user_id == user_id)

        pending_rows = (await db.execute(pending_tasks_query)).all()
        pending_tasks = [f"{r[0]} ({r[1]}, {r[2]})" for r in pending_rows]

        # User profile fields
        target_role = user.target_role if user and user.target_role else "Software / AI Engineer"
        daily_goal = user.daily_flight_quota_hours if user and user.daily_flight_quota_hours else 4.0
        user_name = user.full_name if user else "Student"
        skill_level = getattr(user, "skill_level", "Intermediate") or "Intermediate"

        return {
            "user_name": user_name,
            "target_role": target_role,
            "daily_goal_hours": daily_goal,
            "skill_level": skill_level,
            "total_tasks": task_count,
            "completed_tasks": completed_task_count,
            "pending_tasks": pending_tasks,
            "total_focus_hours": total_focus_hours,
            "leetcode_solved": leetcode_solved,
        }


    @classmethod
    def evaluate_feasibility(
        cls,
        goal: str,
        available_hours_per_day: float,
        deadline_days: int,
        estimated_curriculum_hours: float = 60.0
    ) -> Dict[str, Any]:
        """Evaluates whether a target learning plan is realistic."""
        total_available_hours = available_hours_per_day * deadline_days
        ratio = total_available_hours / max(1.0, estimated_curriculum_hours)
        
        is_realistic = ratio >= 0.8
        feasibility_score = min(100, int(ratio * 100))
        
        warnings = []
        if ratio < 0.6:
            warnings.append(
                f"Severe time deficit: You have {total_available_hours:.1f}h available before the deadline, "
                f"but mastering '{goal}' thoroughly requires approx {estimated_curriculum_hours:.1f}h. "
                "Consider narrowing scope to high-frequency core topics or extending your deadline."
            )
        elif ratio < 0.85:
            warnings.append(
                f"Tight pace: {total_available_hours:.1f}h available vs {estimated_curriculum_hours:.1f}h target. "
                "P0 high-priority tasks must take precedence over optional explorations."
            )

        return {
            "total_available_hours": total_available_hours,
            "feasibility_score": feasibility_score,
            "is_realistic": is_realistic,
            "warnings": warnings,
        }

    @classmethod
    def generate_deterministic_plan(
        cls,
        goal: str,
        available_hours_per_day: float,
        deadline_days: int,
        skill_level: str = "Intermediate",
        completed_topics: Optional[List[str]] = None
    ) -> StructuredStudyPlan:
        """
        Rule-based deterministic study planner.
        Produces structured output when external LLM providers are not connected.
        """
        completed = set(t.lower() for t in (completed_topics or []))
        
        # Knowledge curriculum library
        curriculums: Dict[str, List[Dict[str, Any]]] = {
            "ai": [
                {
                    "title": "Vector Embeddings & Cosine Sim Foundations",
                    "subject": "GenAI & Search",
                    "duration": 90,
                    "priority": "P0",
                    "prereq": "Linear Algebra Basics",
                    "criteria": "Implement vector distance calculations and cosine similarity benchmarking in Python."
                },
                {
                    "title": "HNSW Graph Indexing vs IVFFlat Benchmarking",
                    "subject": "Vector DBs",
                    "duration": 120,
                    "priority": "P0",
                    "prereq": "Vector Embeddings",
                    "criteria": "Explain recall accuracy vs query p99 latency trade-offs on 100k vectors."
                },
                {
                    "title": "RAG Chunking Strategies & Hybrid Dense/Sparse Retrieval",
                    "subject": "RAG Architectures",
                    "duration": 120,
                    "priority": "P0",
                    "prereq": "Vector Indexing",
                    "criteria": "Build sliding window chunking with BM25 + dense bi-encoder re-ranking."
                },
                {
                    "title": "Graph Neural Networks & PageRank Ingestion",
                    "subject": "Deep Learning",
                    "duration": 150,
                    "priority": "P1",
                    "prereq": "Graph Algorithms",
                    "criteria": "Implement message-passing layers and analyze memory overhead."
                },
                {
                    "title": "LLM Inference Quantization (AWQ / GPTQ) & vLLM PagedAttention",
                    "subject": "Systems & Inference",
                    "duration": 120,
                    "priority": "P1",
                    "prereq": "Transformer Architecture",
                    "criteria": "Trace KV-cache memory allocation and explain memory-bandwidth bottlenecks."
                }
            ],
            "dsa": [
                {
                    "title": "Topological Sort & Kahn's BFS Algorithm",
                    "subject": "DSA - Graphs",
                    "duration": 90,
                    "priority": "P0",
                    "prereq": "BFS & In-Degree Array",
                    "criteria": "Solve LeetCode #207 (Course Schedule) and #210 with O(V+E) time."
                },
                {
                    "title": "Dijkstra & Min-Heap Shortest Path",
                    "subject": "DSA - Graphs",
                    "duration": 120,
                    "priority": "P0",
                    "prereq": "Priority Queue",
                    "criteria": "Solve Network Delay Time and analyze time complexity O(E log V)."
                },
                {
                    "title": "Dynamic Programming on Trees & DAGs",
                    "subject": "DSA - DP",
                    "duration": 150,
                    "priority": "P1",
                    "prereq": "Post-Order Tree Traversal",
                    "criteria": "Solve Tree Diameter and House Robber III with optimal memoization."
                },
                {
                    "title": "Monotonic Stack Patterns",
                    "subject": "DSA - Stacks",
                    "duration": 90,
                    "priority": "P1",
                    "prereq": "Stack Fundamentals",
                    "criteria": "Solve Daily Temperatures and Largest Rectangle in Histogram."
                }
            ]
        }

        # Select curriculum based on keywords
        goal_lower = goal.lower()
        if any(k in goal_lower for k in ["dsa", "leetcode", "algorithm", "data structure", "interview"]):
            selected_curriculum = curriculums["dsa"]
            curriculum_hours = 7.5
        else:
            selected_curriculum = curriculums["ai"]
            curriculum_hours = 10.0

        feasibility = cls.evaluate_feasibility(
            goal=goal,
            available_hours_per_day=available_hours_per_day,
            deadline_days=deadline_days,
            estimated_curriculum_hours=curriculum_hours
        )

        proposed_tasks: List[PlannedTaskItem] = []
        for item in selected_curriculum:
            if item["title"].lower() not in completed:
                proposed_tasks.append(
                    PlannedTaskItem(
                        title=item["title"],
                        subject=item["subject"],
                        duration_minutes=item["duration"],
                        priority=item["priority"],
                        prerequisite=item["prereq"],
                        completion_criteria=item["criteria"]
                    )
                )

        assessment = (
            f"Synthesized curriculum for '{goal}' ({skill_level} level) across {deadline_days} days. "
            f"Quota: {available_hours_per_day}h/day. Total allocated study: {available_hours_per_day * deadline_days:.1f}h."
        )

        return StructuredStudyPlan(
            target_role=goal,
            timeframe_days=deadline_days,
            daily_quota_hours=available_hours_per_day,
            feasibility_score=feasibility["feasibility_score"],
            is_realistic=feasibility["is_realistic"],
            assessment_notes=assessment,
            warnings=feasibility["warnings"],
            proposed_tasks=proposed_tasks
        )

    @classmethod
    def build_system_instruction(
        cls,
        context: Dict[str, Any],
        response_preference: Optional[str] = "balanced",
        retrieved_context: Optional[str] = None,
        knowledge_scope: Optional[str] = "both",
    ) -> str:
        """Constructs grounded system instruction incorporating verified study data, style preference, and RAG context."""
        from app.services.llm.prompts import build_system_prompt
        return build_system_prompt(
            context=context,
            response_preference=response_preference,
            retrieved_context=retrieved_context,
            knowledge_scope=knowledge_scope,
        )

    @classmethod
    async def process_user_query(
        cls,
        user_query: str,
        conversation: CoachConversation,
        db: AsyncSession,
        user: Optional[User] = None,
        provider: Optional[LLMProvider] = None,
        response_preference: Optional[str] = "balanced",
        knowledge_scope: Optional[str] = "both",
    ) -> CoachMessage:
        """
        Processes a coaching turn using a controlled LangGraph workflow.
        Executes bounded, authorized study tools and grounded response generation.
        """
        import logging
        from app.services.agent.graph import study_coach_graph
        from app.services.agent.state import CoachAgentState
        from app.schemas.coach import RAGSourceReference, ActionProposalResponse

        logger = logging.getLogger("studypilot.coach")
        start_time = time.perf_counter()
        active_provider = provider or get_llm_provider()

        # 1. Retrieve past messages in this conversation for multi-turn history (last 8)
        history_msgs = await db.execute(
            select(CoachMessage)
            .where(CoachMessage.conversation_id == conversation.id)
            .order_by(CoachMessage.id.desc())
            .limit(8)
        )
        ordered_history = list(reversed(history_msgs.scalars().all()))

        history: List[Dict[str, str]] = []
        for hm in ordered_history:
            history.append({"role": hm.role, "content": hm.content})

        # 2. Prepare initial LangGraph workflow state
        initial_state: CoachAgentState = {
            "user_id": user.id if user else 0,
            "user_query": user_query,
            "conversation_id": conversation.id,
            "response_preference": response_preference or "balanced",
            "knowledge_scope": knowledge_scope or "both",
            "iteration_count": 0,
            "max_iterations": 3,
            "tool_results": {},
            "proposed_actions": [],
            "sources": [],
            "error": None,
        }

        # 3. Execute LangGraph workflow with configurable runtime dependencies
        try:
            graph_result = await study_coach_graph.ainvoke(
                initial_state,
                config={
                    "configurable": {
                        "db": db,
                        "provider": active_provider,
                        "history": history,
                    }
                }
            )
        except (LLMConfigurationError, LLMQuotaExceededError, LLMTimeoutError, LLMException) as err:
            logger.error(f"LangGraph execution halted due to provider error ({type(err).__name__}): {err}")
            raise err
        except Exception as e:
            logger.error(f"Unexpected LangGraph execution failure: {e}", exc_info=True)
            raise LLMException(f"Agent workflow error: {str(e)}")

        duration_ms = int((time.perf_counter() - start_time) * 1000)

        # 4. Extract citations and action proposals
        source_refs: List[RAGSourceReference] = []
        for s in graph_result.get("sources", []):
            source_refs.append(
                RAGSourceReference(
                    chunk_id=s.get("chunk_id"),
                    document_id=s.get("document_id", 0),
                    filename=s.get("filename", "notes"),
                    page_number=s.get("page_number"),
                    section=s.get("section"),
                    similarity_score=s.get("similarity_score", 0.0),
                    snippet=s.get("snippet", ""),
                )
            )

        rag_used = bool(graph_result.get("rag_used", len(source_refs) > 0))
        evidence_sufficient = bool(graph_result.get("evidence_sufficient", True))

        proposals: List[ActionProposalResponse] = []
        for p in graph_result.get("proposed_actions", []):
            if "proposal_id" in p:
                proposals.append(
                    ActionProposalResponse(
                        id=p["proposal_id"],
                        action_type=p.get("action_type", "create_tasks"),
                        status=p.get("status", "pending_confirmation"),
                        summary=p.get("summary", ""),
                        payload=p.get("proposed_tasks") or p.get("details") or {},
                    )
                )

        content = graph_result.get("final_response", "")
        grounding = graph_result.get("grounding_source", "Google Gemini via LangGraph")

        # Encode structured plan & metadata
        metadata_payload = {
            "rag_used": rag_used,
            "evidence_sufficient": evidence_sufficient,
            "sources": [s.model_dump() for s in source_refs],
        }

        # 5. Persist assistant message to database
        assistant_msg = CoachMessage(
            conversation_id=conversation.id,
            role="assistant",
            content=content,
            grounding_source=grounding,
            inference_ms=duration_ms,
            depth="High",
            tags="#AIStudyCoach, #LangGraph" + (", #RAG" if source_refs else ""),
            structured_plan=json.dumps(metadata_payload),
        )
        db.add(assistant_msg)
        await db.commit()
        await db.refresh(assistant_msg)

        # Attach transient attributes for Pydantic response serialization
        setattr(assistant_msg, "sources", source_refs)
        setattr(assistant_msg, "rag_used", rag_used)
        setattr(assistant_msg, "evidence_sufficient", evidence_sufficient)
        setattr(assistant_msg, "proposed_actions", proposals)

        return assistant_msg

