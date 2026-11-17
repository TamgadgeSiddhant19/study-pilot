import asyncio
import base64
import logging
from typing import Dict, Any, Optional, Tuple
import httpx

from app.core.config import settings
from app.schemas.code import CodeExecutionRequest, CodeExecutionResponse, SupportedLanguageItem

logger = logging.getLogger("studypilot.code")

# Standard Judge0 Language IDs across CE and RapidAPI instances
# 54: C++ (GCC 9.2.0), 62: Java (OpenJDK 13.0.1) / 96: Java (OpenJDK 21.0.2), 71: Python (3.8.1) / 92: Python (3.11.2)
DEFAULT_LANGUAGE_IDS: Dict[str, int] = {
    "cpp": 54,
    "cpp17": 54,
    "c++": 54,
    "java": 62,
    "java21": 96,
    "python": 71,
    "python3": 71,
    "py": 71,
}

SAMPLE_STARTER_CODE: Dict[str, str] = {
    "cpp": (
        "#include <iostream>\n"
        "#include <vector>\n"
        "#include <string>\n"
        "using namespace std;\n\n"
        "int main() {\n"
        "    // Write your C++17 code here\n"
        "    cout << \"Hello from StudyPilot CodeLab (C++17)!\" << endl;\n"
        "    return 0;\n"
        "}\n"
    ),
    "java": (
        "import java.util.*;\n\n"
        "public class Main {\n"
        "    public static void main(String[] args) {\n"
        "        // Write your Java 21 code here\n"
        "        System.out.println(\"Hello from StudyPilot CodeLab (Java 21)!\");\n"
        "    }\n"
        "}\n"
    ),
    "python": (
        "# Write your Python 3 code here\n"
        "import sys\n\n"
        "def main():\n"
        "    print(\"Hello from StudyPilot CodeLab (Python 3)!\")\n\n"
        "if __name__ == \"__main__\":\n"
        "    main()\n"
    ),
}

JUDGE0_STATUS_DESCRIPTIONS: Dict[int, str] = {
    1: "In Queue",
    2: "Processing",
    3: "Accepted",
    4: "Wrong Answer",
    5: "Time Limit Exceeded",
    6: "Compilation Error",
    7: "Runtime Error (SIGSEGV)",
    8: "Runtime Error (SIGXFSZ)",
    9: "Runtime Error (SIGFPE)",
    10: "Runtime Error (SIGABRT)",
    11: "Runtime Error (NZEC)",
    12: "Runtime Error (Other)",
    13: "Internal Error",
    14: "Exec Format Error",
}


def _b64_encode(text: Optional[str]) -> str:
    if not text:
        return ""
    return base64.b64encode(text.encode("utf-8")).decode("utf-8")


def _b64_decode(text: Optional[str]) -> Optional[str]:
    if not text:
        return None
    try:
        return base64.b64decode(text.encode("utf-8")).decode("utf-8", errors="replace")
    except Exception:
        return text


