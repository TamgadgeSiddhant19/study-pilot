# StudyPilot AI 🚀
> Personal Study & Interview Preparation Platform for Students and Working Professionals

StudyPilot AI is a production-grade study planner, LeetCode spaced-repetition tracker, and AI study coach engineered with modern web standards, deterministic curriculum synthesis, and developer-tool aesthetics.

---

## 🛠️ Technology Stack

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript (Strict Mode), Tailwind CSS v4, Lucide React Icons. (Configured for port `3002`).
- **Backend:** Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy 2.x (Asyncio), Alembic Migrations. (Configured for port `8001`).
- **Database:** Neon PostgreSQL or Local PostgreSQL via `asyncpg` driver (primary persistent storage) / SQLite via `aiosqlite` (isolated test suite).
- **Security & Authentication:** Argon2 password hashing (`argon2-cffi`), JWT session cookies (`HttpOnly`, `SameSite=Lax`, `Secure` in production), CSRF protection.
- **Testing:** `pytest` + `pytest-asyncio` + `httpx` with in-memory isolated fixtures.

---

## 📐 Architecture Overview

```mermaid
graph TD
    subgraph Frontend ["Next.js 16 (Port 3002)"]
        UI["Tailwind CSS v4 + Stitch Precision Design System"]
        AuthContext["Auth Context & Session Manager (HttpOnly Cookies)"]
        Pages["Overview Dashboard | Onboarding | Login | Register | Due Dates | AI Coach"]
        Client["TypeScript API Client (src/lib/api.ts)"]
    end

    subgraph Backend ["FastAPI API (Port 8001)"]
        AuthAPI["Authentication Endpoints (/auth/* & /api/v1/auth/*)"]
        TasksAPI["User-Isolated Tasks Endpoints (/api/v1/tasks)"]
        AuthDeps["get_current_user Dependency (JWT + Argon2)"]
        Agent["StudyCoachAgent (Feasibility Evaluation & Planner)"]
        SRS["Spaced Repetition Engine (SuperMemo-2 SM-2)"]
    end

    subgraph Database ["Persistence Layer"]
        NeonDB[("Neon PostgreSQL Database\n(Pooled App Traffic: -pooler.neon.tech\nDirect Migrations: .neon.tech)")]
        Mig["Alembic Async Migrations (alembic/versions/)"]
    end

    Pages --> AuthContext
    AuthContext --> Client
    Client -->|HTTP / Cookies / JSON| AuthAPI
    Client -->|HTTP / Cookies / JSON| TasksAPI
    AuthAPI --> AuthDeps
    TasksAPI --> AuthDeps
    AuthDeps --> NeonDB
    Mig --> NeonDB
```

---

## 🐘 Neon PostgreSQL Configuration

StudyPilot AI connects to Neon PostgreSQL through async SQLAlchemy using the `asyncpg` driver:

1. **Pooled Connection for Normal Traffic:**
   Copy your pooled connection string from the Neon console into `backend/.env`:
   ```env
   DATABASE_URL="postgresql://user:password@ep-project-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
   ```
2. **SSL Driver Compatibility:**
   Neon URLs contain `?sslmode=require`. The backend configuration automatically normalizes this parameter to `?ssl=require` as required by the `asyncpg` driver without manual rewriting.
3. **DDL Migrations (Direct Connection):**
   Neon poolers do not support transaction-scoped locks needed during migrations. Alembic automatically unpools the host (`-pooler.` -> `.`) or reads an optional `DIRECT_DATABASE_URL`:
   ```env
   DIRECT_DATABASE_URL="postgresql://user:password@ep-project.us-east-2.aws.neon.tech/neondb?sslmode=require"
   ```

---

## 🔐 Authentication & Authorization

