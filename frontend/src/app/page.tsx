"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { useAuth } from "@/context/AuthContext";
import { useLayout } from "@/context/LayoutContext";
import { useFocusTimer } from "@/context/FocusTimerContext";
import {
  getOverviewAnalytics,
  getTasks,
  updateTask,
  deleteTask,
  logFocusSession,
  getRoadmaps,
  getLeetCodeProblems,
  OverviewData,
  Task,
  Roadmap,
  LeetCodeProblem,
} from "@/lib/api";
import {
  Play,
  Pause,
  RotateCcw,
  Plus,
  CheckCircle2,
  Circle,
  Clock,
  Sparkles,
  ArrowRight,
  Target,
  Check,
  Bot,
  Calendar,
  Flame,
  Code2,
  X,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Loader2,
} from "lucide-react";

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const { openQuickTask } = useLayout();
  const { startTimer, setIsPopoverOpen } = useFocusTimer();

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [reviewProblems, setReviewProblems] = useState<LeetCodeProblem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Greeting & Date state (set on client to avoid prerender instability)
  const [greeting, setGreeting] = useState("Welcome");
  const [todayFormatted, setTodayFormatted] = useState("Today's Focus");

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 17) setGreeting("Good afternoon");
    else setGreeting("Good evening");

    setTodayFormatted(
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      })
    );
  }, []);

  const loadData = async () => {
    try {
      setLoadError(null);
      const [overviewData, taskData, roadmapData, leetcodeData] = await Promise.allSettled([
        getOverviewAnalytics(),
        getTasks(),
        getRoadmaps(),
        getLeetCodeProblems(true),
      ]);

      if (overviewData.status === "fulfilled") setOverview(overviewData.value);
      if (taskData.status === "fulfilled") setTasks(taskData.value);
      if (roadmapData.status === "fulfilled") setRoadmaps(roadmapData.value);
      if (leetcodeData.status === "fulfilled") setReviewProblems(leetcodeData.value.slice(0, 3));
    } catch (err: any) {
      console.error("Failed to load dashboard data:", err);
      setLoadError(err.message || "Unable to retrieve dashboard metrics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setOverview(null);
      setTasks([]);
      setRoadmaps([]);
      setReviewProblems([]);
      setLoading(false);
      return;
    }

    loadData();

    // Listen for mutations to refresh dashboard data in real-time
    const handleDataChanged = () => {
      loadData();
    };
    window.addEventListener("task-created", handleDataChanged);
    window.addEventListener("studypilot-data-changed", handleDataChanged);
    window.addEventListener("studypilot-user-changed", handleDataChanged);
    return () => {
      window.removeEventListener("task-created", handleDataChanged);
      window.removeEventListener("studypilot-data-changed", handleDataChanged);
      window.removeEventListener("studypilot-user-changed", handleDataChanged);
    };
  }, [authLoading, user?.id]);

  // Next actionable task
  const nextTask = useMemo(() => {
    return tasks.find((t) => !t.completed) || null;
  }, [tasks]);

  const completedCount = useMemo(() => {
    return tasks.filter((t) => t.completed).length;
  }, [tasks]);

  // Toggle task completed
  const handleToggleTask = async (task: Task) => {
    const newCompleted = !task.completed;
    const newStatus = newCompleted ? "completed" : "todo";

    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, completed: newCompleted, status: newStatus } : t))
    );

    try {
      await updateTask(task.id, {
        completed: newCompleted,
        status: newStatus,
        completed_at: newCompleted ? new Date().toISOString() : undefined,
      });
      // Refresh stats
      const updatedOverview = await getOverviewAnalytics().catch(() => null);
      if (updatedOverview) setOverview(updatedOverview);
    } catch (err) {
      console.error("Failed to update task:", err);
      // Revert on error
      loadData();
    }
  };

  // Start global Pomodoro timer for a task
  const handleStartFocus = (task?: Task | null) => {
    const targetTask = task || nextTask;
    if (targetTask) {
      startTimer(
        {
          id: targetTask.id,
          title: targetTask.title,
          subject: targetTask.subject,
          estimated_minutes: targetTask.estimated_minutes,
        },
        targetTask.estimated_minutes || 25
      );
    } else {
      startTimer(null, 25);
    }
    setIsPopoverOpen(true);
  };

  const displayName = user?.full_name?.split(" ")[0] || overview?.candidate_name?.split(" ")[0] || "there";
  const targetRole = user?.target_role || overview?.target_role || "Set your target role";
  const targetDate = user?.target_date || overview?.target_date;

  const flightHours = overview?.flight_hours_today ?? 0;
  const quotaHours = user?.daily_flight_quota_hours || overview?.daily_flight_quota_hours || 4.0;
  const flightPct = overview?.flight_percentage !== undefined ? overview.flight_percentage : Math.min(100, Math.round((flightHours / quotaHours) * 100));

  const streakDays = overview?.streak_days ?? 0;
  const nextMilestone = streakDays < 7 ? 7 : streakDays < 14 ? 14 : streakDays < 30 ? 30 : (Math.floor(streakDays / 30) + 1) * 30;
  const daysLeft = Math.max(0, nextMilestone - streakDays);

  const totalSolved = overview?.leetcode?.total_solved ?? 0;

  if (authLoading || (loading && !overview)) {
    return (
      <div className="min-h-screen bg-background text-on-surface">
        <AppSidebar />
        <div className="lg:pl-64 pl-0">
          <AppHeader />
          <main className="pt-24 pb-16 px-4 flex flex-col items-center justify-center min-h-[60vh] gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-xs text-slate-500 dark:text-outline font-medium">Loading your study dashboard...</p>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <AppSidebar />

      <div className="lg:pl-64 pl-0">
        <AppHeader />

        <main className="pt-20 pb-16 px-4 sm:px-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-200">
          {loadError && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
              <span>{loadError}</span>
              <button
                onClick={loadData}
                className="px-3 py-1 rounded-lg bg-rose-600 text-white font-medium hover:bg-rose-700 transition-colors"
              >
                Retry
              </button>
            </div>
          )}
          {/* 1. Concise Welcome & Primary Action (Next Up) */}
          <section className="pb-6 border-b border-slate-200/80 dark:border-white/10 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-outline mb-1">
                <span>{todayFormatted}</span>
                <span>•</span>
                <span className="text-primary font-semibold">Today's Focus</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                {greeting}, {displayName}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-on-surface-variant mt-1">
                Target: <span className="font-semibold text-slate-800 dark:text-white">{targetRole}</span>
                {targetDate && targetDate !== "Flexible" && <span> ({targetDate})</span>}
                <Link href="/onboarding" className="text-primary hover:underline ml-2 text-xs">
                  Edit goal
                </Link>
              </p>
            </div>

            {/* Primary Action Card: Next Actionable Step */}
            {nextTask ? (
              <div className="bg-white dark:bg-[#181c22] border border-slate-200 dark:border-white/10 rounded-2xl p-4 sm:px-5 shadow-xs flex items-center justify-between gap-4 max-w-md w-full">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 text-lg">
                    🎯
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-outline font-bold">
                      Next Action
                    </div>
                    <div className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {nextTask.title}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {nextTask.subject} · {nextTask.estimated_minutes || 30}m
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleStartFocus(nextTask)}
                  className="h-9 px-4 rounded-xl bg-primary hover:bg-primary/95 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all flex-shrink-0 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Start ({nextTask.estimated_minutes || 30}m)</span>
                </button>
              </div>
            ) : (
              <div className="bg-white dark:bg-[#181c22] border border-slate-200 dark:border-white/10 rounded-2xl p-4 sm:px-5 shadow-xs flex items-center justify-between gap-4 max-w-md w-full">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-bold">
                      All Caught Up
                    </div>
                    <div className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">
                      No pending tasks today
                    </div>
                  </div>
                </div>

                <button
                  onClick={openQuickTask}
                  className="h-9 px-4 rounded-xl bg-primary hover:bg-primary/95 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all flex-shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Task</span>
                </button>
              </div>
            )}
          </section>

          {/* 2. Three Clean, Quiet Key Metrics in a Row */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Metric 1: Today's Study Time */}
            <div className="bg-white dark:bg-[#181c22] border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-outline">
                <span>Today's Study Time</span>
                <span className="text-primary font-semibold">
                  {Math.round(flightPct)}%
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {flightHours.toFixed(1)}h
                </span>
                <span className="text-xs text-slate-400 dark:text-outline">
                  / {quotaHours}h goal
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-white/10 rounded-full h-1.5 mt-3 overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.max(0, flightPct))}%`,
                  }}
                />
              </div>
            </div>

            {/* Metric 2: Daily Consistency / Streak */}
            <div className="bg-white dark:bg-[#181c22] border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-outline">
                <span>Daily Consistency</span>
                {streakDays > 0 ? (
                  <span className="text-amber-500 font-semibold flex items-center gap-1">
                    <Flame className="w-3 h-3 fill-amber-500" /> Active
                  </span>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500 font-medium text-xs">
                    Get Started
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {streakDays}
                </span>
                <span className="text-xs text-slate-400 dark:text-outline">days streak</span>
              </div>
              <div className="text-[11px] text-slate-400 dark:text-outline mt-3 flex items-center justify-between">
                <span>Next milestone: {nextMilestone} days</span>
                <span className="text-amber-500 font-semibold font-mono">{daysLeft}d left</span>
              </div>
            </div>

            {/* Metric 3: Task & Practice Progress */}
            <div className="bg-white dark:bg-[#181c22] border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-outline">
                <span>Tasks Completed</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  {tasks.length > 0 ? `${Math.round((completedCount / tasks.length) * 100)}%` : "0%"}
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {completedCount}
                </span>
                <span className="text-xs text-slate-400 dark:text-outline">/ {tasks.length} tasks today</span>
              </div>
              <div className="text-[11px] text-slate-400 dark:text-outline mt-3 flex items-center justify-between">
                <span>{totalSolved} problems solved total</span>
                <Link href="/analytics" className="text-primary hover:underline font-medium">
                  Details →
                </Link>
              </div>
            </div>
          </section>

          {/* 3. Primary Working Area: Two Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* LEFT COLUMN: Today's Study Plan (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              {/* Task Checklist Card */}
              <div className="bg-white dark:bg-[#181c22] border border-slate-200/80 dark:border-white/10 rounded-2xl p-5 sm:p-6 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                      Today's Study Plan
                    </h2>
                    <p className="text-xs text-slate-400 dark:text-outline mt-0.5">
                      {tasks.length} {tasks.length === 1 ? "task" : "tasks"} planned · {completedCount} completed
                    </p>
                  </div>

                  <button
                    onClick={openQuickTask}
                    className="text-xs font-semibold text-primary hover:text-primary/80 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Task</span>
                  </button>
                </div>

                {/* Task List Items */}
                {tasks.length > 0 ? (
                  <div className="space-y-2.5">
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        className={`group flex items-start justify-between p-3.5 rounded-xl border transition-all ${
                          task.completed
                            ? "bg-slate-50/60 dark:bg-white/[0.02] border-slate-100 dark:border-white/5 opacity-75"
                            : "bg-white dark:bg-surface-container-low border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20"
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => handleToggleTask(task)}
                            className="mt-0.5 flex-shrink-0 cursor-pointer text-slate-400 hover:text-primary transition-colors"
                            aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
                          >
                            {task.completed ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 fill-emerald-100 dark:fill-emerald-950" />
                            ) : (
                              <Circle className="w-4 h-4 text-slate-300 hover:text-primary dark:text-outline" />
                            )}
                          </button>

                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-xs sm:text-sm font-medium truncate ${
                                task.completed
                                  ? "text-slate-400 dark:text-outline line-through"
                                  : "text-slate-900 dark:text-white"
                              }`}
                            >
                              {task.title}
                            </p>
                            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 dark:text-outline">
                              <span className="font-medium text-slate-600 dark:text-slate-300">
                                {task.subject}
                              </span>
                              <span>•</span>
                              <span>{task.estimated_minutes || 30}m</span>
                              {task.priority === "P0" && (
                                <>
                                  <span>•</span>
                                  <span className="text-rose-600 font-semibold">High Priority</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {!task.completed && (
                          <button
                            onClick={() => handleStartFocus(task)}
                            title="Start Focus Session"
                            className="ml-2 h-7 px-2.5 rounded-lg bg-slate-100 hover:bg-primary hover:text-white dark:bg-white/10 dark:hover:bg-primary text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0 cursor-pointer"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span className="hidden sm:inline">Focus</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center border border-dashed border-slate-200 dark:border-white/10 rounded-xl">
                    <p className="text-xs text-slate-500 dark:text-outline">
                      No study tasks scheduled for today.
                    </p>
                    <div className="mt-3 flex items-center justify-center gap-2">
                      <button
                        onClick={openQuickTask}
                        className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/95 transition-all shadow-xs cursor-pointer"
                      >
                        + Add a Task
                      </button>
                      <Link
                        href="/coach?prompt=Plan%20my%20study%20day"
                        className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-white/20 transition-all"
                      >
                        Ask AI Coach
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Current Roadmap Quick Summary */}
              {roadmaps.length > 0 && (
                <div className="bg-white dark:bg-[#181c22] border border-slate-200/80 dark:border-white/10 rounded-2xl p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-primary" />
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        Active Roadmap
                      </h3>
                    </div>
                    <Link
                      href="/roadmaps"
                      className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5"
                    >
                      <span>View all</span>
                      <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-container-low border border-slate-100 dark:border-white/5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {roadmaps[0].title}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-outline truncate mt-0.5">
                        {roadmaps[0].category} · {roadmaps[0].topics?.length || 8} key topics
                      </div>
                    </div>
                    <Link
                      href="/roadmaps"
                      className="h-8 px-3 rounded-lg bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/20 text-xs font-semibold text-slate-800 dark:text-white flex items-center gap-1 transition-colors flex-shrink-0"
                    >
                      <span>Continue</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Review Queue & Study Coach Entry (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              {/* Practice / Review Queue */}
              <div className="bg-white dark:bg-[#181c22] border border-slate-200/80 dark:border-white/10 rounded-2xl p-5 sm:p-6 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                      Practice Queue
                    </h2>
                    <p className="text-xs text-slate-400 dark:text-outline mt-0.5">
                      Spaced repetition for long-term retention
                    </p>
                  </div>
                  <Link
                    href="/leetcode"
                    className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5"
                  >
                    <span>Practice</span>
                    <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>

                {reviewProblems.length > 0 ? (
                  <div className="space-y-2.5">
                    {reviewProblems.map((prob) => (
                      <div
                        key={prob.id}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-surface-container-low border border-slate-100 dark:border-white/5 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                            #{prob.problem_number} {prob.title}
                          </div>
                          <div className="text-[11px] text-slate-400 dark:text-outline mt-0.5">
                            {prob.difficulty} · {prob.pattern || "General"}
                          </div>
                        </div>
                        <Link
                          href="/leetcode"
                          className="h-7 px-2.5 rounded-lg bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/20 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center transition-colors flex-shrink-0"
                        >
                          Review
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-surface-container-low text-center">
                    <p className="text-xs text-slate-500 dark:text-outline">
                      No reviews due today. Ready to practice new problems?
                    </p>
                    <Link
                      href="/leetcode"
                      className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      <span>Go to Problem Tracker</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                )}
              </div>

              {/* Approachable Study Coach Insight & Entry Point */}
              <div className="bg-gradient-to-br from-indigo-50/70 via-white to-violet-50/50 dark:from-primary/10 dark:via-[#181c22] dark:to-primary/5 border border-primary/20 dark:border-primary/20 rounded-2xl p-5 sm:p-6 shadow-xs">
                <div className="flex items-center gap-2 text-primary font-semibold text-xs mb-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Coach Guidance</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  You've maintained steady pace across your study topics. For your next session, focus on explaining key concepts out loud before coding.
                </p>

                <div className="mt-4 pt-3 border-t border-primary/10 space-y-1.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-outline font-semibold">
                    Suggested prompts
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Link
                      href="/coach?prompt=What%20should%20I%20study%20next%20today?"
                      className="text-left text-xs text-slate-700 dark:text-slate-300 hover:text-primary dark:hover:text-white p-2 rounded-lg bg-white/80 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 transition-colors flex items-center justify-between"
                    >
                      <span>"What should I study next?"</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                    </Link>
                    <Link
                      href="/coach?prompt=Plan%20my%20study%20week%20based%20on%20my%20goals"
                      className="text-left text-xs text-slate-700 dark:text-slate-300 hover:text-primary dark:hover:text-white p-2 rounded-lg bg-white/80 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 transition-colors flex items-center justify-between"
                    >
                      <span>"Plan my week"</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
