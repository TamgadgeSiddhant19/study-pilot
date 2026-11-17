const TOKEN_KEY = "studypilot_token";

let memoryToken: string | null = null;

export const getStoredToken = (): string | null => {
  if (memoryToken) return memoryToken;
  if (typeof window === "undefined") return null;
  try {
    const val = localStorage.getItem(TOKEN_KEY);
    memoryToken = val;
    return val;
  } catch {
    return null;
  }
};

export const setStoredToken = (token: string | null) => {
  memoryToken = token;
  if (typeof window === "undefined") return;
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {}
};

export const getApiBase = () => {
  const envBase = (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001").replace(/\/$/, "");
  const baseWithV1 = envBase.endsWith("/api/v1") ? envBase : `${envBase}/api/v1`;

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    // Align host (localhost vs 127.0.0.1) with browser URL so cookies and CORS remain same-site
    if (host === "localhost" && baseWithV1.includes("127.0.0.1")) {
      return baseWithV1.replace("127.0.0.1", "localhost");
    }
    if (host === "127.0.0.1" && baseWithV1.includes("localhost")) {
      return baseWithV1.replace("localhost", "127.0.0.1");
    }
  }

  return baseWithV1;
};

export const notifyDataChanged = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("studypilot-data-changed"));
  }
};

async function fetchJSON<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const apiBase = getApiBase();
  const url = `${apiBase}${endpoint}`;
  const token = getStoredToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };

  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, {
      credentials: "include",
      ...options,
      headers,
    });
    if (!res.ok) {
      if (res.status === 401 && typeof window !== "undefined" && !endpoint.startsWith("/auth/") && token) {
        window.dispatchEvent(new CustomEvent("studypilot-auth-expired", { detail: { token } }));
      }
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `Request failed with status ${res.status}`);
    }
    if (res.status === 204) {
      return {} as T;
    }
    return await res.json();
  } catch (err: any) {
    console.error(`[API Error] ${endpoint}:`, err);
    throw err;
  }
}

// 0. Real Authentication & User Session
export interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  account_type: "student" | "professional";
  education_level?: string;
  institution?: string;
  learning_stage?: string;
  current_role?: string;
  experience_range?: string;
  skill_level?: string;
  target_role?: string;
  target_date?: string;
  daily_flight_quota_hours?: number;
  is_onboarded: boolean;
  is_active: boolean;
  name?: string;
  csrf_token?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  csrf_token: string;
  user: AuthUser;
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
  account_type: "student" | "professional";
  education_level?: string;
  institution?: string;
  learning_stage?: string;
  current_role?: string;
  experience_range?: string;
  skill_level?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export const registerUser = async (data: RegisterPayload): Promise<AuthResponse> => {
  const res = await fetchJSON<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify(data) });
  if (res?.access_token) {
    setStoredToken(res.access_token);
  }
  return res;
};

export const loginUser = async (data: LoginPayload): Promise<AuthResponse> => {
  const res = await fetchJSON<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(data) });
  if (res?.access_token) {
    setStoredToken(res.access_token);
  }
  return res;
};

export const loginDemoUser = async (): Promise<AuthResponse> => {
  const res = await fetchJSON<AuthResponse>("/auth/demo", { method: "POST" });
  if (res?.access_token) {
    setStoredToken(res.access_token);
  }
  return res;
};

export const logoutUser = async (): Promise<{ message: string }> => {
  try {
    return await fetchJSON<{ message: string }>("/auth/logout", { method: "POST" });
  } finally {
    setStoredToken(null);
  }
};

export const getAuthMe = () =>
  fetchJSON<AuthUser>("/auth/me");

export const updateAuthProfile = (data: Partial<AuthUser>) =>
  fetchJSON<AuthUser>("/auth/profile", { method: "PATCH", body: JSON.stringify(data) });


// 1. Overview Analytics
export interface OverviewData {
  candidate_name: string;
  target_role: string;
  target_date: string;
  days_remaining: number;
  on_track_percentage: number;
  streak_days: number;
  weekly_velocity_percentage: number;
  daily_flight_quota_hours: number;
  flight_hours_today: number;
  flight_percentage: number;
  milestones_completed: number;
  milestones_total: number;
  milestones_percentage: number;
  leetcode: {
    total_solved: number;
    easy: number;
    medium: number;
    hard: number;
    srs_due: number;
  };
}

export const getOverviewAnalytics = () => fetchJSON<OverviewData>("/analytics/overview");