### Endpoints
- `POST /auth/register` (also `/api/v1/auth/register`): Creates user with Argon2 password hash. Returns 409 Conflict if email is already taken. Sets `HttpOnly` JWT cookie.
- `POST /auth/login` (also `/api/v1/auth/login`): Verifies credentials. Returns generic 401 error preventing email enumeration. Sets `HttpOnly` cookie.
- `POST /auth/logout` (also `/api/v1/auth/logout`): Clears authentication cookies.
- `GET /auth/me` (also `/api/v1/auth/me`): Returns currently authenticated user details.
- `PATCH /auth/profile` (also `/api/v1/auth/profile`): Updates user profile and onboarding answers.

### User Roles & Dynamic Onboarding
StudyPilot supports two first-class account types:
1. **Student:** Academic profile fields (`education_level`, `institution`, `learning_stage`).
2. **Working Professional:** Industry profile fields (`current_role`, `experience_range`, `skill_level`).

Common registration collects full name, email, password, and account type. Onboarding provides role-specific fields with a "Skip for now" option.

### Strict Data Isolation
All task queries and mutations enforce `Task.user_id == current_user.id`. One user cannot read, update, complete, or delete tasks belonging to another user (returns HTTP 404 Not Found).

---

## 🚀 Running the Project

### 1. Backend Setup
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Or on Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Start FastAPI server on port 8001
uvicorn app.main:app --reload --port 8001
```

### 2. Frontend Setup
```bash
cd frontend
npm install