class Judge0Service:
    """Secure, robust asynchronous execution service integrating Judge0."""

    @property
    def base_url(self) -> str:
        return settings.JUDGE0_API_URL.rstrip("/")

    @property
    def api_key(self) -> str:
        return settings.JUDGE0_API_KEY.strip()

    @property
    def api_host(self) -> str:
        return settings.JUDGE0_API_HOST.strip()

    @property
    def timeout(self) -> int:
        return settings.JUDGE0_TIMEOUT_SECONDS

    def _get_headers(self) -> Dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if self.api_key:
            if "rapidapi" in self.base_url or "rapidapi" in self.api_host:
                headers["X-RapidAPI-Key"] = self.api_key
                headers["X-RapidAPI-Host"] = self.api_host
            else:
                headers["X-Auth-Token"] = self.api_key
        return headers

    def resolve_language_id(self, lang_key: str) -> int:
        norm = lang_key.lower().strip()
        return DEFAULT_LANGUAGE_IDS.get(norm, 71)

    async def execute_code(self, req: CodeExecutionRequest) -> CodeExecutionResponse:
        """Submit code to Judge0, poll for result, and return standardized execution result."""
        lang_id = self.resolve_language_id(req.language)

        payload = {
            "language_id": lang_id,
            "source_code": _b64_encode(req.source_code),
            "stdin": _b64_encode(req.stdin or ""),
            "cpu_time_limit": req.cpu_time_limit or settings.JUDGE0_DEFAULT_CPU_TIME_LIMIT,
            "memory_limit": req.memory_limit or settings.JUDGE0_DEFAULT_MEMORY_LIMIT,
        }

        headers = self._get_headers()
        submit_url = f"{self.base_url}/submissions?base64_encoded=true&wait=false"

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(submit_url, json=payload, headers=headers)

                if resp.status_code == 401 or resp.status_code == 403:
                    logger.warning(f"Judge0 unauthorized or quota exceeded ({resp.status_code})")
                    return CodeExecutionResponse(
                        status="Infrastructure Configuration Error",
                        status_id=13,
                        stderr="Judge0 execution server returned authentication or authorization error. Please check backend JUDGE0_API_KEY configuration.",
                        language=req.language,
                    )

                if resp.status_code not in (200, 201):
                    logger.error(f"Judge0 submission failed ({resp.status_code}): {resp.text}")
                    return CodeExecutionResponse(
                        status="Internal Execution Error",
                        status_id=13,
                        stderr=f"Judge0 submission returned status {resp.status_code}: {resp.text[:200]}",
                        language=req.language,
                    )

                submit_data = resp.json()
                token = submit_data.get("token")
                if not token:
                    return CodeExecutionResponse(
                        status="Internal Execution Error",
                        status_id=13,
                        stderr="Execution service did not return a submission tracking token.",
                        language=req.language,
                    )

        except (httpx.ConnectError, httpx.TimeoutException, httpx.RequestError) as e:
            logger.error(f"Failed to connect to Judge0 execution host: {e}")
            return CodeExecutionResponse(
                status="Service Unavailable",
                status_id=13,
                stderr=f"Unable to connect to remote code execution service ({self.base_url}). Ensure internet connectivity or verify JUDGE0_API_URL.",
                language=req.language,
            )

        # Poll for execution completion
        return await self.poll_submission(token, req.language)

    async def poll_submission(self, token: str, language: str) -> CodeExecutionResponse:
        """Poll Judge0 submission by token until completion or timeout."""
        poll_url = f"{self.base_url}/submissions/{token}?base64_encoded=true"
        headers = self._get_headers()

        start_time = asyncio.get_event_loop().time()
        max_duration = min(self.timeout, 20.0)

        async with httpx.AsyncClient(timeout=8.0) as client:
            while (asyncio.get_event_loop().time() - start_time) < max_duration:
                try:
                    resp = await client.get(poll_url, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        status_obj = data.get("status", {})
                        status_id = status_obj.get("id", 1)

                        # If status is finished (3=Accepted, 4=WA, 5=TLE, 6=CE, 7+=Runtime Error)
                        if status_id >= 3:
                            stdout = _b64_decode(data.get("stdout"))
                            stderr = _b64_decode(data.get("stderr"))
                            compile_output = _b64_decode(data.get("compile_output"))
                            msg = _b64_decode(data.get("message"))

                            # If compile output or message contains errors, normalize
                            if status_id == 6 and not compile_output and stderr:
                                compile_output = stderr
                            if msg and not stderr:
                                stderr = msg

                            status_desc = status_obj.get("description") or JUDGE0_STATUS_DESCRIPTIONS.get(
                                status_id, "Completed"
                            )

                            return CodeExecutionResponse(
                                token=token,
                                status=status_desc,
                                status_id=status_id,
                                stdout=stdout,
                                stderr=stderr,
                                compile_output=compile_output,
                                time=str(data.get("time")) if data.get("time") is not None else None,
                                memory=data.get("memory"),
                                exit_code=data.get("exit_code"),
                                language=language,
                            )
                except Exception as e:
                    logger.debug(f"Polling Judge0 submission {token} attempt error: {e}")

                await asyncio.sleep(0.5)

        # Timeout reached
        return CodeExecutionResponse(
            token=token,
            status="Time Limit Exceeded",
            status_id=5,
            stderr=f"Execution polling timed out after {max_duration:.1f}s. The program may have entered an infinite loop or execution queue was overloaded.",
            language=language,
        )

    def get_supported_languages(self) -> list[SupportedLanguageItem]:
        """Return list of supported languages with metadata and starter code templates."""
        return [
            SupportedLanguageItem(
                id=54,
                key="cpp",
                name="C++17 (GCC 9.2.0)",
                version="C++17",
                sample_code=SAMPLE_STARTER_CODE["cpp"],
            ),
            SupportedLanguageItem(
                id=62,
                key="java",
                name="Java 21 (OpenJDK)",
                version="Java 21",
                sample_code=SAMPLE_STARTER_CODE["java"],
            ),
            SupportedLanguageItem(
                id=71,
                key="python",
                name="Python 3 (3.8.1 / 3.11)",
                version="Python 3.11",
                sample_code=SAMPLE_STARTER_CODE["python"],
            ),
        ]


judge0_service = Judge0Service()

