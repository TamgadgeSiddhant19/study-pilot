"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useLayout } from "@/context/LayoutContext";
import { useAuth } from "@/context/AuthContext";
import { createTask, Task } from "@/lib/api";
import { X, Check, Loader2, Clock, Sparkles, User, AlertCircle } from "lucide-react";

const SUGGESTED_SUBJECTS = ["DSA", "System Design", "Backend", "Frontend", "AI / ML", "General"];
const DURATION_OPTIONS = [15, 30, 45, 60];

export function QuickTaskModal() {
  const { quickTaskModalOpen, closeQuickTask } = useLayout();
  const { isAuthenticated, loginDemo } = useAuth();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("General");
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [priority, setPriority] = useState<"P0" | "P1" | "P2">("P1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!quickTaskModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please enter a task title.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // If user is not authenticated, seamlessly auto-login as demo user in development
      if (!isAuthenticated) {
        try {
          await loginDemo();
        } catch {
          setError("Please sign in to save tasks to your personal study plan.");
          setSaving(false);
          return;
        }
      }

      const newTask = await createTask({
        title: title.trim(),
        subject,
        estimated_minutes: estimatedMinutes,
        priority,
        status: "todo",
        completed: false,
      });

      // Dispatch event to inform any listeners to reload tasks
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("task-created", { detail: newTask }));
      }

      // Reset & close
      setTitle("");
      setSubject("General");
      setEstimatedMinutes(30);
      setPriority("P1");
      closeQuickTask();
    } catch (err: any) {
      if (err.message && err.message.toLowerCase().includes("authentication")) {
        setError("Please sign in or use 1-Click Demo Login to save tasks to your plan.");
      } else {
        setError(err.message || "Failed to create task.");
      }
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-white dark:bg-[#181c22] rounded-2xl border border-slate-200 dark:border-white/10 shadow-xl overflow-hidden animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
              +
            </div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Add Study Task</h2>
          </div>
          <button
            onClick={closeQuickTask}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:text-outline dark:hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {!isAuthenticated && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-200">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                <span>You are currently not signed in.</span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  setSaving(true);
                  try {
                    await loginDemo();
                    setError(null);
                  } finally {
                    setSaving(false);
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold whitespace-nowrap cursor-pointer transition-colors shadow-2xs"
              >
                1-Click Demo Login
              </button>
            </div>
          )}

          {error && (
            <div className="p-3 text-xs rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2">
              <span>{error}</span>
              {!isAuthenticated && (
                <button
                  type="button"
                  onClick={async () => {
                    setSaving(true);
                    try {
                      await loginDemo();
                      setError(null);
                    } finally {
                      setSaving(false);
                    }
                  }}
                  className="underline font-semibold cursor-pointer shrink-0"
                >
                  Demo Login
                </button>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              What do you want to study? <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Implement LRU Cache or Review Binary Trees"
              className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-surface-container-low border border-slate-200 dark:border-outline-variant/20 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Topic / Subject
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_SUBJECTS.map((sub) => (
                <button
                  type="button"
                  key={sub}
                  onClick={() => setSubject(sub)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    subject === sub
                      ? "bg-primary text-white shadow-2xs"
                      : "bg-slate-100 dark:bg-surface-container hover:bg-slate-200 dark:hover:bg-surface-container-high text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Estimated Duration
              </label>
              <div className="flex gap-1.5">
                {DURATION_OPTIONS.map((mins) => (
                  <button
                    type="button"
                    key={mins}
                    onClick={() => setEstimatedMinutes(mins)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      estimatedMinutes === mins
                        ? "bg-primary text-white shadow-2xs"
                        : "bg-slate-100 dark:bg-surface-container hover:bg-slate-200 dark:hover:bg-surface-container-high text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Priority
              </label>
              <div className="flex gap-1.5">
                {(["P1", "P0"] as const).map((p) => (
                  <button
                    type="button"
                    key={p}
                    onClick={() => setPriority(p)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      priority === p
                        ? p === "P0"
                          ? "bg-rose-600 text-white shadow-2xs"
                          : "bg-primary text-white shadow-2xs"
                        : "bg-slate-100 dark:bg-surface-container hover:bg-slate-200 dark:hover:bg-surface-container-high text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {p === "P0" ? "High (P0)" : "Normal (P1)"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={closeQuickTask}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/95 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-60 cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Adding...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Add to Plan</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
