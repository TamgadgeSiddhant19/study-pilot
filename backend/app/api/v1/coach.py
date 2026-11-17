import json
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.coach import CoachConversation, CoachMessage, CoachActionProposal
from app.models.task import Task
from app.schemas.coach import (
    CoachPromptRequest,
    CoachPlanGenerateRequest,
    CoachMessageResponse,
    CoachConversationResponse,
    CoachHealthResponse,
    StructuredStudyPlan,
    ActionProposalResponse,
    ActionExecutionResponse,
)
from app.services.study_coach_agent import StudyCoachAgent
from app.services.llm import (
    get_llm_provider,
    coach_rate_limiter,
    LLMConfigurationError,
    LLMQuotaExceededError,
    LLMTimeoutError,
    LLMException,
)

router = APIRouter(prefix="/coach", tags=["AI Study Coach"])


@router.get("/health", response_model=CoachHealthResponse)
async def get_coach_health():
    """
    Minimal provider health/configuration check that never reveals secrets.
    Reports active LLM provider, model name, and configuration readiness.
    """
    provider = get_llm_provider()
    health_data = await provider.health_check()
    return CoachHealthResponse(
        status=health_data.get("status", "ready"),
        provider=health_data.get("provider", "gemini-langchain"),
        model=health_data.get("model", "gemini-2.5-flash"),
        configured=health_data.get("configured", False),
        timeout_seconds=health_data.get("timeout_seconds", 30),
    )


@router.get("/conversations", response_model=List[CoachConversationResponse])
async def get_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve coaching conversation history strictly belonging to the authenticated user."""
    result = await db.execute(
        select(CoachConversation)
        .where(CoachConversation.user_id == current_user.id)
        .options(selectinload(CoachConversation.messages))
        .order_by(CoachConversation.id.desc())
    )
    convs = result.scalars().all()
    for conv in convs:
        for msg in conv.messages:
            if msg.structured_plan:
                try:
                    parsed = json.loads(msg.structured_plan)
                    if isinstance(parsed, dict):
                        setattr(msg, "rag_used", parsed.get("rag_used", False))
                        setattr(msg, "evidence_sufficient", parsed.get("evidence_sufficient", True))
                        setattr(msg, "sources", parsed.get("sources", []))
                    elif isinstance(parsed, list):
                        setattr(msg, "sources", parsed)
                        setattr(msg, "rag_used", len(parsed) > 0)
                        setattr(msg, "evidence_sufficient", True)
                except Exception:
                    pass
    return convs


@router.post("/chat", response_model=CoachMessageResponse)
async def chat_with_coach(
    req: CoachPromptRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Authenticated AI Study Coach chat endpoint.
    Applies per-user rate limiting, factual grounding with user's real study progress,
    and dispatches through Google Gemini via LangChain.
    """
    # 1. Enforce per-user rate limiting (e.g., 20 requests/min)
    coach_rate_limiter.check_rate_limit(f"user_{current_user.id}")

    # 2. Retrieve or create active conversation strictly scoped to authenticated user
    if req.conversation_id:
        stmt = select(CoachConversation).where(
            CoachConversation.id == req.conversation_id,
            CoachConversation.user_id == current_user.id,
        )
        conv = (await db.execute(stmt)).scalar_one_or_none()
        if not conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Conversation #{req.conversation_id} not found",
            )
    else:
        result = await db.execute(
            select(CoachConversation)
            .where(CoachConversation.user_id == current_user.id)
            .order_by(CoachConversation.id.desc())
            .limit(1)
        )
        conv = result.scalar_one_or_none()
        if not conv:
            conv = CoachConversation(
                title=f"{current_user.target_role or 'Study'} Mentorship",
                track=req.track,
                user_id=current_user.id,
            )
            db.add(conv)
            await db.commit()
            await db.refresh(conv)

    # 3. Record User Message
    user_msg = CoachMessage(
        conversation_id=conv.id,
        role="user",
        content=req.message,
        tags=None,
    )
    db.add(user_msg)
    await db.commit()

    # 4. Agent processes query using Gemini via LangChain with honest error boundaries
    try:
        assistant_msg = await StudyCoachAgent.process_user_query(
            user_query=req.message,
            conversation=conv,
            db=db,
            user=current_user,
            response_preference=req.response_preference,
            knowledge_scope=req.knowledge_scope,
        )
    except LLMConfigurationError as err:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AI service unconfigured: {str(err)}",
        )
    except LLMQuotaExceededError as err:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"AI provider quota limit reached: {str(err)}",
        )
    except LLMTimeoutError as err:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"AI inference request timed out: {str(err)}",
        )
    except LLMException as err:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI service provider error: {str(err)}",
        )

    return assistant_msg


@router.post("/plan", response_model=StructuredStudyPlan)
async def generate_study_plan(
    req: CoachPlanGenerateRequest,
    current_user: User = Depends(get_current_user),
):
    """Generates an explicit, feasibility-checked structured study schedule."""
    plan = StudyCoachAgent.generate_deterministic_plan(
        goal=req.learning_goal,
        available_hours_per_day=req.available_hours_per_day,
        deadline_days=req.deadline_days,
        skill_level=req.current_skill_level,
        completed_topics=req.completed_topics,
    )
    return plan