export interface DailyStreakRecord {
  date: string;
  day_name: string;
  day_of_month: number;
  month_name: string;
  hours: number;
  active: boolean;
  is_today: boolean;
}

export interface StreakData {
  current_streak: number;
  next_milestone: number;
  days_to_milestone: number;
  milestone_progress_pct: number;
  total_active_days: number;
  total_hours: number;
  average_daily_hours: number;
  daily_records: DailyStreakRecord[];
}

export const getStreakData = () => fetchJSON<StreakData>("/analytics/streak");

// 2. Tasks
export interface Task {
  id: number;
  title: string;
  subject: string;
  description?: string;
  priority: "P0" | "P1" | "P2";
  status: "todo" | "in_progress" | "completed";
  completed: boolean;
  estimated_minutes: number;
  actual_minutes: number;
  due_date?: string;
  completed_at?: string;
  created_at?: string;
}

export const getTasks = (params?: { completed?: boolean; priority?: string }) => {
  const query = new URLSearchParams();
  if (params?.completed !== undefined) query.set("completed", String(params.completed));
  if (params?.priority) query.set("priority", params.priority);
  const qStr = query.toString();
  return fetchJSON<Task[]>(`/tasks${qStr ? `?${qStr}` : ""}`);
};

export const createTask = async (data: Partial<Task>) => {
  const res = await fetchJSON<Task>("/tasks", { method: "POST", body: JSON.stringify(data) });
  notifyDataChanged();
  return res;
};

export const updateTask = async (id: number, data: Partial<Task>) => {
  const res = await fetchJSON<Task>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) });
  notifyDataChanged();
  return res;
};

export const deleteTask = async (id: number) => {
  const res = await fetchJSON<void>(`/tasks/${id}`, { method: "DELETE" });
  notifyDataChanged();
  return res;
};

export const carryForwardTasks = async () => {
  const res = await fetchJSON<Task[]>("/tasks/carry-forward", { method: "POST" });
  notifyDataChanged();
  return res;
};

// 3. Roadmaps
export interface RoadmapTopic {
  id: number;
  roadmap_id: number;
  title: string;
  category: string;
  description?: string;
  status: "not_started" | "in_progress" | "completed" | "mastered";
  mastery_percentage: number;
  estimated_hours: number;
}

export interface Roadmap {
  id: number;
  title: string;
  slug: string;
  description?: string;
  category: string;
  icon: string;
  color: string;
  topics: RoadmapTopic[];
}

export const getRoadmaps = () => fetchJSON<Roadmap[]>("/roadmaps");

export const updateTopicMastery = async (topicId: number, data: { status?: string; mastery_percentage?: number }) => {
  const res = await fetchJSON<RoadmapTopic>(`/roadmaps/topics/${topicId}`, { method: "PATCH", body: JSON.stringify(data) });
  notifyDataChanged();
  return res;
};

// 4. Focus Sessions
export interface FocusSession {
  id: number;
  task_id?: number;
  subject: string;
  duration_minutes: number;
  session_type: string;
  completed?: boolean;
  notes?: string;
  created_at: string;
}

export interface FocusStats {
  total_minutes_today: number;
  total_sessions_today: number;
  weekly_hours: number;
  current_streak_days: number;
}

export const getSessions = () => fetchJSON<FocusSession[]>("/sessions");

export const logFocusSession = async (data: {
  subject: string;
  duration_minutes: number;
  session_type?: string;
  notes?: string;
  task_id?: number;
  completed?: boolean;
}) => {
  const res = await fetchJSON<FocusSession>("/sessions", { method: "POST", body: JSON.stringify(data) });
  notifyDataChanged();
  return res;
};

export const getFocusStats = () => fetchJSON<FocusStats>("/sessions/stats");

// 5. LeetCode Tracker
export interface LeetCodeProblem {
  id: number;
  problem_number: number;
  title: string;
  url?: string;
  difficulty: "Easy" | "Medium" | "Hard";
  topics: string;
  pattern: string;
  status: "Solved" | "In Progress" | "Review Needed";
  time_complexity: string;
  space_complexity: string;
  notes?: string;
  attempts: number;
  interval_days: number;
  repetitions: number;
  next_review_at?: string;
}

export interface LeetCodeStats {
  total_solved: number;
  easy_count: number;
  medium_count: number;
  hard_count: number;
  due_reviews_count: number;
  overdue_count: number;
}

export const getLeetCodeProblems = (srsDueOnly?: boolean) =>
  fetchJSON<LeetCodeProblem[]>(`/leetcode${srsDueOnly ? "?srs_due_only=true" : ""}`);

