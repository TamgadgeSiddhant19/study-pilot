"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { useLayout } from "@/context/LayoutContext";
import { useAuth } from "@/context/AuthContext";
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  carryForwardTasks,
  Task,
} from "@/lib/api";
import {
  Plus,
  CheckCircle2,
  Circle,
  Clock,
  Trash2,
  Calendar,
  ArrowRight,
  RotateCw,
  Sparkles,
  Map,
  Filter,
  Check,
  Loader2,
} from "lucide-react";

export default function StudyPlanPage() {
  const { user, loading: authLoading } = useAuth();
  const { openQuickTask } = useLayout();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickSubject, setQuickSubject] = useState("General");
  const [filterStatus, setFilterStatus] = useState<"all" | "todo" | "completed">("all");
  const [isCarrying, setIsCarrying] = useState(false);
  const [addingTask, setAddingTask] = useState(false);

  const loadTasks = async () => {
    try {
      const data = await getTasks();
      setTasks(data);
    } catch (err) {
      console.error("Failed to load tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setTasks([]);
      setLoading(false);
      return;
    }
    loadTasks();
    const handleDataChanged = () => loadTasks();
    window.addEventListener("task-created", handleDataChanged);
    window.addEventListener("studypilot-data-changed", handleDataChanged);
    window.addEventListener("studypilot-user-changed", handleDataChanged);
    return () => {
      window.removeEventListener("task-created", handleDataChanged);
      window.removeEventListener("studypilot-data-changed", handleDataChanged);
      window.removeEventListener("studypilot-user-changed", handleDataChanged);
    };
  }, [authLoading, user?.id]);

  // Quick inline add task
  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim() || addingTask) return;

    setAddingTask(true);
    try {
      const created = await createTask({
        title: quickTitle.trim(),
        subject: quickSubject,
        priority: "P1",
        estimated_minutes: 30,
        status: "todo",
        completed: false,
      });
      setTasks((prev) => [created, ...prev]);
      setQuickTitle("");
    } catch (err) {
      console.error("Failed to add task:", err);
    } finally {
      setAddingTask(false);
    }
  };

  // Immediate toggle task completion
  const handleToggleTask = async (task: Task) => {
    const newCompleted = !task.completed;
    const newStatus = newCompleted ? "completed" : "todo";

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, completed: newCompleted, status: newStatus } : t))
    );

    try {
      await updateTask(task.id, {
        completed: newCompleted,
        status: newStatus,
        completed_at: newCompleted ? new Date().toISOString() : undefined,
      });
    } catch (err) {
      console.error("Failed to update task:", err);
      loadTasks();
    }
  };

  // Delete task
  const handleDeleteTask = async (taskId: number) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    try {
      await deleteTask(taskId);
    } catch (err) {
      console.error("Failed to delete task:", err);
      loadTasks();
    }
  };

  // Reschedule / Carry forward unfinished tasks
  const handleCarryForward = async () => {
    setIsCarrying(true);
    try {
      const forwarded = await carryForwardTasks();
      setTasks(forwarded);
    } catch (err) {
      console.error("Failed to carry forward tasks:", err);
    } finally {
      setIsCarrying(false);
    }
  };

  // Filter tasks
  const filteredTasks = useMemo(() => {
    if (filterStatus === "todo") return tasks.filter((t) => !t.completed);
    if (filterStatus === "completed") return tasks.filter((t) => t.completed);
    return tasks;
  }, [tasks, filterStatus]);

  const todoTasks = useMemo(() => tasks.filter((t) => !t.completed), [tasks]);
  const completedTasks = useMemo(() => tasks.filter((t) => t.completed), [tasks]);

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <AppSidebar />

      <div className="lg:pl-64 pl-0">
        <AppHeader />

        <main className="pt-20 pb-16 px-4 sm:px-8 max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">
          {/* Header & Section Navigation */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-white/10">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                My Study Plan
              </h1>
              <p className="text-xs text-slate-500 dark:text-outline mt-0.5">
                Manage your daily goals and study schedule with ease.
              </p>
            </div>

            {/* Secondary navigation to Roadmaps */}
            <div className="flex items-center gap-2">
              <Link
                href="/roadmaps"
                className="h-9 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Map className="w-3.5 h-3.5 text-primary" />
                <span>Roadmaps</span>
              </Link>

              {todoTasks.length > 0 && (
                <button
                  onClick={handleCarryForward}
                  disabled={isCarrying}
                  title="Reschedule overdue tasks to today"
                  className="h-9 px-3.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isCarrying ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline">Carry Forward</span>
                </button>
              )}
            </div>
          </div>

          {/* Effortless Inline Task Creator */}
          <div className="bg-white dark:bg-[#181c22] border border-slate-200/80 dark:border-white/10 rounded-2xl p-3.5 sm:p-4 shadow-xs">
            <form onSubmit={handleQuickAdd} className="flex flex-col sm:flex-row items-center gap-2.5">
              <input
                type="text"
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                placeholder="What do you need to study next? (e.g. Dynamic Programming on Trees)"
                className="w-full h-10 px-3.5 rounded-xl bg-slate-50 dark:bg-surface-container-low border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary focus:bg-white dark:focus:bg-[#181c22] transition-all"
              />

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={quickSubject}
                  onChange={(e) => setQuickSubject(e.target.value)}
                  className="h-10 px-3 rounded-xl bg-slate-50 dark:bg-surface-container-low border border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="General">General</option>
                  <option value="DSA">DSA</option>
                  <option value="System Design">System Design</option>
                  <option value="Backend">Backend</option>
                  <option value="AI / ML">AI / ML</option>
                </select>

                <button
                  type="submit"
                  disabled={!quickTitle.trim() || addingTask}
                  className="h-10 px-4 rounded-xl bg-primary hover:bg-primary/95 text-white text-xs font-semibold flex items-center justify-center gap-1 shadow-sm transition-all disabled:opacity-50 flex-shrink-0 cursor-pointer"
                >
                  {addingTask ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>Add</span>
                </button>
              </div>
            </form>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              {(["all", "todo", "completed"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                    filterStatus === status
                      ? "bg-primary text-white shadow-2xs font-semibold"
                      : "bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {status === "all" ? `All (${tasks.length})` : status === "todo" ? `To Do (${todoTasks.length})` : `Completed (${completedTasks.length})`}
                </button>
              ))}
            </div>

            <button
              onClick={openQuickTask}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Detailed task form</span>
            </button>
          </div>

          {/* Task List */}
          {loading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filteredTasks.length > 0 ? (
            <div className="space-y-2.5">
              {filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className={`group flex items-start justify-between p-3.5 rounded-xl border transition-all ${
                    task.completed
                      ? "bg-slate-50/70 dark:bg-white/[0.02] border-slate-100 dark:border-white/5 opacity-70"
                      : "bg-white dark:bg-[#181c22] border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 shadow-xs"
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
                        className={`text-xs sm:text-sm font-medium ${
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
                        <span>{task.estimated_minutes || 30} mins</span>
                        {task.priority === "P0" && (
                          <>
                            <span>•</span>
                            <span className="text-rose-600 font-semibold">P0 High</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      title="Delete Task"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 px-6 text-center bg-white dark:bg-[#181c22] border border-dashed border-slate-200 dark:border-white/10 rounded-2xl">
              <div className="w-10 h-10 mx-auto rounded-full bg-indigo-50 dark:bg-primary/20 text-primary flex items-center justify-center mb-3">
                <Calendar className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                No tasks found
              </h3>
              <p className="text-xs text-slate-500 dark:text-outline mt-1 max-w-sm mx-auto">
                {filterStatus === "completed"
                  ? "You haven't completed any tasks in this filter yet."
                  : "Your study schedule is currently empty. Add your first study task to get started."}
              </p>
              <div className="mt-4 flex items-center justify-center gap-2.5">
                <button
                  onClick={openQuickTask}
                  className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/95 transition-all shadow-xs cursor-pointer"
                >
                  + Add Study Task
                </button>
                <Link
                  href="/coach?prompt=Help%20me%20plan%20my%20study%20schedule"
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-white/15 transition-all"
                >
                  Ask AI Coach
                </Link>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
