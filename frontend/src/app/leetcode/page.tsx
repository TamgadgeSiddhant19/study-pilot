"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { useAuth } from "@/context/AuthContext";
import {
  getLeetCodeProblems,
  getLeetCodeStats,
  logLeetCodeProblem,
  toggleLeetCodeProblem,
  submitSRSReview,
  deleteLeetCodeProblem,
  LeetCodeProblem,
  LeetCodeStats,
} from "@/lib/api";
import {
  ALL_SHEET_PROBLEMS,
  DSA_SHEETS_META,
  DSASheetId,
  SheetProblem,
  getSheetCategories,
} from "@/data/dsaSheets";
import {
  Code2,
  Plus,
  SlidersHorizontal,
  CheckCircle2,
  ExternalLink,
  RotateCw,
  Search,
  Clock,
  Sparkles,
  X,
  History,
  Zap,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Star,
  FileText,
  Bookmark,
  Layers,
  Award,
  BookOpen,
  Filter,
  CheckCheck,
  Terminal,
} from "lucide-react";

const LOCAL_SOLVED_KEY = "studypilot_sheet_solved_v1";
const LOCAL_STARRED_KEY = "studypilot_sheet_starred_v1";
const LOCAL_NOTES_KEY = "studypilot_sheet_notes_v1";