export const logLeetCodeProblem = async (data: Partial<LeetCodeProblem>) => {
  const res = await fetchJSON<LeetCodeProblem>("/leetcode", { method: "POST", body: JSON.stringify(data) });
  notifyDataChanged();
  return res;
};

export const toggleLeetCodeProblem = async (data: Partial<LeetCodeProblem>): Promise<{ problem_number: number; solved: boolean; id: number | null }> => {
  const res = await fetchJSON<{ problem_number: number; solved: boolean; id: number | null }>("/leetcode/toggle", {
    method: "POST",
    body: JSON.stringify(data),
  });
  notifyDataChanged();
  return res;
};

export const submitSRSReview = async (problemId: number, quality: number) => {
  const res = await fetchJSON<LeetCodeProblem>(`/leetcode/${problemId}/review`, { method: "POST", body: JSON.stringify({ quality }) });
  notifyDataChanged();
  return res;
};

export const deleteLeetCodeProblem = async (problemId: number) => {
  const res = await fetchJSON<void>(`/leetcode/${problemId}`, { method: "DELETE" });
  notifyDataChanged();
  return res;
};

export const getLeetCodeStats = () => fetchJSON<LeetCodeStats>("/leetcode/stats");

// 6. Resources
export interface LearningResource {
  id: number;
  title: string;
  url: string;
  category: "article" | "documentation" | "course" | "video" | "paper" | "book";
  subject: string;
  rating: number;
  notes?: string;
  status: "bookmarked" | "reading" | "completed";
  created_at: string;
}

export const getResources = (category?: string) =>
  fetchJSON<LearningResource[]>(`/resources${category ? `?category=${category}` : ""}`);

export const createResource = async (data: Partial<LearningResource>) => {
  const res = await fetchJSON<LearningResource>("/resources", { method: "POST", body: JSON.stringify(data) });
  notifyDataChanged();
  return res;
};

export const updateResource = async (id: number, data: Partial<LearningResource>) => {
  const res = await fetchJSON<LearningResource>(`/resources/${id}`, { method: "PATCH", body: JSON.stringify(data) });
  notifyDataChanged();
  return res;
};

export const deleteResource = async (id: number) => {
  const res = await fetchJSON<void>(`/resources/${id}`, { method: "DELETE" });
  notifyDataChanged();
  return res;
};

export interface RAGSource {
  document_id: number;
  filename: string;
  chunk_id?: number;
  page_number?: number;
  section?: string;
  similarity_score: number;
  snippet: string;
}

export interface ActionProposal {
  id: number;
  action_type: string;
  status: string;
  summary: string;
  payload: any;
  created_at?: string;
  expires_at?: string;
}

export interface ActionExecutionResult {
  status: string;
  proposal_id: number;
  action_type: string;
  message: string;
  details?: Record<string, any>;
}

// 7. AI Study Coach
export interface CoachMessage {
  id: number;
  conversation_id?: number;
  role: "user" | "assistant" | "system";
  content: string;
  grounding_source?: string;
  sources?: RAGSource[];
  rag_used?: boolean;
  evidence_sufficient?: boolean;
  proposed_actions?: ActionProposal[];
  inference_ms?: number;
  depth?: string;
  tags?: string;
  structured_plan?: string;
  created_at?: string;
}

export interface CoachConversation {
  id: number;
  title: string;
  track: string;
  messages: CoachMessage[];
}

export interface StudyPlanItem {
  title: string;
  subject: string;
  duration_minutes: number;
  priority: string;
  prerequisite?: string;
  completion_criteria: string;
}

export interface StructuredPlan {
  target_role: string;
  timeframe_days: number;
  daily_quota_hours: number;
  feasibility_score: number;
  is_realistic: boolean;
  assessment_notes: string;
  warnings: string[];
  proposed_tasks: StudyPlanItem[];
}

export const getCoachConversations = () => fetchJSON<CoachConversation[]>("/coach/conversations");

export const sendCoachMessage = (
  message: string,
  conversation_id?: number,
  response_preference?: "balanced" | "concise" | "step_by_step",
  knowledge_scope?: "both" | "documents" | "general"
) =>
  fetchJSON<CoachMessage>("/coach/chat", {
    method: "POST",
    body: JSON.stringify({ message, conversation_id, response_preference, knowledge_scope }),
  });

export const getPendingActionProposals = () =>
  fetchJSON<ActionProposal[]>("/coach/actions/pending");

