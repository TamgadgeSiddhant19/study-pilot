"use client";

import React, { useState, useEffect, useRef, useCallback, Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import {
  executeCode,
  toggleLeetCodeProblem,
  CodeExecutionResponse,
} from "@/lib/api";
import {
  ALL_SHEET_PROBLEMS,
  SheetProblem,
  DSASheetId,
} from "@/data/dsaSheets";
import {
  getProblemFullDetails,
  ProblemFullDetails,
} from "@/data/problemDetails";
import {
  Play,
  RotateCcw,
  Terminal,
  Code2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Cpu,
  Layers,
  Copy,
  Check,
  Loader2,
  ExternalLink,
  Sparkles,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  FileText,
  Bookmark,
  Star,
  Send,
  HelpCircle,
  CheckCheck,
} from "lucide-react";

// Dynamically import Monaco Editor to ensure SSR safety
const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-slate-900 text-slate-400 gap-3">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
      <span className="text-xs font-mono">Loading CodeLab Editor...</span>
    </div>
  ),
});

const MONACO_LANG_MAP: Record<string, string> = {
  cpp: "cpp",
  java: "java",
  python: "python",
};

const LOCAL_SOLVED_KEY = "studypilot_sheet_solved_v1";
const LOCAL_STARRED_KEY = "studypilot_sheet_starred_v1";

function CodeLabWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const problemParam = searchParams.get("problem");
  const sheetParam = (searchParams.get("sheet") as DSASheetId) || "neetcode150";

  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { theme } = useTheme();

  // Find problem from param (by slug or by id)
  const currentProblem: SheetProblem = useMemo(() => {
    if (problemParam) {
      const bySlug = ALL_SHEET_PROBLEMS.find(
        (p) => p.slug.toLowerCase() === problemParam.toLowerCase()
      );
      if (bySlug) return bySlug;
      const idNum = parseInt(problemParam, 10);
      if (!isNaN(idNum)) {
        const byId = ALL_SHEET_PROBLEMS.find((p) => p.id === idNum);
        if (byId) return byId;
      }
    }
    // Default to Valid Anagram or Contains Duplicate
    return ALL_SHEET_PROBLEMS.find((p) => p.id === 242) || ALL_SHEET_PROBLEMS[0];
  }, [problemParam]);

  // Full problem details (description, examples, constraints, starter templates)
  const problemDetails: ProblemFullDetails = useMemo(() => {
    return getProblemFullDetails(currentProblem);
  }, [currentProblem]);

  // Solved and Starred state
  const [solvedSet, setSolvedSet] = useState<Set<number>>(new Set());
  const [starredSet, setStarredSet] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const s = localStorage.getItem(LOCAL_SOLVED_KEY);
      if (s) setSolvedSet(new Set(JSON.parse(s)));
      const star = localStorage.getItem(LOCAL_STARRED_KEY);
      if (star) setStarredSet(new Set(JSON.parse(star)));
    } catch {}
  }, []);

  const isSolved = solvedSet.has(currentProblem.id);
  const isStarred = starredSet.has(currentProblem.id);

  const toggleSolved = async () => {
    const updated = new Set(solvedSet);
    if (isSolved) {
      updated.delete(currentProblem.id);
    } else {
      updated.add(currentProblem.id);
    }
    setSolvedSet(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_SOLVED_KEY, JSON.stringify(Array.from(updated)));
    }

    if (user) {
      try {
        await toggleLeetCodeProblem({
          problem_number: currentProblem.id,
          title: currentProblem.title,
          difficulty: currentProblem.difficulty,
          pattern: currentProblem.pattern,
          topics: currentProblem.category,
          url: currentProblem.leetcodeUrl,
          time_complexity: currentProblem.timeComplexity,
          space_complexity: currentProblem.spaceComplexity,
          notes: currentProblem.hint,
        });
      } catch (e) {
        console.error("Failed to sync status:", e);
      }
    }
  };

  const toggleStar = () => {
    const updated = new Set(starredSet);
    if (isStarred) {
      updated.delete(currentProblem.id);
    } else {
      updated.add(currentProblem.id);
    }
    setStarredSet(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_STARRED_KEY, JSON.stringify(Array.from(updated)));
    }
  };

  // Find previous and next problem index in current list
  const currentSheetProblems = useMemo(() => {
    return ALL_SHEET_PROBLEMS.filter((p) => p.sheets.includes(sheetParam));
  }, [sheetParam]);

  const currentIndex = currentSheetProblems.findIndex((p) => p.id === currentProblem.id);
  const prevProblem = currentIndex > 0 ? currentSheetProblems[currentIndex - 1] : null;
  const nextProblem =
    currentIndex >= 0 && currentIndex < currentSheetProblems.length - 1
      ? currentSheetProblems[currentIndex + 1]
      : null;

  // Selected language & Editor code
  const [language, setLanguage] = useState<string>("python");
  const [sourceCode, setSourceCode] = useState<string>("");
  const [fontSize, setFontSize] = useState<number>(14);

  // Load starter code on problem or language change
  useEffect(() => {
    const saved = localStorage.getItem(`codelab_user_code_${currentProblem.id}_${language}`);
    if (saved) {
      setSourceCode(saved);
    } else {
      const template =
        language === "cpp"
          ? problemDetails.starterCode.cpp
          : language === "java"
          ? problemDetails.starterCode.java
          : problemDetails.starterCode.python;
      setSourceCode(template);
    }
    setExecutionResult(null);
    setErrorMsg(null);
  }, [currentProblem.id, language, problemDetails]);

  // Left panel active tab
  const [activeLeftTab, setActiveLeftTab] = useState<"question" | "hints" | "notes">("question");
  const [userNote, setUserNote] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const notes = localStorage.getItem("studypilot_sheet_notes_v1");
    if (notes) {
      try {
        const parsed = JSON.parse(notes);
        setUserNote(parsed[currentProblem.id] || "");
      } catch {}
    }
  }, [currentProblem.id]);

  const handleSaveNote = (val: string) => {
    setUserNote(val);
    try {
      const notes = localStorage.getItem("studypilot_sheet_notes_v1");
      const parsed = notes ? JSON.parse(notes) : {};
      parsed[currentProblem.id] = val;
      localStorage.setItem("studypilot_sheet_notes_v1", JSON.stringify(parsed));
    } catch {}
  };

  // Right panel console state
  const [consoleOpen, setConsoleOpen] = useState<boolean>(true);
  const [activeConsoleTab, setActiveConsoleTab] = useState<"testcase" | "stdout" | "diagnostics" | "metrics">("stdout");
  const [stdin, setStdin] = useState<string>("");
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionSuccess, setSubmissionSuccess] = useState<boolean | null>(null);
  const [executionResult, setExecutionResult] = useState<CodeExecutionResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedOutput, setCopiedOutput] = useState<boolean>(false);

  // Prepopulate custom STDIN with Example 1 input
  useEffect(() => {
    if (problemDetails.examples && problemDetails.examples.length > 0) {
      setStdin(problemDetails.examples[0].input);
    }
  }, [problemDetails]);

  // Language Change
  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
  };

  // Code change
  const handleCodeChange = (val: string | undefined) => {
    const code = val || "";
    setSourceCode(code);
    try {
      localStorage.setItem(`codelab_user_code_${currentProblem.id}_${language}`, code);
    } catch {}
  };

  // Reset Code
  const handleResetCode = () => {
    const template =
      language === "cpp"
        ? problemDetails.starterCode.cpp
        : language === "java"
        ? problemDetails.starterCode.java
        : problemDetails.starterCode.python;
    setSourceCode(template);
    try {
      localStorage.setItem(`codelab_user_code_${currentProblem.id}_${language}`, template);
    } catch {}
    setExecutionResult(null);
    setErrorMsg(null);
    setSubmissionSuccess(null);
  };

  // Run Code in Judge0 sandbox
  const handleRunCode = useCallback(async () => {
    if (isRunning) return;
    if (!sourceCode.trim()) {
      setErrorMsg("Source code cannot be empty.");
      return;
    }

    if (!isAuthenticated) {
      setErrorMsg("Please sign in or use demo student login to execute code.");
      return;
    }

    setIsRunning(true);
    setErrorMsg(null);
    setSubmissionSuccess(null);
    setConsoleOpen(true);

    try {
      const response = await executeCode({
        language,
        source_code: sourceCode,
        stdin: stdin.trim() ? stdin : undefined,
      });

      setExecutionResult(response);

      if (response.status_id === 6 || (response.status_id >= 7 && response.status_id <= 12)) {
        setActiveConsoleTab("diagnostics");
      } else {
        setActiveConsoleTab("stdout");
      }
    } catch (err: any) {
      console.error("Execution failed:", err);
      setErrorMsg(err.message || "Failed to execute code in sandbox.");
      setActiveConsoleTab("diagnostics");
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, sourceCode, stdin, language, isAuthenticated]);

  // Submit Solution
  const handleSubmitCode = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setConsoleOpen(true);
    await handleRunCode();
    // Mark as solved on accepted execution
    if (!isSolved) {
      await toggleSolved();
    }
    setSubmissionSuccess(true);
    setIsSubmitting(false);
  };

  // Keyboard shortcut Ctrl+Enter to run
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleRunCode();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleRunCode]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedOutput(true);
    setTimeout(() => setCopiedOutput(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 font-body flex flex-col">
      {/* ============================================================== */}
      {/* TOP COMPACT NAVIGATION BAR (LeetCode / NeetCode Style)         */}
      {/* ============================================================== */}
      <header className="h-13 bg-[#1E293B] border-b border-slate-700/60 px-4 flex items-center justify-between gap-3 flex-shrink-0 z-30">
        <div className="flex items-center gap-3">
          {/* Back to Questions List Button */}
          <Link
            href="/leetcode"
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700/80"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">All Questions</span>
          </Link>

          {/* Sheet & Problem Navigator */}
          <div className="flex items-center gap-1 text-xs">
            <span className="px-2 py-0.5 rounded bg-primary/20 text-primary font-mono font-semibold text-[11px] hidden md:inline">
              {sheetParam === "neetcode150"
                ? "NeetCode 150"
                : sheetParam === "blind75"
                ? "Blind 75"
                : "Striver's A2Z"}
            </span>

            {/* Prev / Next Question Buttons */}
            <div className="flex items-center gap-0.5 ml-1">
              <button
                disabled={!prevProblem}
                onClick={() =>
                  prevProblem &&
                  router.push(`/codelab?problem=${prevProblem.slug}&sheet=${sheetParam}`)
                }
                title={prevProblem ? `Previous: ${prevProblem.title}` : "No previous problem"}
                className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={!nextProblem}
                onClick={() =>
                  nextProblem &&
                  router.push(`/codelab?problem=${nextProblem.slug}&sheet=${sheetParam}`)
                }
                title={nextProblem ? `Next: ${nextProblem.title}` : "No next problem"}
                className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Current Problem Name with Mark Solved */}
            <div className="flex items-center gap-2 ml-1">
              <span className="font-bold text-sm text-white flex items-center gap-1.5">
                <span>{currentProblem.id}.</span>
                <span>{currentProblem.title}</span>
              </span>

              {/* Status Mark Solved Button */}
              <button
                onClick={toggleSolved}
                className="cursor-pointer transition-transform active:scale-95"
                title={isSolved ? "Mark as unsolved" : "Mark as solved"}
              >
                {isSolved ? (
                  <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full border border-slate-500 hover:border-emerald-400 hover:bg-emerald-500/10 transition-colors" />
                )}
              </button>

              {/* Star Bookmark */}
              <button
                onClick={toggleStar}
                className="p-1 text-slate-400 hover:text-amber-400 transition-colors"
                title={isStarred ? "Starred" : "Star problem"}
              >
                <Star
                  className={`w-4 h-4 ${
                    isStarred ? "text-amber-400 fill-amber-400" : ""
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Right Controls: Language, Run, Submit */}
        <div className="flex items-center gap-2.5">
          {/* Language Selector */}
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 font-mono text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="python">Python 3</option>
            <option value="java">Java 21</option>
            <option value="cpp">C++17</option>
          </select>

          {/* Reset Code */}
          <button
            onClick={handleResetCode}
            title="Reset code to starter template"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors border border-slate-700/80 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Run Code Button */}
          <button
            onClick={handleRunCode}
            disabled={isRunning}
            className={`px-3.5 py-1.5 rounded-lg font-mono text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              isRunning
                ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                : "bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 active:scale-95"
            }`}
          >
            {isRunning ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current text-slate-200" />
                <span>Run</span>
                <kbd className="hidden md:inline-block text-[10px] bg-slate-900 px-1 py-0.2 rounded text-slate-400 font-mono">
                  Ctrl+Enter
                </kbd>
              </>
            )}
          </button>

          {/* Submit Button */}
          <button
            onClick={handleSubmitCode}
            disabled={isSubmitting || isRunning}
            className={`px-4 py-1.5 rounded-lg font-mono text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              isSubmitting
                ? "bg-emerald-600/60 text-white cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs active:scale-95"
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Submit</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* ============================================================== */}
      {/* MAIN SPLIT SCREEN: LEFT QUESTION PANE & RIGHT CODE IDE PANE   */}
      {/* ============================================================== */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden">
        {/* ==================== LEFT PANE: QUESTION WORKSPACE ==================== */}
        <div className="lg:col-span-5 border-r border-slate-700/60 bg-[#0B1329] flex flex-col min-h-0 overflow-hidden">
          {/* Question Tabs: Question, Solution/Hints, Notes */}
          <div className="h-10 bg-[#131D36] border-b border-slate-700/60 px-3 flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setActiveLeftTab("question")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeLeftTab === "question"
                  ? "bg-[#1E293B] text-primary"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Question</span>
            </button>

            <button
              onClick={() => setActiveLeftTab("hints")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeLeftTab === "hints"
                  ? "bg-[#1E293B] text-primary"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Hints &amp; Approach</span>
            </button>

            <button
              onClick={() => setActiveLeftTab("notes")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeLeftTab === "notes"
                  ? "bg-[#1E293B] text-primary"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Personal Notes</span>
            </button>
          </div>

          {/* Question Tab Content (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-5 text-xs text-slate-300 space-y-5 leading-relaxed">
            {/* TAB 1: QUESTION DESCRIPTION & EXAMPLES */}
            {activeLeftTab === "question" && (
              <div className="space-y-5">
                {/* Title & Metadata Tags */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl font-bold text-white tracking-tight">
                      {currentProblem.title}
                    </h1>
                    {isSolved && (
                      <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`font-mono text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        currentProblem.difficulty === "Easy"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : currentProblem.difficulty === "Medium"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      }`}
                    >
                      {currentProblem.difficulty}
                    </span>

                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[11px]">
                      {currentProblem.category}
                    </span>

                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[11px]">
                      {currentProblem.pattern}
                    </span>

                    <a
                      href={currentProblem.leetcodeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto text-slate-400 hover:text-primary flex items-center gap-1 font-mono text-[11px]"
                    >
                      <span>LeetCode</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {/* Problem Description Text */}
                <div className="text-slate-200 text-sm space-y-3 whitespace-pre-wrap leading-relaxed">
                  {problemDetails.description}
                </div>

                {/* Examples Box */}
                <div className="space-y-3 pt-2">
                  <h3 className="font-semibold text-slate-200 text-xs uppercase tracking-wider font-mono">
                    Examples
                  </h3>

                  {problemDetails.examples.map((ex, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-[#131D36] border border-slate-700/60 space-y-1.5 font-mono text-xs"
                    >
                      <div className="font-bold text-slate-200 text-[11px]">
                        Example {idx + 1}:
                      </div>
                      <div>
                        <span className="text-slate-400">Input: </span>
                        <span className="text-emerald-300">{ex.input}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Output: </span>
                        <span className="text-emerald-400 font-bold">{ex.output}</span>
                      </div>
                      {ex.explanation && (
                        <div className="text-slate-400 text-[11px] font-sans pt-1">
                          <span className="font-semibold text-slate-300">Explanation: </span>
                          {ex.explanation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Constraints List */}
                <div className="space-y-2 pt-2">
                  <h3 className="font-semibold text-slate-200 text-xs uppercase tracking-wider font-mono">
                    Constraints
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-slate-400 font-mono text-xs">
                    {problemDetails.constraints.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* TAB 2: HINTS & APPROACH */}
            {activeLeftTab === "hints" && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 space-y-2">
                  <div className="flex items-center gap-1.5 text-primary font-bold">
                    <Sparkles className="w-4 h-4" />
                    <span>Algorithmic Pattern</span>
                  </div>
                  <p className="text-sm font-semibold text-white">
                    {currentProblem.pattern}
                  </p>
                  <p className="text-xs text-slate-300">
                    {currentProblem.hint}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-[#131D36] border border-slate-700/60 space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 font-mono">
                      Target Time Complexity
                    </span>
                    <div className="font-mono text-sm font-bold text-emerald-400">
                      {currentProblem.timeComplexity}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#131D36] border border-slate-700/60 space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 font-mono">
                      Target Space Complexity
                    </span>
                    <div className="font-mono text-sm font-bold text-sky-400">
                      {currentProblem.spaceComplexity}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: NOTES & SCRATCHPAD */}
            {activeLeftTab === "notes" && (
              <div className="space-y-3 h-full flex flex-col">
                <div className="text-xs text-slate-400">
                  Save your personal notes, trade-offs, and key insights for this question.
                </div>
                <textarea
                  value={userNote}
                  onChange={(e) => handleSaveNote(e.target.value)}
                  placeholder="Write notes here... (e.g. remember to check empty edge cases, two-pointer trick, etc.)"
                  className="w-full flex-1 min-h-[300px] p-3 rounded-xl bg-[#131D36] border border-slate-700/60 text-slate-200 placeholder-slate-500 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* ==================== RIGHT PANE: MONACO EDITOR & CONSOLE ==================== */}
        <div className="lg:col-span-7 flex flex-col min-h-0 bg-[#0F172A] overflow-hidden">
          {/* Editor Header Bar */}
          <div className="h-10 bg-[#131D36] border-b border-slate-700/60 px-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <Code2 className="w-3.5 h-3.5 text-primary" />
              <span className="font-mono text-xs text-slate-200 font-semibold">
                {language === "cpp"
                  ? "main.cpp"
                  : language === "java"
                  ? "Main.java"
                  : "solution.py"}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <span className="text-[10px]">Font:</span>
              <button
                onClick={() => setFontSize((f) => Math.max(12, f - 1))}
                className="px-1.5 py-0.5 rounded hover:bg-slate-800"
              >
                -
              </button>
              <span>{fontSize}px</span>
              <button
                onClick={() => setFontSize((f) => Math.min(20, f + 1))}
                className="px-1.5 py-0.5 rounded hover:bg-slate-800"
              >
                +
              </button>
            </div>
          </div>

          {/* Monaco Editor Component */}
          <div className="flex-1 min-h-0 w-full relative">
            <Editor
              height="100%"
              language={MONACO_LANG_MAP[language] || "python"}
              theme="vs-dark"
              value={sourceCode}
              onChange={handleCodeChange}
              options={{
                fontSize,
                minimap: { enabled: false },
                automaticLayout: true,
                scrollBeyondLastLine: false,
                tabSize: 4,
                lineNumbers: "on",
                padding: { top: 12, bottom: 12 },
                wordWrap: "on",
                suggestOnTriggerCharacters: true,
                bracketPairColorization: { enabled: true },
              }}
            />
          </div>

          {/* Collapsible Console Drawer at Bottom */}
          <div
            className={`border-t border-slate-700/60 bg-[#131D36] flex flex-col flex-shrink-0 transition-all duration-200 ${
              consoleOpen ? "h-64 sm:h-72" : "h-9"
            }`}
          >
            {/* Console Bar Header */}
            <div className="h-9 px-4 bg-[#1E293B] flex items-center justify-between border-b border-slate-700/60 select-none">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setConsoleOpen(!consoleOpen)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
                >
                  <Terminal className="w-3.5 h-3.5 text-primary" />
                  <span>Console</span>
                  {consoleOpen ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  ) : (
                    <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </button>

                {consoleOpen && (
                  <div className="flex items-center gap-1 ml-4 text-xs font-mono">
                    <button
                      onClick={() => setActiveConsoleTab("stdout")}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                        activeConsoleTab === "stdout"
                          ? "bg-slate-800 text-primary"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Output
                    </button>
                    <button
                      onClick={() => setActiveConsoleTab("testcase")}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                        activeConsoleTab === "testcase"
                          ? "bg-slate-800 text-primary"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Test Case (STDIN)
                    </button>
                    <button
                      onClick={() => setActiveConsoleTab("diagnostics")}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                        activeConsoleTab === "diagnostics"
                          ? "bg-slate-800 text-primary"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Errors
                      {(executionResult?.compile_output || executionResult?.stderr || errorMsg) && (
                        <span className="ml-1 w-1.5 h-1.5 rounded-full bg-rose-500 inline-block"></span>
                      )}
                    </button>
                    <button
                      onClick={() => setActiveConsoleTab("metrics")}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                        activeConsoleTab === "metrics"
                          ? "bg-slate-800 text-primary"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Metrics
                    </button>
                  </div>
                )}
              </div>

              {/* Status / Verdict Badge */}
              <div className="flex items-center gap-2">
                {executionResult && (
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded font-mono font-semibold ${
                      executionResult.status_id === 3
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                    }`}
                  >
                    {executionResult.status}
                  </span>
                )}
              </div>
            </div>

            {/* Console Content Canvas */}
            {consoleOpen && (
              <div className="flex-1 p-3.5 font-mono text-xs overflow-y-auto bg-[#0B1329] text-slate-200">
                {/* TAB 1: OUTPUT */}
                {activeConsoleTab === "stdout" && (
                  <div className="h-full flex flex-col">
                    {isRunning ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        <span>Compiling and executing in sandbox...</span>
                      </div>
                    ) : executionResult ? (
                      <div className="h-full flex flex-col">
                        <div className="flex items-center justify-between pb-1 text-slate-400 text-[11px]">
                          <span>Program Standard Output:</span>
                          <button
                            onClick={() => copyToClipboard(executionResult.stdout || "")}
                            className="hover:text-white flex items-center gap-1 cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            <span>{copiedOutput ? "Copied" : "Copy"}</span>
                          </button>
                        </div>
                        <pre className="flex-1 whitespace-pre-wrap break-all text-emerald-300 bg-[#0F172A] p-2.5 rounded-lg border border-slate-800">
                          {executionResult.stdout || "(No stdout output generated)"}
                        </pre>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-1.5 text-center">
                        <Terminal className="w-6 h-6 opacity-40" />
                        <span>Click &quot;Run&quot; or press Ctrl+Enter to execute test code.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: TEST CASE (STDIN) */}
                {activeConsoleTab === "testcase" && (
                  <div className="h-full flex flex-col space-y-1.5">
                    <span className="text-[11px] text-slate-400">
                      Test Case Input (STDIN passed to cin / sys.stdin):
                    </span>
                    <textarea
                      value={stdin}
                      onChange={(e) => setStdin(e.target.value)}
                      placeholder="Enter custom test input here..."
                      className="flex-1 w-full bg-[#0F172A] p-2.5 rounded-lg border border-slate-800 text-slate-200 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                    />
                  </div>
                )}

                {/* TAB 3: DIAGNOSTICS & ERRORS */}
                {activeConsoleTab === "diagnostics" && (
                  <div className="h-full space-y-2 overflow-y-auto">
                    {errorMsg && (
                      <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">
                        {errorMsg}
                      </div>
                    )}
                    {executionResult?.compile_output && (
                      <div>
                        <div className="text-[11px] text-amber-400 font-semibold mb-1">
                          Compiler Output:
                        </div>
                        <pre className="p-2.5 rounded-lg bg-slate-950 text-rose-300 border border-rose-900/40 whitespace-pre-wrap">
                          {executionResult.compile_output}
                        </pre>
                      </div>
                    )}
                    {executionResult?.stderr && (
                      <div>
                        <div className="text-[11px] text-rose-400 font-semibold mb-1">
                          Standard Error (stderr):
                        </div>
                        <pre className="p-2.5 rounded-lg bg-slate-950 text-rose-400 border border-rose-900/40 whitespace-pre-wrap">
                          {executionResult.stderr}
                        </pre>
                      </div>
                    )}
                    {!errorMsg && !executionResult?.compile_output && !executionResult?.stderr && (
                      <div className="h-full flex items-center justify-center text-slate-500">
                        No errors or compiler warnings reported.
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: METRICS */}
                {activeConsoleTab === "metrics" && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-[#0F172A] border border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">
                        Runtime
                      </span>
                      <div className="text-sm font-bold text-white">
                        {executionResult?.time ? `${executionResult.time} s` : "N/A"}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-[#0F172A] border border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">
                        Memory
                      </span>
                      <div className="text-sm font-bold text-white">
                        {executionResult?.memory ? `${executionResult.memory} KB` : "N/A"}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-[#0F172A] border border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">
                        Exit Code
                      </span>
                      <div className="text-sm font-bold text-white">
                        {executionResult?.exit_code != null ? executionResult.exit_code : "N/A"}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CodeLabPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <CodeLabWorkspace />
    </Suspense>
  );
}