export default function LeetCodeTrackerPage() {
  const { user, loading: authLoading } = useAuth();

  // Active view: "neetcode150" | "blind75" | "striver" | "custom_log"
  const [activeSheet, setActiveSheet] = useState<DSASheetId | "custom_log">("neetcode150");

  // Backend tracked problems & stats
  const [problems, setProblems] = useState<LeetCodeProblem[]>([]);
  const [stats, setStats] = useState<LeetCodeStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Solved problem numbers set (merged from backend + local guest storage)
  const [solvedNumbers, setSolvedNumbers] = useState<Set<number>>(new Set());
  const [starredNumbers, setStarredNumbers] = useState<Set<number>>(new Set());
  const [customNotes, setCustomNotes] = useState<Record<number, string>>({});

  // Accordion open/collapsed states by category name
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  // Selected problem for the Side Drawer Inspector
  const [selectedSheetProblem, setSelectedSheetProblem] = useState<SheetProblem | null>(null);
  const [selectedCustomProblem, setSelectedCustomProblem] = useState<LeetCodeProblem | null>(null);
  const [activeDrawerTab, setActiveDrawerTab] = useState<"details" | "notes">("details");
  const [drawerNoteText, setDrawerNoteText] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "solved" | "unsolved" | "starred">("all");

  // Add Custom Problem Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [num, setNum] = useState<number>(1);
  const [title, setTitle] = useState("Two Sum");
  const [diff, setDiff] = useState<"Easy" | "Medium" | "Hard">("Easy");
  const [topics, setTopics] = useState("Array, Hash Table");
  const [pattern, setPattern] = useState("Hash Map Complement");
  const [timeComp, setTimeComp] = useState("O(N)");
  const [spaceComp, setSpaceComp] = useState("O(N)");
  const [noteInput, setNoteInput] = useState("");

  // 1. Initial LocalStorage restoration (for guest candidates or instant offline cache)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedSolved = localStorage.getItem(LOCAL_SOLVED_KEY);
      if (savedSolved) {
        setSolvedNumbers(new Set(JSON.parse(savedSolved)));
      }
      const savedStarred = localStorage.getItem(LOCAL_STARRED_KEY);
      if (savedStarred) {
        setStarredNumbers(new Set(JSON.parse(savedStarred)));
      }
      const savedNotes = localStorage.getItem(LOCAL_NOTES_KEY);
      if (savedNotes) {
        setCustomNotes(JSON.parse(savedNotes));
      }
    } catch (e) {
      console.warn("Could not load local sheet progress:", e);
    }
  }, []);

  // 2. Fetch authenticated problems & stats from backend
  const loadData = async () => {
    try {
      setIsLoading(true);
      const [probList, statData] = await Promise.all([
        getLeetCodeProblems(false),
        getLeetCodeStats(),
      ]);
      setProblems(probList);
      setStats(statData);

      // Merge backend solved problem numbers into solved set
      const backendSolvedNumbers = new Set(
        probList.filter((p) => p.status === "Solved" || p.repetitions >= 1).map((p) => p.problem_number)
      );
      setSolvedNumbers((prev) => {
        const merged = new Set([...prev, ...backendSolvedNumbers]);
        if (typeof window !== "undefined") {
          localStorage.setItem(LOCAL_SOLVED_KEY, JSON.stringify(Array.from(merged)));
        }
        return merged;
      });
    } catch (err) {
      console.error("Failed to load LeetCode data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (user) {
      loadData();
    } else {
      setIsLoading(false);
    }

    const handleRefresh = () => {
      if (user) loadData();
    };
    window.addEventListener("studypilot-data-changed", handleRefresh);
    window.addEventListener("studypilot-user-changed", handleRefresh);
    return () => {
      window.removeEventListener("studypilot-data-changed", handleRefresh);
      window.removeEventListener("studypilot-user-changed", handleRefresh);
    };
  }, [authLoading, user?.id]);

  // 3. Category Data for current selected sheet
  const categories = useMemo(() => {
    if (activeSheet === "custom_log") return [];
    return getSheetCategories(activeSheet);
  }, [activeSheet]);

  // Expand all by default on first view
  useEffect(() => {
    if (categories.length > 0) {
      const initial: Record<string, boolean> = {};
      categories.forEach((cat, idx) => {
        // Expand first 4 categories by default
        initial[cat.name] = idx < 4;
      });
      setOpenCategories(initial);
    }
  }, [activeSheet]);

  const toggleCategory = (catName: string) => {
    setOpenCategories((prev) => ({
      ...prev,
      [catName]: !prev[catName],
    }));
  };

  const expandAll = () => {
    const allOpen: Record<string, boolean> = {};
    categories.forEach((cat) => {
      allOpen[cat.name] = true;
    });
    setOpenCategories(allOpen);
  };

  const collapseAll = () => {
    setOpenCategories({});
  };

  // 4. Toggle Solved Status
  const handleToggleSolved = async (prob: SheetProblem) => {
    const isCurrentlySolved = solvedNumbers.has(prob.id);
    const nextSolved = !isCurrentlySolved;

    // Optimistic local state update
    const updated = new Set(solvedNumbers);
    if (nextSolved) {
      updated.add(prob.id);
    } else {
      updated.delete(prob.id);
    }
    setSolvedNumbers(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_SOLVED_KEY, JSON.stringify(Array.from(updated)));
    }

    // Persist to backend if authenticated
    if (user) {
      try {
        await toggleLeetCodeProblem({
          problem_number: prob.id,
          title: prob.title,
          difficulty: prob.difficulty,
          pattern: prob.pattern,
          topics: prob.category,
          url: prob.leetcodeUrl,
          time_complexity: prob.timeComplexity,
          space_complexity: prob.spaceComplexity,
          notes: prob.hint,
        });
        loadData();
      } catch (err) {
        console.error("Failed to sync problem status to backend:", err);
      }
    }
  };

  // 5. Toggle Star / Bookmark
  const handleToggleStar = (probId: number) => {
    const updated = new Set(starredNumbers);
    if (updated.has(probId)) {
      updated.delete(probId);
    } else {
      updated.add(probId);
    }
    setStarredNumbers(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_STARRED_KEY, JSON.stringify(Array.from(updated)));
    }
  };

  // 6. Inspect Problem / Open Drawer
  const openInspector = (prob: SheetProblem) => {
    setSelectedSheetProblem(prob);
    setSelectedCustomProblem(null);
    setDrawerNoteText(customNotes[prob.id] || prob.hint || "");
    setActiveDrawerTab("details");
  };

  const handleSaveDrawerNote = async () => {
    if (!selectedSheetProblem) return;
    setIsSavingNote(true);
    const probId = selectedSheetProblem.id;

    // Save locally
    const updatedNotes = { ...customNotes, [probId]: drawerNoteText };
    setCustomNotes(updatedNotes);
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_NOTES_KEY, JSON.stringify(updatedNotes));
    }

    // Save to backend if user is authenticated
    if (user) {
      try {
        await logLeetCodeProblem({
          problem_number: selectedSheetProblem.id,
          title: selectedSheetProblem.title,
          difficulty: selectedSheetProblem.difficulty,
          pattern: selectedSheetProblem.pattern,
          topics: selectedSheetProblem.category,
          url: selectedSheetProblem.leetcodeUrl,
          time_complexity: selectedSheetProblem.timeComplexity,
          space_complexity: selectedSheetProblem.spaceComplexity,
          notes: drawerNoteText,
        });
        loadData();
      } catch (e) {
        console.error("Failed to save note to backend:", e);
      }
    }
    setIsSavingNote(false);
  };

  // 7. Manual Add Problem Form Submission
  const handleLogManualProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await logLeetCodeProblem({
        problem_number: num,
        title,
        difficulty: diff,
        topics,
        pattern,
        time_complexity: timeComp,
        space_complexity: spaceComp,
        notes: noteInput,
      });
      setShowAddModal(false);
      setSolvedNumbers((prev) => new Set([...prev, num]));
      await loadData();
      setSelectedCustomProblem(created);
    } catch (err) {
      console.error("Failed to log problem:", err);
    }
  };

  // 8. SM-2 Spaced Repetition Review
  const handleReview = async (id: number, score: number) => {
    try {
      const updated = await submitSRSReview(id, score);
      setProblems((prev) => prev.map((p) => (p.id === id ? updated : p)));
      if (selectedCustomProblem?.id === id) {
        setSelectedCustomProblem(updated);
      }
      const newStats = await getLeetCodeStats();
      setStats(newStats);
    } catch (err) {
      console.error("Failed to submit review:", err);
    }
  };

  // 9. Sheet Total Counts & Progress Calculation
  const currentSheetProblems = useMemo(() => {
    if (activeSheet === "custom_log") return [];
    return ALL_SHEET_PROBLEMS.filter((p) => p.sheets.includes(activeSheet));
  }, [activeSheet]);

  const totalInCurrentSheet = currentSheetProblems.length;
  const solvedInCurrentSheet = currentSheetProblems.filter((p) => solvedNumbers.has(p.id)).length;
  const sheetPct = totalInCurrentSheet > 0 ? Math.round((solvedInCurrentSheet / totalInCurrentSheet) * 100) : 0;

  const easySolved = currentSheetProblems.filter((p) => p.difficulty === "Easy" && solvedNumbers.has(p.id)).length;
  const easyTotal = currentSheetProblems.filter((p) => p.difficulty === "Easy").length;

  const medSolved = currentSheetProblems.filter((p) => p.difficulty === "Medium" && solvedNumbers.has(p.id)).length;
  const medTotal = currentSheetProblems.filter((p) => p.difficulty === "Medium").length;

  const hardSolved = currentSheetProblems.filter((p) => p.difficulty === "Hard" && solvedNumbers.has(p.id)).length;
  const hardTotal = currentSheetProblems.filter((p) => p.difficulty === "Hard").length;

  // Filter sheet problems based on search & filters
  const filterProblem = (p: SheetProblem) => {
    if (filterDifficulty !== "all" && p.difficulty !== filterDifficulty) return false;
    if (filterStatus === "solved" && !solvedNumbers.has(p.id)) return false;
    if (filterStatus === "unsolved" && solvedNumbers.has(p.id)) return false;
    if (filterStatus === "starred" && !starredNumbers.has(p.id)) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      const matchTitle = p.title.toLowerCase().includes(q);
      const matchNum = p.id.toString().includes(q);
      const matchPattern = p.pattern?.toLowerCase().includes(q);
      const matchCategory = p.category.toLowerCase().includes(q);
      if (!matchTitle && !matchNum && !matchPattern && !matchCategory) return false;
    }
    return true;
  };

  return (
    <div className="min-h-screen bg-background font-body text-on-surface antialiased">
      <AppSidebar />
      <AppHeader onLogSolvedClick={() => setShowAddModal(true)} />

      <main className="lg:pl-64 pl-0 pt-16 min-h-screen bg-[#F8FAFC] dark:bg-background">
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
          {/* Practice Sub-Navigation Tabs */}
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200/80 dark:border-white/10 text-xs">
            <span className="px-3 py-1.5 rounded-lg bg-primary text-white font-semibold shadow-2xs flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5" />
              <span>Coding Practice &amp; DSA Sheets</span>
            </span>
            <Link
              href="/resources"
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 font-medium transition-colors"
            >
              Study Resources
            </Link>
          </div>

          {/* Top Bar: Title & Sheet Selection Shelf */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-primary font-mono text-[11px] uppercase tracking-wider font-semibold">
                <Code2 className="w-4 h-4 text-emerald-600" />
                Curated DSA Sheets &amp; LeetCode Practice
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Coding Practice &amp; DSA Sheets
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-on-surface-variant max-w-2xl">
                Solve pattern-grouped questions from top interview roadmaps with direct LeetCode redirects, progress tracking, and spaced repetition.
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                onClick={() => setShowAddModal(true)}
                className="px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary/95 text-white font-mono text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Log Custom Problem</span>
              </button>
            </div>
          </div>

          {/* Famous DSA Sheets Switcher Bar */}
          <div className="p-1.5 rounded-2xl bg-white dark:bg-surface-container border border-slate-200 dark:border-white/10 shadow-xs flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveSheet("neetcode150")}
              className={`px-4 py-2.5 rounded-xl font-mono text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeSheet === "neetcode150"
                  ? "bg-primary text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
              }`}
            >
              <Zap className={`w-4 h-4 ${activeSheet === "neetcode150" ? "text-amber-300 fill-amber-300" : "text-amber-500"}`} />
              <span>NeetCode 150</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                activeSheet === "neetcode150" ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400"
              }`}>
                150 Qs
              </span>
            </button>

            <button
              onClick={() => setActiveSheet("blind75")}
              className={`px-4 py-2.5 rounded-xl font-mono text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeSheet === "blind75"
                  ? "bg-primary text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
              }`}
            >
              <Award className={`w-4 h-4 ${activeSheet === "blind75" ? "text-amber-300" : "text-indigo-500"}`} />
              <span>Blind 75</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                activeSheet === "blind75" ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400"
              }`}>
                75 Qs
              </span>
            </button>

            <button
              onClick={() => setActiveSheet("striver")}
              className={`px-4 py-2.5 rounded-xl font-mono text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeSheet === "striver"
                  ? "bg-primary text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
              }`}
            >
              <Layers className={`w-4 h-4 ${activeSheet === "striver" ? "text-amber-300" : "text-emerald-500"}`} />
              <span>Striver's SDE Sheet</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                activeSheet === "striver" ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400"
              }`}>
                Top SDE
              </span>
            </button>

            <div className="h-6 w-px bg-slate-200 dark:bg-white/10 mx-1 flex-shrink-0" />

            <button
              onClick={() => setActiveSheet("custom_log")}
              className={`px-4 py-2.5 rounded-xl font-mono text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeSheet === "custom_log"
                  ? "bg-primary text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
              }`}
            >
              <History className="w-4 h-4" />
              <span>My Custom Log &amp; SRS</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                activeSheet === "custom_log" ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400"
              }`}>
                {problems.length}
              </span>
            </button>
          </div>

          {/* Curated Sheet Mode UI */}
          {activeSheet !== "custom_log" && (
            <>
              {/* Sheet Overall Metric Banner */}
              <div className="p-5 rounded-2xl bg-white dark:bg-surface-container border border-slate-200 dark:border-white/10 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        {DSA_SHEETS_META[activeSheet].name}
                      </h2>
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 font-mono font-semibold">
                        {DSA_SHEETS_META[activeSheet].badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-on-surface-variant">
                      {DSA_SHEETS_META[activeSheet].description}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="text-slate-600 dark:text-slate-300">
                        Easy: <strong className="text-emerald-600 dark:text-emerald-400">{easySolved}</strong> / {easyTotal}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <span className="text-slate-600 dark:text-slate-300">
                        Med: <strong className="text-amber-600 dark:text-amber-400">{medSolved}</strong> / {medTotal}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                      <span className="text-slate-600 dark:text-slate-300">
                        Hard: <strong className="text-rose-600 dark:text-rose-400">{hardSolved}</strong> / {hardTotal}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">
                      Total Solved: <strong className="text-emerald-600 dark:text-emerald-400">{solvedInCurrentSheet}</strong> of {totalInCurrentSheet}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">{sheetPct}% Completed</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500 ease-out rounded-full shadow-xs"
                      style={{ width: `${sheetPct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Search, Filters, and Expand/Collapse Controls */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-surface-container border border-slate-200 dark:border-white/10 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-xs">
                {/* Search Input */}
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search problem title, #number, pattern, or category..."
                    className="w-full h-9 pl-9 pr-4 rounded-lg bg-slate-50 dark:bg-surface-container-lowest text-slate-800 dark:text-white placeholder:text-slate-400 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:bg-white dark:focus:bg-[#181c22] border border-slate-200 dark:border-white/10 transition-all"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Status Filter */}
                  <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-surface-container-lowest font-mono text-xs border border-slate-200 dark:border-white/10">
                    <button
                      onClick={() => setFilterStatus("all")}
                      className={`px-3 py-1 rounded-md transition-all font-semibold cursor-pointer ${
                        filterStatus === "all"
                          ? "bg-white text-slate-900 shadow-xs dark:bg-surface-container-high dark:text-white"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                      }`}
                    >
                      All ({totalInCurrentSheet})
                    </button>
                    <button
                      onClick={() => setFilterStatus("solved")}
                      className={`px-3 py-1 rounded-md transition-all font-semibold cursor-pointer ${
                        filterStatus === "solved"
                          ? "bg-emerald-50 text-emerald-700 shadow-xs border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                      }`}
                    >
                      Solved ({solvedInCurrentSheet})
                    </button>
                    <button
                      onClick={() => setFilterStatus("unsolved")}
                      className={`px-3 py-1 rounded-md transition-all font-semibold cursor-pointer ${
                        filterStatus === "unsolved"
                          ? "bg-white text-slate-900 shadow-xs dark:bg-surface-container-high dark:text-white"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                      }`}
                    >
                      Unsolved ({totalInCurrentSheet - solvedInCurrentSheet})
                    </button>
                    <button
                      onClick={() => setFilterStatus("starred")}
                      className={`px-3 py-1 rounded-md transition-all font-semibold cursor-pointer ${
                        filterStatus === "starred"
                          ? "bg-amber-50 text-amber-700 shadow-xs border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                      }`}
                    >
                      Starred ({currentSheetProblems.filter((p) => starredNumbers.has(p.id)).length})
                    </button>
                  </div>

                  {/* Difficulty Filter */}
                  <div className="relative inline-block">
                    <select
                      value={filterDifficulty}
                      onChange={(e) => setFilterDifficulty(e.target.value)}
                      className="h-8 px-3 pr-7 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-surface-container-lowest text-slate-700 dark:text-slate-300 font-mono text-xs appearance-none focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer border border-slate-200 dark:border-white/10 transition-colors"
                    >
                      <option value="all">Difficulty: All</option>
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>

                  {/* Expand / Collapse All */}
                  <div className="flex items-center gap-1 border-l border-slate-200 dark:border-white/10 pl-2">
                    <button
                      onClick={expandAll}
                      className="px-2.5 py-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-mono text-[11px] rounded hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                      title="Expand all topics"
                    >
                      Expand All
                    </button>
                    <button
                      onClick={collapseAll}
                      className="px-2.5 py-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-mono text-[11px] rounded hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                      title="Collapse all topics"
                    >
                      Collapse All
                    </button>
                  </div>
                </div>
              </div>

              {/* Main Sheet Category Accordions (Matching Screenshot 2) */}
              <div className="flex flex-col xl:flex-row items-start gap-6 relative min-w-0">
                <div className="w-full xl:flex-1 min-w-0 space-y-4">
                  {categories.map((category) => {
                    const categoryProblems = category.problems;
                    const matchingProblems = categoryProblems.filter(filterProblem);
                    const catSolved = categoryProblems.filter((p) => solvedNumbers.has(p.id)).length;
                    const catTotal = categoryProblems.length;
                    const catPct = catTotal > 0 ? Math.round((catSolved / catTotal) * 100) : 0;
                    const isOpen = openCategories[category.name] ?? false;

                    // If filters hide all problems in this category, do not show empty shell unless no search
                    if (matchingProblems.length === 0 && (searchTerm || filterDifficulty !== "all" || filterStatus !== "all")) {
                      return null;
                    }

                    return (
                      <div
                        key={category.name}
                        className="rounded-2xl bg-white dark:bg-[#181c22] border border-slate-200 dark:border-white/10 shadow-xs overflow-hidden transition-all"
                      >
                        {/* Category Header Accordion Button (NeetCode Style) */}
                        <div
                          onClick={() => toggleCategory(category.name)}
                          className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors select-none"
                        >
                          <div className="flex items-center gap-3">
                            <div className="text-slate-400 dark:text-slate-500">
                              {isOpen ? (
                                <ChevronDown className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                              )}
                            </div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                              {category.name}
                            </h3>
                          </div>

                          <div className="flex items-center gap-4">
                            {/* Counter badge: e.g. 5/5 */}
                            <span className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-300">
                              {catSolved}/{catTotal}
                            </span>

                            {/* Category Progress Bar (Matching NeetCode screenshot) */}
                            <div className="w-28 sm:w-48 h-2 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ease-out rounded-full ${
                                  catPct === 100 ? "bg-emerald-500" : "bg-emerald-500/80"
                                }`}
                                style={{ width: `${catPct}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Collapsible Problems Table */}
                        {isOpen && (
                          <div className="border-t border-slate-100 dark:border-white/10 overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[620px]">
                              <thead>
                                <tr className="h-9 bg-slate-50/70 dark:bg-white/[0.02] font-mono text-[11px] uppercase text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-white/10 font-semibold">
                                  <th className="w-14 px-4 text-center">Status</th>
                                  <th className="w-12 px-2 text-center">Star</th>
                                  <th className="px-4">Problem</th>
                                  <th className="w-28 px-4 text-left">Difficulty</th>
                                  <th className="w-36 px-4 text-center">CodeLab / Notes</th>
                                </tr>
                              </thead>
                              <tbody className="text-xs divide-y divide-slate-100 dark:divide-white/5">
                                {matchingProblems.map((prob) => {
                                  const isSolved = solvedNumbers.has(prob.id);
                                  const isStarred = starredNumbers.has(prob.id);
                                  const isSelected = selectedSheetProblem?.id === prob.id;

                                  return (
                                    <tr
                                      key={prob.id}
                                      className={`h-12 transition-colors ${
                                        isSelected
                                          ? "bg-primary/5 dark:bg-primary/10 border-l-2 border-primary"
                                          : "hover:bg-slate-50/80 dark:hover:bg-white/[0.03]"
                                      }`}
                                    >
                                      {/* Status Toggle Button */}
                                      <td className="px-4 text-center">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleToggleSolved(prob);
                                          }}
                                          className="inline-flex items-center justify-center cursor-pointer transition-transform active:scale-90"
                                          title={isSolved ? "Mark as unsolved" : "Mark as solved"}
                                        >
                                          {isSolved ? (
                                            <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                                            </div>
                                          ) : (
                                            <div className="w-5 h-5 rounded-full border border-slate-300 dark:border-white/20 hover:border-emerald-500 hover:bg-emerald-500/10 transition-colors" />
                                          )}
                                        </button>
                                      </td>

                                      {/* Star Bookmark Toggle */}
                                      <td className="px-2 text-center">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleToggleStar(prob.id);
                                          }}
                                          className="p-1 rounded text-slate-300 hover:text-amber-400 dark:text-slate-600 transition-colors cursor-pointer"
                                          title={isStarred ? "Remove bookmark" : "Bookmark this problem"}
                                        >
                                          <Star
                                            className={`w-4 h-4 ${
                                              isStarred
                                                ? "text-amber-400 fill-amber-400"
                                                : "hover:fill-amber-400/20"
                                            }`}
                                          />
                                        </button>
                                      </td>

                                      {/* Problem Title & Direct CodeLab Link */}
                                      <td className="px-4">
                                        <div className="flex items-center gap-2 group">
                                          <Link
                                            href={`/codelab?problem=${prob.slug}&sheet=${activeSheet}`}
                                            className="font-medium text-slate-900 dark:text-white hover:text-primary dark:hover:text-primary transition-colors flex items-center gap-1.5"
                                            title="Click to open interactive CodeLab editor"
                                          >
                                            <span className="truncate max-w-sm sm:max-w-md font-medium group-hover:underline">
                                              {prob.title}
                                            </span>
                                          </Link>
                                          <a
                                            href={prob.leetcodeUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                            title="Open official problem on LeetCode.com (external)"
                                          >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                          </a>
                                        </div>
                                      </td>

                                      {/* Difficulty Badge */}
                                      <td className="px-4">
                                        <span
                                          className={`font-mono text-[11px] font-semibold ${
                                            prob.difficulty === "Easy"
                                              ? "text-emerald-600 dark:text-emerald-400"
                                              : prob.difficulty === "Medium"
                                              ? "text-amber-500 dark:text-amber-400"
                                              : "text-rose-500 dark:text-rose-400"
                                          }`}
                                        >
                                          {prob.difficulty}
                                        </span>
                                      </td>

                                      {/* CodeLab & Notes Trigger */}
                                      <td className="px-4 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                          <Link
                                            href={`/codelab?problem=${prob.slug}&sheet=${activeSheet}`}
                                            className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono text-[11px] font-semibold flex items-center gap-1 transition-all"
                                            title="Solve this problem in CodeLab"
                                          >
                                            <Code2 className="w-3.5 h-3.5" />
                                            <span>Solve</span>
                                          </Link>
                                          <button
                                            type="button"
                                            onClick={() => openInspector(prob)}
                                            className="p-1 rounded-lg text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                                            title="View solution hints and take notes"
                                          >
                                            <FileText className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Right Side Drawer Inspector for Sheet Problem */}
                {selectedSheetProblem && (
                  <aside className="w-full xl:w-[380px] flex-shrink-0 rounded-2xl bg-white dark:bg-[#181c22] border border-slate-200 dark:border-white/10 shadow-sm flex flex-col overflow-hidden sticky top-20">
                    <div className="p-4 bg-slate-50/80 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono text-xs font-bold">
                          #{selectedSheetProblem.id}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {selectedSheetProblem.title}
                        </h3>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-mono text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                            selectedSheetProblem.difficulty === "Easy"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                              : selectedSheetProblem.difficulty === "Medium"
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                          }`}
                        >
                          {selectedSheetProblem.difficulty}
                        </span>
                        <button
                          onClick={() => setSelectedSheetProblem(null)}
                          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Drawer Content */}
                    <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(100vh-220px)] text-xs">
                      {/* Solve in CodeLab Button */}
                      <Link
                        href={`/codelab?problem=${selectedSheetProblem.slug}&sheet=${activeSheet}`}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold flex items-center justify-center gap-2 shadow-xs transition-all"
                      >
                        <Code2 className="w-4 h-4" />
                        <span>Solve in CodeLab Workspace</span>
                      </Link>

                      {/* Direct LeetCode Redirect Button */}
                      <a
                        href={selectedSheetProblem.leetcodeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 font-semibold flex items-center justify-center gap-2 transition-all"
                      >
                        <span>Open on LeetCode</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>

                      {/* Complexity & Pattern Details */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-1">
                          <span className="text-[10px] uppercase font-semibold text-slate-400 font-mono">
                            Time Complexity
                          </span>
                          <div className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            {selectedSheetProblem.timeComplexity}
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-1">
                          <span className="text-[10px] uppercase font-semibold text-slate-400 font-mono">
                            Space Complexity
                          </span>
                          <div className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400">
                            {selectedSheetProblem.spaceComplexity}
                          </div>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-1">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 font-mono">
                          Algorithmic Pattern
                        </span>
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {selectedSheetProblem.pattern}
                        </div>
                      </div>

                      {/* Key Insight & Hint */}
                      <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-primary/10 border border-indigo-100 dark:border-primary/20 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-primary font-bold">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Key Takeaway / Pattern Hint</span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-200 leading-relaxed">
                          {selectedSheetProblem.hint}
                        </p>
                      </div>

                      {/* Personal Notes Section */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900 dark:text-white">My Solution Notes</span>
                          {isSavingNote && (
                            <span className="text-[10px] text-emerald-600 font-mono font-medium">Saving...</span>
                          )}
                        </div>
                        <textarea
                          rows={4}
                          value={drawerNoteText}
                          onChange={(e) => setDrawerNoteText(e.target.value)}
                          placeholder="Write your mental model, tricky edge cases, or code notes..."
                          className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <button
                          type="button"
                          onClick={handleSaveDrawerNote}
                          className="w-full py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white font-mono font-semibold transition-colors cursor-pointer"
                        >
                          Save Notes
                        </button>
                      </div>

                      {/* Toggle Solved Button inside Inspector */}
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => handleToggleSolved(selectedSheetProblem)}
                          className={`w-full py-2 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                            solvedNumbers.has(selectedSheetProblem.id)
                              ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300"
                              : "bg-slate-100 hover:bg-slate-200 dark:bg-white/10 text-slate-800 dark:text-white"
                          }`}
                        >
                          <Check className="w-4 h-4" />
                          <span>
                            {solvedNumbers.has(selectedSheetProblem.id)
                              ? "Completed (Click to Unsolve)"
                              : "Mark as Solved"}
                          </span>
                        </button>
                      </div>
                    </div>
                  </aside>
                )}
              </div>
            </>
          )}

          {/* Custom Log Mode: Spaced Repetition Schedule View */}
          {activeSheet === "custom_log" && (
            <div className="space-y-6">
              {/* Metric Trio */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 rounded-2xl bg-white dark:bg-surface-container border border-slate-200 dark:border-white/10 shadow-xs space-y-2">
                  <div className="flex items-center justify-between pb-1">
                    <span className="font-mono text-xs uppercase text-slate-500 font-bold">Solved Inventory</span>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-primary/20 text-primary font-mono text-xs font-bold">
                      {problems.length} Logged
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-slate-950 dark:text-white">{problems.length}</span>
                    <span className="text-xs text-slate-500">Problems in Personal Tracker</span>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-surface-container border border-slate-200 dark:border-white/10 shadow-xs space-y-2">
                  <div className="flex items-center justify-between pb-1">
                    <span className="font-mono text-xs uppercase text-slate-500 font-bold">Review Schedule</span>
                    <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-mono text-xs font-bold">
                      {stats?.due_reviews_count || 0} Due
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-slate-950 dark:text-white">{stats?.due_reviews_count || 0}</span>
                    <span className="text-xs text-slate-500">SM-2 Spaced Revisions Ready</span>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-surface-container border border-slate-200 dark:border-white/10 shadow-xs space-y-2">
                  <div className="flex items-center justify-between pb-1">
                    <span className="font-mono text-xs uppercase text-slate-500 font-bold">Mastery Level</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-mono text-xs font-bold">
                      SuperMemo SM-2
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-slate-950 dark:text-white">
                      {problems.filter((p) => p.repetitions >= 3).length}
                    </span>
                    <span className="text-xs text-slate-500">Mastered (3+ Iterations)</span>
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="rounded-2xl bg-white dark:bg-surface-container border border-slate-200 dark:border-white/10 shadow-xs overflow-hidden">
                <div className="px-5 py-3.5 bg-slate-50/80 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">My Logged Problems ({problems.length})</h3>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/95 text-white font-mono text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Log New</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="h-9 bg-slate-50/50 dark:bg-white/[0.02] font-mono text-xs uppercase text-slate-500 border-b border-slate-200 dark:border-white/10">
                        <th className="px-4">#</th>
                        <th className="px-4">Problem</th>
                        <th className="px-4">Difficulty</th>
                        <th className="px-4">Pattern</th>
                        <th className="px-4">Complexity</th>
                        <th className="px-4">Next Review</th>
                        <th className="px-4 text-right">SRS Action</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs divide-y divide-slate-100 dark:divide-white/5">
                      {problems.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-12 text-slate-400 font-mono text-xs">
                            No custom problems logged yet. Check off questions in NeetCode 150 or click Log New!
                          </td>
                        </tr>
                      ) : (
                        problems.map((prob) => (
                          <tr key={prob.id} className="h-11 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                            <td className="px-4 font-mono font-bold text-primary">#{prob.problem_number}</td>
                            <td className="px-4 font-semibold text-slate-900 dark:text-white">
                              <a
                                href={prob.url || `https://leetcode.com/problems/${prob.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-primary transition-colors inline-flex items-center gap-1.5"
                              >
                                <span>{prob.title}</span>
                                <ExternalLink className="w-3 h-3 text-slate-400" />
                              </a>
                            </td>
                            <td className="px-4">
                              <span
                                className={`font-mono text-[11px] font-semibold ${
                                  prob.difficulty === "Easy"
                                    ? "text-emerald-600"
                                    : prob.difficulty === "Medium"
                                    ? "text-amber-500"
                                    : "text-rose-500"
                                }`}
                              >
                                {prob.difficulty}
                              </span>
                            </td>
                            <td className="px-4 text-slate-600 dark:text-slate-400 font-mono">{prob.pattern || "General"}</td>
                            <td className="px-4 font-mono text-slate-500">
                              {prob.time_complexity} / {prob.space_complexity}
                            </td>
                            <td className="px-4 font-mono text-slate-500">
                              {prob.next_review_at
                                ? new Date(prob.next_review_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                                : "Now"}
                            </td>
                            <td className="px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleReview(prob.id, 5)}
                                  className="p-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors"
                                  title="Perfect recall (+review)"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleReview(prob.id, 2)}
                                  className="p-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors"
                                  title="Needs revision"
                                >
                                  <RotateCw className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Manual Problem Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#181c22] border border-slate-200 dark:border-white/10 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Log Custom LeetCode Problem</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleLogManualProblem} className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Problem #
                  </label>
                  <input
                    type="number"
                    value={num}
                    onChange={(e) => setNum(Number(e.target.value))}
                    required
                    className="w-full h-9 px-3 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="w-full h-9 px-3 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Difficulty
                  </label>
                  <select
                    value={diff}
                    onChange={(e) => setDiff(e.target.value as any)}
                    className="w-full h-9 px-2 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Pattern
                  </label>
                  <input
                    type="text"
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                    placeholder="e.g. Two Pointers"
                    className="w-full h-9 px-3 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Key Takeaway / Note
                </label>
                <textarea
                  rows={2}
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Key algorithmic insight..."
                  className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-200 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/95 text-white font-semibold"
                >
                  Add Problem
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