@router.post("/plan/apply", status_code=status.HTTP_201_CREATED)
async def apply_proposed_plan(
    plan: StructuredStudyPlan,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """User-confirmed action: Converts proposed study plan items into real active tasks for authenticated user."""
    created_tasks = []
    for item in plan.proposed_tasks:
        task = Task(
            title=item.title,
            subject=item.subject,
            priority=item.priority,
            description=f"Prerequisite: {item.prerequisite or 'None'}\nCriteria: {item.completion_criteria}",
            estimated_minutes=item.duration_minutes,
            due_date="Upcoming",
            status="todo",
            completed=False,
            user_id=current_user.id,
        )
        db.add(task)
        created_tasks.append(task)

    await db.commit()
    return {"status": "success", "tasks_created": len(created_tasks)}


@router.post("/reset", status_code=status.HTTP_200_OK)
async def reset_coach_context(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Clears chat history strictly for the authenticated user without affecting other users."""
    user_conv_ids_stmt = select(CoachConversation.id).where(CoachConversation.user_id == current_user.id)
    user_conv_ids = (await db.execute(user_conv_ids_stmt)).scalars().all()
    if user_conv_ids:
        await db.execute(delete(CoachMessage).where(CoachMessage.conversation_id.in_(user_conv_ids)))
        await db.execute(delete(CoachConversation).where(CoachConversation.user_id == current_user.id))
        await db.commit()
    return {"status": "success", "message": "Coach context reset successfully."}


def _ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


@router.get("/actions/pending", response_model=List[ActionProposalResponse])
async def list_pending_actions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve active write proposals pending explicit user confirmation."""
    now = datetime.now(timezone.utc)
    stmt = (
        select(CoachActionProposal)
        .where(
            CoachActionProposal.user_id == current_user.id,
            CoachActionProposal.status == "pending",
        )
        .order_by(CoachActionProposal.id.desc())
    )
    rows = (await db.execute(stmt)).scalars().all()
    results = []
    for r in rows:
        exp = _ensure_utc(r.expires_at)
        if exp and exp <= now:
            continue
        try:
            parsed = json.loads(r.payload)
        except Exception:
            parsed = r.payload
        results.append(
            ActionProposalResponse(
                id=r.id,
                action_type=r.action_type,
                status=r.status,
                summary=r.summary,
                payload=parsed,
                created_at=r.created_at,
                expires_at=r.expires_at,
            )
        )
    return results


@router.post("/actions/{proposal_id}/confirm", response_model=ActionExecutionResponse)
async def confirm_action_proposal(
    proposal_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Explicit user confirmation for an agent write proposal.
    Re-validates user ownership, expiration, and idempotency before executing database changes.
    """
    now = datetime.now(timezone.utc)
    stmt = select(CoachActionProposal).where(
        CoachActionProposal.id == proposal_id,
        CoachActionProposal.user_id == current_user.id,
    )
    proposal = (await db.execute(stmt)).scalar_one_or_none()
    if not proposal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Action proposal #{proposal_id} not found or permission denied.",
        )

    if proposal.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Proposal #{proposal_id} is already '{proposal.status}' and cannot be re-executed.",
        )

    expires = _ensure_utc(proposal.expires_at)
    if expires and expires <= now:
        proposal.status = "expired"
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Proposal #{proposal_id} has expired.",
        )

    # Parse payload
    try:
        data = json.loads(proposal.payload)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Corrupted proposal payload: {e}",
        )

    if proposal.action_type == "create_tasks":
        tasks_data = data.get("tasks", [])
        created_count = 0
        for item in tasks_data:
            task = Task(
                title=item.get("title", "Study Task"),
                subject=item.get("subject", "General"),
                priority=item.get("priority", "P1"),
                estimated_minutes=item.get("duration_minutes", 45),
                due_date=item.get("due_date", "Upcoming"),
                status="todo",
                completed=False,
                user_id=current_user.id,
            )
            db.add(task)
            created_count += 1

        proposal.status = "confirmed"
        proposal.executed_at = now
        await db.commit()
        return ActionExecutionResponse(
            status="success",
            proposal_id=proposal.id,
            action_type=proposal.action_type,
            message=f"Successfully created {created_count} study task(s).",
            details={"tasks_created": created_count},
        )

    elif proposal.action_type == "reschedule_task":
        task_id = data.get("task_id")
        task = await db.get(Task, task_id)
        if not task or task.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Task #{task_id} not found or ownership mismatch.",
            )

        task.due_date = data.get("new_due_date", task.due_date)
        if data.get("new_priority"):
            task.priority = data.get("new_priority")
        task.updated_at = now

        proposal.status = "confirmed"
        proposal.executed_at = now
        await db.commit()
        return ActionExecutionResponse(
            status="success",
            proposal_id=proposal.id,
            action_type=proposal.action_type,
            message=f"Task #{task.id} rescheduled to '{task.due_date}'.",
            details={"task_id": task.id, "due_date": task.due_date},
        )

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown action type: {proposal.action_type}",
        )


@router.post("/actions/{proposal_id}/reject", response_model=ActionExecutionResponse)
async def reject_action_proposal(
    proposal_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """User rejection of an agent-proposed write action."""
    stmt = select(CoachActionProposal).where(
        CoachActionProposal.id == proposal_id,
        CoachActionProposal.user_id == current_user.id,
    )
    proposal = (await db.execute(stmt)).scalar_one_or_none()
    if not proposal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Action proposal #{proposal_id} not found or permission denied.",
        )

    if proposal.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Proposal #{proposal_id} is already '{proposal.status}'.",
        )

    proposal.status = "rejected"
    await db.commit()
    return ActionExecutionResponse(
        status="success",
        proposal_id=proposal.id,
        action_type=proposal.action_type,
        message="Proposal was rejected.",
        details={},
    )
