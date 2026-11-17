from typing import Optional, List
from datetime import datetime, timezone
from pydantic import BaseModel, Field, field_validator


SUPPORTED_LANGUAGES = {
    "cpp": "C++ (GCC 9.2.0 / 14.1.0)",
    "cpp17": "C++17 (GCC 9.2.0)",
    "c++": "C++17",
    "java": "Java (OpenJDK 13.0.1 / 21.0.2)",
    "java21": "Java 21 (OpenJDK)",
    "python": "Python (3.8.1 / 3.11.2 / 3.12)",
    "python3": "Python 3",
    "py": "Python 3",
}


class CodeExecutionRequest(BaseModel):
    language: str = Field(..., description="Target programming language: cpp, java, or python")
    source_code: str = Field(..., min_length=1, max_length=65536, description="Source code text (max 64 KB)")
    stdin: Optional[str] = Field(default="", max_length=65536, description="Standard input passed to program")
    cpu_time_limit: Optional[float] = Field(default=5.0, ge=0.5, le=15.0, description="Max execution time in seconds")
    memory_limit: Optional[int] = Field(default=128000, ge=16000, le=512000, description="Max memory in KB")

    @field_validator("language")
    @classmethod
    def validate_language(cls, v: str) -> str:
        norm = v.strip().lower()
        if norm not in SUPPORTED_LANGUAGES:
            raise ValueError(f"Unsupported language '{v}'. Supported languages: cpp, java, python")
        return norm

    @field_validator("source_code")
    @classmethod
    def validate_source_code(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Source code cannot be empty or purely whitespace.")
        return v


class CodeExecutionResponse(BaseModel):
    token: Optional[str] = None
    status: str = Field(..., description="Verdict or execution status (e.g., Accepted, Compilation Error)")
    status_id: int = Field(..., description="Judge0 status ID (3=Accepted, 5=TLE, 6=Compilation Error, etc.)")
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    compile_output: Optional[str] = None
    time: Optional[str] = None
    memory: Optional[int] = None
    exit_code: Optional[int] = None
    language: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SupportedLanguageItem(BaseModel):
    id: int
    key: str
    name: str
    version: str
    sample_code: str

