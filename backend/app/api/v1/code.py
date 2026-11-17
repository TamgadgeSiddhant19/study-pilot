import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.code import (
    CodeExecutionRequest,
    CodeExecutionResponse,
    SupportedLanguageItem,
)
from app.services.judge0 import judge0_service

logger = logging.getLogger("studypilot.code")

router = APIRouter(prefix="/code", tags=["CodeLab Execution Engine"])


@router.post("/execute", response_model=CodeExecutionResponse)
async def execute_code(
    req: CodeExecutionRequest,
    current_user: User = Depends(get_current_user),
) -> CodeExecutionResponse:
    """Compile and execute C++, Java, or Python code securely via the isolated Judge0 execution sandbox.
    
    Validates source-code limits, sanitizes parameters, passes custom STDIN,
    and returns decoded standard output, compilation diagnostics, and metrics.
    """
    logger.info(
        f"User {current_user.id} ({current_user.email}) submitted {req.language} code for execution "
        f"({len(req.source_code)} bytes)"
    )

    result = await judge0_service.execute_code(req)
    return result


@router.get("/status/{token}", response_model=CodeExecutionResponse)
async def get_execution_status(
    token: str,
    language: str = Query(default="python"),
    current_user: User = Depends(get_current_user),
) -> CodeExecutionResponse:
    """Poll asynchronous execution status and outputs for an in-flight submission token."""
    result = await judge0_service.poll_submission(token, language)
    return result


@router.get("/languages", response_model=List[SupportedLanguageItem])
def list_supported_languages() -> List[SupportedLanguageItem]:
    """Retrieve supported compiler/runtime environments with verified default starter code."""
    return judge0_service.get_supported_languages()

