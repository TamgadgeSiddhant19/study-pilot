from typing import Optional, List, Any, Dict
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class PlannedTaskItem(BaseModel):
    title: str
    subject: str
    duration_minutes: int
    priority: str = "P1"
    prerequisite: Optional[str] = None
    completion_criteria: str


class StructuredStudyPlan(BaseModel):
    target_role: str
    timeframe_days: int
    daily_quota_hours: float
    feasibility_score: int = Field(ge=0, le=100)
    is_realistic: bool
    assessment_notes: str
    warnings: List[str] = []
    proposed_tasks: List[PlannedTaskItem] = []


class RAGSourceReference(BaseModel):
    document_id: int
    filename: str
    chunk_id: Optional[int] = None
    page_number: Optional[int] = None
    section: Optional[str] = None
    similarity_score: float
    snippet: str


class CoachPromptRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000, description="User prompt or question to the study coach")
    conversation_id: Optional[int] = Field(default=None, description="Optional existing conversation ID to continue")
    response_preference: Optional[str] = Field(default="balanced", description="Style preference: 'balanced', 'concise', or 'step_by_step'")
    knowledge_scope: Optional[str] = Field(default="both", description="Scope: 'both' (materials + AI), 'documents' (materials only), 'general' (AI only)")
    track: str = Field(default="AI Systems Engineer", max_length=100)


class CoachHealthResponse(BaseModel):
    status: str
    provider: str
    model: str
    configured: bool
    timeout_seconds: Optional[int] = None


class CoachPlanGenerateRequest(BaseModel):
    learning_goal: str = Field(min_length=3)
    available_hours_per_day: float = Field(default=3.0, ge=0.5, le=16.0)
    deadline_days: int = Field(default=30, ge=1, le=365)
    current_skill_level: str = Field(default="Intermediate", pattern="^(Beginner|Intermediate|Advanced)$")
    completed_topics: List[str] = []


class ActionProposalResponse(BaseModel):
    id: int
    action_type: str
    status: str
    summary: str
    payload: Any  # Parsed JSON or string
    created_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ActionExecutionResponse(BaseModel):
    status: str
    proposal_id: int
    action_type: str
    message: str
    details: dict = {}


class CoachMessageResponse(BaseModel):
    id: int
    conversation_id: Optional[int] = None
    role: str
    content: str
    grounding_source: Optional[str] = None
    sources: Optional[List[RAGSourceReference]] = []
    rag_used: bool = False
    evidence_sufficient: bool = True
    proposed_actions: Optional[List[ActionProposalResponse]] = []
    inference_ms: Optional[int] = None
    depth: Optional[str] = None
    tags: Optional[str] = None
    structured_plan: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class CoachConversationResponse(BaseModel):
    id: int
    title: str
    track: str
    created_at: Optional[datetime] = None
    messages: List[CoachMessageResponse] = []

    model_config = ConfigDict(from_attributes=True)


ActionProposalResponse.model_rebuild()
CoachMessageResponse.model_rebuild()
CoachConversationResponse.model_rebuild()