# Start Next.js on port 3002
npm run dev -- -p 3002
```

---

## 🤖 AI Study Coach — Phase 1: Gemini + LangChain Foundation

In Phase 1, StudyPilot AI establishes the core LLM foundation using **LangChain** (`langchain-google-genai`, `langchain-core`) and Google's Gemini models (`gemini-2.5-flash`), keeping all provider logic strictly isolated on the backend.

### Architecture & Service Design
- **Provider Interface (`LLMProvider`):** Abstract interface (`base.py`) decouple the agent from concrete LLM APIs.
- **LangChain Integration (`LangChainGeminiProvider`):** Uses `ChatGoogleGenerativeAI` and `ChatPromptTemplate` to format prompts, handle multi-turn history, and manage inference.
- **Security & Secret Isolation:** `GEMINI_API_KEY` is loaded strictly server-side from environment variables and never logged or exposed to the client.
- **Factual Grounding:** User's real verified study stats (completed tasks, focus hours, LeetCode count, and pending tasks) are dynamically injected into the system prompt.
- **Honest Error Handling:** Never returns fake or simulated AI responses on failure. Quota limits return HTTP 429, timeouts return HTTP 504, and unconfigured states return HTTP 503.
- **Document RAG Boundary:** Private document retrieval is explicitly designated for Phase 2. The coach avoids inventing citations or claiming access to unprovided files.

### Configuration
Add to `backend/.env`:
```env
LLM_PROVIDER="gemini"
GEMINI_API_KEY="your-gemini-api-key"
GEMINI_MODEL="gemini-2.5-flash"
LLM_TIMEOUT_SECONDS=30
LLM_MAX_OUTPUT_TOKENS=2048
LLM_RATE_LIMIT_PER_MINUTE=20
```

### API Endpoints
- `GET /api/v1/coach/health`: Safe readiness and configuration status without exposing credentials.
- `POST /api/v1/coach/chat`:
  - **Request Body:**
    ```json
    {
      "message": "Explain HNSW vs IVFFlat indexing trade-offs",
      "conversation_id": 1,
      "response_preference": "step_by_step"
    }
    ```
    *Response Preferences:* `"balanced"` (default), `"step_by_step"`, `"concise"`.
  - **Response Body:**
    ```json
    {
      "id": 42,
      "conversation_id": 1,
      "role": "assistant",
      "content": "...",
      "grounding_source": "Google Gemini via LangChain (gemini-2.5-flash)",
      "inference_ms": 1120
    }
    ```

---

## 📚 Document Ingestion, Embeddings & RAG Retrieval — Phase 2

Phase 2 introduces a production-grade Retrieval-Augmented Generation (RAG) architecture integrated into Neon PostgreSQL with `pgvector`, LangChain embeddings, and the Study Coach.

### 1. Ingestion & Storage Pipeline
1. **Document Upload:** Validates file signatures, MIME types, and size limits (15 MB maximum). Supported: `.pdf` (text-based), `.md` (Markdown), and `.txt` (Plain text).
2. **Private Storage Adapter:** Uploaded documents are securely saved to user-scoped local storage (`backend/storage/documents/user_{id}/`) rather than public cloud image storage.
3. **Integrity & Hashing:** Computes SHA-256 content hashes to detect duplicates and verify file integrity.
4. **Text Extraction:** Page-by-page extraction via `pypdf` retaining source page numbers. Gracefully flags encrypted or scanned image-only PDFs that require OCR.
5. **Paragraph-Aware Chunking:** Chunks text using natural double-newline paragraph boundaries, sentence detection, and a configurable sliding overlap (default: 1000 char chunks, 200 char overlap).
6. **Embeddings:** Generates 768-dimensional vector embeddings using Google's `models/text-embedding-004` in batched requests.
7. **pgvector Storage:** Inserts document chunks with `Vector(768)` embeddings into Neon PostgreSQL.

### 2. Semantic Retrieval & Study Coach Grounding
- **Owner-Scoped Filtering:** All vector queries enforce `DocumentChunk.user_id == current_user.id` and `Document.processing_status == 'ready'`. Users cannot search or retrieve other users' materials.
- **Cosine Distance Thresholding:** Configurable similarity threshold (`RAG_SIMILARITY_THRESHOLD=0.70`).
- **Knowledge Scope:** The Study Coach supports 3 explicit knowledge scopes:
  - `both`: Searches learning materials first; supplements with general engineering knowledge when notes lack detail.
  - `documents`: Strict RAG mode. If the documents do not cover the query, states so clearly without hallucinating.
  - `general`: General AI model knowledge.
- **Untrusted Context Guardrails:** Retrieved text is injected as untrusted reference material. System instructions prevent prompt injection attacks embedded inside document text.
- **Source Citations:** Returns structured source references (`sources` array) with document filename, page number, match percentage, and text snippet.

### 3. RAG Configuration
Add to `backend/.env`:
```env
EMBEDDING_PROVIDER="gemini"  # "gemini" | "mock"
EMBEDDING_MODEL="models/text-embedding-004"
EMBEDDING_DIMENSION=768
DOCUMENT_STORAGE_DIR="storage/documents"
MAX_DOCUMENT_SIZE_BYTES=15728640  # 15 MB
RAG_CHUNK_SIZE=1000
RAG_CHUNK_OVERLAP=200
RAG_DEFAULT_TOP_K=4
RAG_SIMILARITY_THRESHOLD=0.70
```

### 4. RAG API Endpoints
- `POST /api/v1/knowledge/documents`: Multipart upload (`file: UploadFile`)
- `GET /api/v1/knowledge/documents`: List user's indexed learning materials
- `GET /api/v1/knowledge/documents/{id}`: Retrieve document metadata and processing status
- `DELETE /api/v1/knowledge/documents/{id}`: Delete document, chunks, vectors, and physical file
- `POST /api/v1/knowledge/documents/{id}/reprocess`: Safely re-extract and re-embed without duplicates
- `POST /api/v1/knowledge/search`: Semantic similarity search endpoint returning matched passages and scores
- `POST /api/v1/coach/chat`: Extended with `knowledge_scope` (`both` | `documents` | `general`) and returning `sources`

---

## 🧪 Automated Verification Suite

Run full backend test suite covering authentication, multi-user isolation, LangChain Gemini provider, pgvector ingestion, chunking, semantic retrieval, and RAG coaching:
```bash
pytest backend/tests -v
```
*Result: 49 passed in 7.70s (zero paid API calls, hermetic mocks).*

Verify Next.js frontend production bundle:
```bash
cd frontend && npm run build
```
*Result: Successfully compiled and prerendered all 15 routes.*