export const confirmActionProposal = async (proposalId: number): Promise<ActionExecutionResult> => {
  const res = await fetchJSON<ActionExecutionResult>(`/coach/actions/${proposalId}/confirm`, { method: "POST" });
  notifyDataChanged();
  return res;
};

export const rejectActionProposal = async (proposalId: number): Promise<ActionExecutionResult> => {
  const res = await fetchJSON<ActionExecutionResult>(`/coach/actions/${proposalId}/reject`, { method: "POST" });
  notifyDataChanged();
  return res;
};

// 8. RAG Knowledge Documents
export interface DocumentItem {
  id: number;
  user_id: number;
  filename: string;
  content_type: string;
  file_size_bytes: number;
  processing_status: "uploaded" | "processing" | "ready" | "failed";
  error_message?: string;
  chunk_count: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentListResponse {
  documents: DocumentItem[];
  total: number;
}

export interface RAGSearchResultItem {
  chunk_id: number;
  document_id: number;
  document_title: string;
  chunk_text: string;
  page_number?: number;
  section?: string;
  similarity_score: number;
  distance: number;
}

export interface DocumentChunkPreview {
  id: number;
  chunk_index: number;
  page_number?: number;
  section?: string;
  chunk_text: string;
}

export interface DocumentPreview {
  document_id: number;
  filename: string;
  content_type: string;
  processing_status: string;
  chunk_count: number;
  chunks: DocumentChunkPreview[];
  total_chunks: number;
}

export const getDocuments = () => fetchJSON<DocumentListResponse>("/knowledge/documents");

export const getDocumentPreview = (documentId: number, limit = 10) =>
  fetchJSON<DocumentPreview>(`/knowledge/documents/${documentId}/preview?limit=${limit}`);

export const uploadDocument = async (file: File): Promise<DocumentItem> => {
  const formData = new FormData();
  formData.append("file", file);

  const apiBase = getApiBase();
  const token = getStoredToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${apiBase}/knowledge/documents`, {
    method: "POST",
    body: formData,
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    let errorDetail = `Failed to upload document (${res.status})`;
    try {
      const errJson = await res.json();
      if (errJson?.detail) errorDetail = errJson.detail;
    } catch {}
    throw new Error(errorDetail);
  }

  return res.json();
};

export const deleteDocument = (documentId: number) =>
  fetchJSON<{ status: string; message: string }>(`/knowledge/documents/${documentId}`, {
    method: "DELETE",
  });

export const reprocessDocument = (documentId: number) =>
  fetchJSON<DocumentItem>(`/knowledge/documents/${documentId}/reprocess`, {
    method: "POST",
  });

export const searchKnowledge = (query: string, top_k = 4) =>
  fetchJSON<{ query: string; results: RAGSearchResultItem[]; total_found: number }>("/knowledge/search", {
    method: "POST",
    body: JSON.stringify({ query, top_k }),
  });

export const generateCoachPlan = (data: {
  learning_goal: string;
  available_hours_per_day: number;
  deadline_days: number;
  current_skill_level: string;
  completed_topics: string[];
}) => fetchJSON<StructuredPlan>("/coach/plan", { method: "POST", body: JSON.stringify(data) });

export const applyCoachPlan = (plan: StructuredPlan) =>
  fetchJSON<{ status: string; tasks_created: number }>("/coach/plan/apply", {
    method: "POST",
    body: JSON.stringify(plan),
  });

export const resetCoachContext = () => fetchJSON<{ status: string }>("/coach/reset", { method: "POST" });

// 9. StudyPilot CodeLab — Online Compiler & Code Execution Engine
export interface CodeExecutionRequest {
  language: string;
  source_code: string;
  stdin?: string;
  cpu_time_limit?: number;
  memory_limit?: number;
}

export interface CodeExecutionResponse {
  token?: string;
  status: string;
  status_id: number;
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  time?: number | null;
  memory?: number | null;
  exit_code?: number | null;
  language: string;
  created_at: string;
}

export interface SupportedLanguageItem {
  key: string;
  name: string;
  judge0_id: number;
  starter_code: string;
}

export const executeCode = (payload: CodeExecutionRequest): Promise<CodeExecutionResponse> =>
  fetchJSON<CodeExecutionResponse>("/code/execute", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getCodeStatus = (token: string, language = "python"): Promise<CodeExecutionResponse> =>
  fetchJSON<CodeExecutionResponse>(`/code/status/${token}?language=${encodeURIComponent(language)}`);

export const getSupportedLanguages = (): Promise<SupportedLanguageItem[]> =>
  fetchJSON<SupportedLanguageItem[]>("/code/languages");

