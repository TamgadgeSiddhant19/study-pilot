"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { Timer, Play, Pause, RotateCcw, Clock, CheckCircle2, Flame, Zap, Award, Target } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useFocusTimer } from "@/context/FocusTimerContext";
import { getSessions, getFocusStats, FocusSession, FocusStats } from "@/lib/api";

export default function FocusSessionsPage() {
  const { user, loading: authLoading } = useAuth();
  const {
    isRunning,
    isPaused,
    remainingSeconds,
    totalSeconds,
    sessionType,
    cycleCount,
    linkedTask,
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    formatTime,
  } = useFocusTimer();

  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [stats, setStats] = useState<FocusStats | null>(null);
  const [mode, setMode] = useState<25 | 50>(25);
  const [subject, setSubject] = useState("Daily Study Focus");

  const loadData = async () => {
    try {
      const [sessList, statData] = await Promise.all([getSessions(), getFocusStats()]);
      setSessions(sessList);
      setStats(statData);
    } catch (err) {
      console.error("Failed to load focus sessions:", err);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setSessions([]);
      setStats(null);
      return;
    }
    loadData();

    const handleRefresh = () => loadData();
    window.addEventListener("studypilot-data-changed", handleRefresh);
    window.addEventListener("studypilot-user-changed", handleRefresh);
    return () => {
      window.removeEventListener("studypilot-data-changed", handleRefresh);
      window.removeEventListener("studypilot-user-changed", handleRefresh);
    };
  }, [authLoading, user?.id]);

  const handleSwitchMode = (m: 25 | 50) => {
    setMode(m);
    startTimer(
      subject ? { id: 0, title: subject, subject: "Focus" } : null,
      m
    );
  };

  const handleToggleTimer = () => {
    if (isRunning) {
      pauseTimer();
    } else if (isPaused) {
      resumeTimer();
    } else {
      startTimer(
        subject ? { id: 0, title: subject, subject: "Focus" } : null,
        mode
      );
    }
  };

  const progressPct =
    totalSeconds > 0
      ? Math.min(100, Math.max(0, Math.round(((totalSeconds - remainingSeconds) / totalSeconds) * 100)))
      : 0;

  return (
    <div className="min-h-screen bg-background font-body text-on-surface antialiased">
      <AppSidebar />
      <AppHeader />

      <main className="lg:pl-64 pl-0 pt-16 min-h-screen">
        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
          {/* My Progress Sub-Navigation Tabs */}
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200/80 dark:border-white/10 text-xs">
            <Link
              href="/analytics"
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 font-medium transition-colors"
            >
              Progress &amp; Mastery
            </Link>
            <span className="px-3 py-1.5 rounded-lg bg-primary text-white font-semibold shadow-2xs">
              Focus Sessions
            </span>
          </div>

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-tertiary font-mono text-xs uppercase tracking-wider">
                <Timer className="w-4 h-4" />
                Focus Timer · Distraction-Free Study
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-on-surface">Focus Sessions</h1>
              <p className="text-xs sm:text-sm text-on-surface-variant max-w-2xl">
                Synced with your global focus timer. Sessions continue across pages and notify you on completion.
              </p>
            </div>

            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="px-3 py-1 rounded-full bg-surface-container border border-outline-variant/15 text-outline">
                Today: <strong className="text-tertiary">{stats ? (stats.total_minutes_today / 60).toFixed(1) : "0.0"}h</strong>
              </span>
              <span className="px-3 py-1 rounded-full bg-surface-container border border-outline-variant/15 text-outline">
                Weekly: <strong className="text-primary">{stats?.weekly_hours ?? 0.0}h</strong>
              </span>
            </div>
          </div>

          {/* Large Pomodoro Display Card */}
          <div className="rounded-xl bg-surface-container border border-outline-variant/15 p-8 flex flex-col items-center justify-center gap-6 shadow-sm relative overflow-hidden">
            {/* Background blur effects */}
            <div className="absolute -left-20 -top-20 w-56 h-56 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
            <div className="absolute -right-20 -bottom-20 w-56 h-56 rounded-full bg-tertiary/5 blur-3xl pointer-events-none" />

            {/* Mode Switcher */}
            <div className="flex items-center gap-2 p-1 rounded-xl bg-surface-container-lowest border border-outline-variant/15 z-10">
              <button
                onClick={() => handleSwitchMode(25)}
                className={`px-4 py-1.5 rounded-lg font-mono text-xs font-semibold transition-all ${
                  mode === 25
                    ? "bg-surface-container-high text-on-surface shadow-xs border border-outline-variant/20"
                    : "text-outline hover:text-on-surface"
                }`}
              >
                25m Pomodoro
              </button>
              <button
                onClick={() => handleSwitchMode(50)}
                className={`px-4 py-1.5 rounded-lg font-mono text-xs font-semibold transition-all ${
                  mode === 50
                    ? "bg-surface-container-high text-on-surface shadow-xs border border-outline-variant/20"
                    : "text-outline hover:text-on-surface"
                }`}
              >
                50m Deep Focus
              </button>
            </div>

            {/* Linked Task Banner if active */}
            {linkedTask && linkedTask.title && (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium z-10">
                <Target className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate max-w-xs">Task: {linkedTask.title}</span>
              </div>
            )}

            {/* Timer Digits */}
            <div className="flex flex-col items-center gap-2 my-2 z-10">
              <span className="font-mono text-7xl md:text-8xl font-bold tracking-tighter text-on-surface tabular-nums">
                {formatTime(remainingSeconds)}
              </span>
              <div className="flex items-center gap-2 text-xs font-mono text-outline">
                <span className={`h-2 w-2 rounded-full ${isRunning ? "bg-tertiary animate-pulse" : "bg-outline"}`} />
                <span>
                  {isRunning
                    ? `${sessionType === "focus" ? "Focus Session" : sessionType === "short_break" ? "Short Break" : "Long Break"} in Progress`
                    : isPaused
                    ? "Session Paused"
                    : "Idle · Select mode or click Start"}
                </span>
                <span>·</span>
                <span>Cycle {cycleCount} / 4</span>
                <span>·</span>
                <span>{progressPct}% elapsed</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full max-w-md h-2 rounded-full bg-surface-container-lowest overflow-hidden border border-outline-variant/10 z-10">
              <div
                className="h-full bg-tertiary transition-all duration-500 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* Active Subject Selector */}
            <div className="flex items-center gap-2 w-full max-w-sm z-10">
              <span className="font-mono text-xs text-outline whitespace-nowrap">Focus Topic:</span>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Distributed Consensus (Raft)"
                className="flex-1 px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/15 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary text-center"
              />
            </div>

            {/* Control Buttons */}
            <div className="flex items-center gap-3 pt-2 z-10">
              <button
                onClick={handleToggleTimer}
                className={`px-6 py-2.5 rounded-xl font-mono text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer ${
                  isRunning
                    ? "bg-amber-600 text-white hover:bg-amber-700"
                    : "bg-primary text-white hover:bg-primary/95"
                }`}
              >
                {isRunning ? (
                  <>
                    <Pause className="w-4 h-4" />
                    <span>Pause Timer</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>{isPaused ? "Resume Session" : "Start Focus Session"}</span>
                  </>
                )}
              </button>

              <button
                onClick={resetTimer}
                className="p-2.5 rounded-xl bg-surface-container-high hover:bg-surface-bright text-outline hover:text-on-surface border border-outline-variant/15 transition-colors cursor-pointer"
                title="Reset Timer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Recent Focus Records */}
          <div className="rounded-xl bg-surface-container border border-outline-variant/15 p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/15">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-secondary" />
                <h3 className="font-semibold text-sm text-on-surface">Recorded Focus Sessions</h3>
              </div>
              <span className="font-mono text-xs text-outline">{sessions.length} sessions logged</span>
            </div>

            {sessions.length === 0 ? (
              <div className="text-center py-8 text-outline font-mono text-xs">
                No focus sessions logged yet today. Start a 25m or 50m session above!
              </div>
            ) : (
              <div className="space-y-2">
                {sessions.slice(0, 8).map((s) => (
                  <div
                    key={s.id}
                    className="p-3.5 rounded-lg bg-surface-container-low border border-outline-variant/10 flex items-center justify-between hover:bg-surface-container-high transition-colors text-xs font-mono"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-4 h-4 text-tertiary flex-shrink-0" />
                      <span className="font-medium text-on-surface">{s.subject}</span>
                    </div>
                    <div className="flex items-center gap-4 text-outline">
                      <span className="text-secondary">{s.duration_minutes} min ({s.session_type})</span>
                      <span>
                        {s.created_at
                          ? new Date(s.created_at).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Today"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
