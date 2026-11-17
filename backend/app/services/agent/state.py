from typing import TypedDict, List, Dict, Any, Optional


class CoachAgentState(TypedDict, total=False):
    """
    Typed state dictionary representing the controlled LangGraph workflow stages:
    1. Validation & input parameters
    2. Intent classification & routing
    3. Grounded user context & authorized data
    4. Tool planning and execution outputs
    5. Action proposals awaiting user confirmation
    6. Grounded response generation & citations
    """
    user_id: int
    user_query: str
    conversation_id: Optional[int]
    response_preference: str
    knowledge_scope: str
    intent: str
    context_data: Dict[str, Any]
    planned_tools: List[Dict[str, Any]]
    tool_results: Dict[str, Any]
    proposed_actions: List[Dict[str, Any]]
    sources: List[Dict[str, Any]]
    rag_used: bool
    evidence_sufficient: bool
    iteration_count: int
    max_iterations: int
    final_response: str
    grounding_source: str
    error: Optional[str]

