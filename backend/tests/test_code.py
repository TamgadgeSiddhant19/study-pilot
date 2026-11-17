import base64
import pytest
import httpx
from httpx import AsyncClient, Response


@pytest.mark.asyncio
async def test_get_supported_languages(client: AsyncClient):
    """Verify that supported languages endpoint returns C++, Java, and Python with sample templates."""
    response = await client.get("/api/v1/code/languages")
    assert response.status_code == 200
    languages = response.json()
    assert isinstance(languages, list)
    assert len(languages) >= 3

    keys = [item["key"] for item in languages]
    assert "python" in keys
    assert "cpp" in keys
    assert "java" in keys

    # Verify each language has valid starter code
    for lang in languages:
        assert len(lang["sample_code"]) > 10
        assert lang["id"] > 0


@pytest.mark.asyncio
async def test_execute_code_unauthenticated(client: AsyncClient):
    """Verify that unauthenticated execution requests are rejected with 401."""
    response = await client.post(
        "/api/v1/code/execute",
        json={"language": "python", "source_code": "print('hello')"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_execute_code_validation_empty_source(auth_client: AsyncClient):
    """Verify that empty or whitespace-only source code is rejected with 422."""
    response = await auth_client.post(
        "/api/v1/code/execute",
        json={"language": "python", "source_code": "   "},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_execute_code_validation_invalid_language(auth_client: AsyncClient):
    """Verify that an unsupported language is rejected with 422."""
    response = await auth_client.post(
        "/api/v1/code/execute",
        json={"language": "brainfuck", "source_code": "++++++++++"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_execute_python_code_success(auth_client: AsyncClient, monkeypatch):
    """Mock Judge0 execution for Python 3 code and verify output decoding and metrics."""
    encoded_stdout = base64.b64encode(b"Hello from Python!\n").decode("ascii")

    orig_post = httpx.AsyncClient.post
    orig_get = httpx.AsyncClient.get

    async def mock_post(self, url, *args, **kwargs):
        url_str = str(url)
        if "submissions" in url_str:
            return Response(201, json={"token": "test-token-py-123"})
        return await orig_post(self, url, *args, **kwargs)

    async def mock_get(self, url, *args, **kwargs):
        url_str = str(url)
        if "submissions" in url_str:
            return Response(
                200,
                json={
                    "token": "test-token-py-123",
                    "status": {"id": 3, "description": "Accepted"},
                    "stdout": encoded_stdout,
                    "stderr": None,
                    "compile_output": None,
                    "time": "0.025",
                    "memory": 7450,
                    "exit_code": 0,
                },
            )
        return await orig_get(self, url, *args, **kwargs)

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)
    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)

    payload = {
        "language": "python",
        "source_code": "print('Hello from Python!')",
        "stdin": "",
    }

    response = await auth_client.post("/api/v1/code/execute", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "Accepted"
    assert data["status_id"] == 3
    assert data["stdout"] == "Hello from Python!\n"
    assert data["stderr"] is None
    assert data["compile_output"] is None
    assert data["time"] == "0.025"
    assert data["memory"] == 7450
    assert data["exit_code"] == 0
    assert data["language"] == "python"


@pytest.mark.asyncio
async def test_execute_cpp_with_stdin(auth_client: AsyncClient, monkeypatch):
    """Mock Judge0 execution for C++17 with custom STDIN input."""
    encoded_stdout = base64.b64encode(b"Input was: 42\n").decode("ascii")

    orig_post = httpx.AsyncClient.post
    orig_get = httpx.AsyncClient.get

    async def mock_post(self, url, *args, **kwargs):
        url_str = str(url)
        if "submissions" in url_str:
            return Response(201, json={"token": "test-token-cpp-456"})
        return await orig_post(self, url, *args, **kwargs)

    async def mock_get(self, url, *args, **kwargs):
        url_str = str(url)
        if "submissions" in url_str:
            return Response(
                200,
                json={
                    "token": "test-token-cpp-456",
                    "status": {"id": 3, "description": "Accepted"},
                    "stdout": encoded_stdout,
                    "stderr": None,
                    "compile_output": None,
                    "time": "0.005",
                    "memory": 2100,
                    "exit_code": 0,
                },
            )
        return await orig_get(self, url, *args, **kwargs)

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)
    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)

    payload = {
        "language": "cpp",
        "source_code": "#include <iostream>\nusing namespace std;\nint main() { int x; cin >> x; cout << \"Input was: \" << x << endl; return 0; }",
        "stdin": "42",
    }

    response = await auth_client.post("/api/v1/code/execute", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "Accepted"
    assert data["status_id"] == 3
    assert "Input was: 42" in data["stdout"]
    assert data["language"] == "cpp"


@pytest.mark.asyncio
async def test_execute_compilation_error(auth_client: AsyncClient, monkeypatch):
    """Mock Judge0 response returning a compilation error."""
    error_raw = b"main.cpp: In function 'int main()':\nmain.cpp:3:5: error: 'undeclared_var' was not declared in this scope\n"
    encoded_compile_output = base64.b64encode(error_raw).decode("ascii")

    orig_post = httpx.AsyncClient.post
    orig_get = httpx.AsyncClient.get

    async def mock_post(self, url, *args, **kwargs):
        url_str = str(url)
        if "submissions" in url_str:
            return Response(201, json={"token": "test-token-ce-789"})
        return await orig_post(self, url, *args, **kwargs)

    async def mock_get(self, url, *args, **kwargs):
        url_str = str(url)
        if "submissions" in url_str:
            return Response(
                200,
                json={
                    "token": "test-token-ce-789",
                    "status": {"id": 6, "description": "Compilation Error"},
                    "stdout": None,
                    "stderr": None,
                    "compile_output": encoded_compile_output,
                    "time": None,
                    "memory": None,
                    "exit_code": 1,
                },
            )
        return await orig_get(self, url, *args, **kwargs)

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)
    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)

    payload = {
        "language": "cpp",
        "source_code": "int main() { undeclared_var = 10; return 0; }",
    }

    response = await auth_client.post("/api/v1/code/execute", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "Compilation Error"
    assert data["status_id"] == 6
    assert "undeclared_var" in data["compile_output"]


@pytest.mark.asyncio
async def test_execute_runtime_error(auth_client: AsyncClient, monkeypatch):
    """Mock Judge0 response returning a runtime error (e.g., division by zero)."""
    error_raw = b"ZeroDivisionError: division by zero\n"
    encoded_stderr = base64.b64encode(error_raw).decode("ascii")

    orig_post = httpx.AsyncClient.post
    orig_get = httpx.AsyncClient.get

    async def mock_post(self, url, *args, **kwargs):
        url_str = str(url)
        if "submissions" in url_str:
            return Response(201, json={"token": "test-token-re-101"})
        return await orig_post(self, url, *args, **kwargs)

    async def mock_get(self, url, *args, **kwargs):
        url_str = str(url)
        if "submissions" in url_str:
            return Response(
                200,
                json={
                    "token": "test-token-re-101",
                    "status": {"id": 11, "description": "Runtime Error (NZEC)"},
                    "stdout": None,
                    "stderr": encoded_stderr,
                    "compile_output": None,
                    "time": "0.03",
                    "memory": 8200,
                    "exit_code": 1,
                },
            )
        return await orig_get(self, url, *args, **kwargs)

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)
    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)

    payload = {
        "language": "python",
        "source_code": "x = 1 / 0",
    }

    response = await auth_client.post("/api/v1/code/execute", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status_id"] == 11
    assert "ZeroDivisionError" in data["stderr"]


@pytest.mark.asyncio
async def test_execute_time_limit_exceeded(auth_client: AsyncClient, monkeypatch):
    """Mock Judge0 response returning Time Limit Exceeded."""
    orig_post = httpx.AsyncClient.post
    orig_get = httpx.AsyncClient.get

    async def mock_post(self, url, *args, **kwargs):
        url_str = str(url)
        if "submissions" in url_str:
            return Response(201, json={"token": "test-token-tle-202"})
        return await orig_post(self, url, *args, **kwargs)

    async def mock_get(self, url, *args, **kwargs):
        url_str = str(url)
        if "submissions" in url_str:
            return Response(
                200,
                json={
                    "token": "test-token-tle-202",
                    "status": {"id": 5, "description": "Time Limit Exceeded"},
                    "stdout": None,
                    "stderr": None,
                    "compile_output": None,
                    "time": "5.001",
                    "memory": 12000,
                    "exit_code": None,
                },
            )
        return await orig_get(self, url, *args, **kwargs)

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)
    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)

    payload = {
        "language": "python",
        "source_code": "while True: pass",
    }

    response = await auth_client.post("/api/v1/code/execute", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status_id"] == 5
    assert data["status"] == "Time Limit Exceeded"


@pytest.mark.asyncio
async def test_get_execution_status(auth_client: AsyncClient, monkeypatch):
    """Test polling execution status directly via /status/{token}."""
    encoded_stdout = base64.b64encode(b"Polled Output\n").decode("ascii")

    orig_get = httpx.AsyncClient.get

    async def mock_get(self, url, *args, **kwargs):
        url_str = str(url)
        if "submissions" in url_str:
            return Response(
                200,
                json={
                    "token": "polling-token-303",
                    "status": {"id": 3, "description": "Accepted"},
                    "stdout": encoded_stdout,
                    "stderr": None,
                    "compile_output": None,
                    "time": "0.01",
                    "memory": 3000,
                    "exit_code": 0,
                },
            )
        return await orig_get(self, url, *args, **kwargs)

    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)

    response = await auth_client.get("/api/v1/code/status/polling-token-303?language=python")
    assert response.status_code == 200
    data = response.json()
    assert data["token"] == "polling-token-303"
    assert data["stdout"] == "Polled Output\n"
    assert data["status_id"] == 3
