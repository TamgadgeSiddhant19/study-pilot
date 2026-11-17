"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  Check,
  Plus,
  Trash2,
  Edit2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  RotateCcw,
  X,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { getTasks, createTask, updateTask, deleteTask, Task } from "@/lib/api";

export type DueStatus = "Due Tomorrow" | "Overdue" | "Due Today" | "Due in 3 days" | "Due in 5 days" | "Completed";

interface DailyNotepadProps {
  onTasksChanged?: () => void;
}

export function DailyNotepad({ onTasksChanged }: DailyNotepadProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New task form state
  const [newTitle, setNewTitle] = useState("");
  const [newDueStatus, setNewDueStatus] = useState<DueStatus>("Due Tomorrow");
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Inline editing state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const loadBackendTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTasks();
      setTasks(data);
    } catch (err: any) {
      console.error("Failed to load tasks from backend:", err);
      setError("Unable to connect to study server. Retrying or offline.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBackendTasks();
  }, [loadBackendTasks]);

  // Toggle complete / cut task
  const handleToggleComplete = async (task: Task) => {
    const nextCompleted = !task.completed;
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, completed: nextCompleted, status: nextCompleted ? "completed" : "todo" } : t))
    );

    try {
      const updated = await updateTask(task.id, {
        completed: nextCompleted,
        status: nextCompleted ? "completed" : "todo",
      });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      if (onTasksChanged) onTasksChanged();
    } catch (err) {
      console.error("Failed to toggle task:", err);
      // Revert on error
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
    }
  };

  // Add new task
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed || submitting) return;

    try {
      setSubmitting(true);
      const created = await createTask({
        title: trimmed,
        due_date: newDueStatus,
        priority: "P1",
        status: "todo",
        subject: "General",
        estimated_minutes: 30,
      });

      setTasks((prev) => [created, ...prev]);
      setNewTitle("");
      setShowAddForm(false);
      if (onTasksChanged) onTasksChanged();
    } catch (err: any) {
      console.error("Failed to create task:", err);
      alert("Failed to save task to server: " + (err.message || "Network error"));
    } finally {
      setSubmitting(false);
    }
  };

  // Start inline editing
  const handleStartEdit = (task: Task) => {
    setEditingId(task.id);
    setEditTitle(task.title);
  };

  // Save inline edit
  const handleSaveEdit = async (taskId: number) => {
    const trimmed = editTitle.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }

    // Optimistic update
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, title: trimmed } : t)));
    setEditingId(null);

    try {
      const updated = await updateTask(taskId, { title: trimmed });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      if (onTasksChanged) onTasksChanged();
    } catch (err) {
      console.error("Failed to update task title:", err);
      loadBackendTasks();
    }
  };

  // Delete / cut task
  const handleDeleteTask = async (taskId: number) => {
    const previous = [...tasks];
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    try {
      await deleteTask(taskId);
      if (onTasksChanged) onTasksChanged();
    } catch (err) {
      console.error("Failed to delete task:", err);
      setTasks(previous);
      alert("Failed to delete task on server.");
    }
  };

  // Cycle due status when badge is clicked
  const handleCycleDueStatus = async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    if (task.completed) return;

    const cycleOrder: DueStatus[] = [
      "Due Tomorrow",
      "Overdue",
      "Due in 5 days",
      "Due in 3 days",
      "Due Today",
    ];

    const currentDue = (task.due_date as DueStatus) || "Due Tomorrow";
    const currentIndex = cycleOrder.indexOf(currentDue);
    const nextStatus = cycleOrder[(currentIndex + 1) % cycleOrder.length];

    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, due_date: nextStatus } : t))
    );

    try {
      const updated = await updateTask(task.id, { due_date: nextStatus });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      if (onTasksChanged) onTasksChanged();
    } catch (err) {
      console.error("Failed to cycle due status:", err);
    }
  };

  const completedCount = tasks.filter((t) => t.completed).length;
  const totalCount = tasks.length;
  const allDone = totalCount > 0 && completedCount === totalCount;

  // Render badge with specific colors matching the user's reference mockup
  const renderDueBadge = (task: Task) => {
    if (task.completed || task.status === "completed") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#334155]/90 text-slate-300 font-medium text-xs border border-white/5 shadow-2xs select-none">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Completed</span>
        </span>
      );
    }

    const dueStatus = task.due_date || "Due Tomorrow";

    if (dueStatus === "Due Tomorrow") {
      return (
        <button
          type="button"
          onClick={(e) => handleCycleDueStatus(task, e)}
          title="Click to cycle status"
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium text-xs shadow-sm transition-all select-none cursor-pointer"
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Due Tomorrow</span>
        </button>
      );
    }

    if (dueStatus === "Overdue") {
      return (
        <button
          type="button"
          onClick={(e) => handleCycleDueStatus(task, e)}
          title="Click to cycle status"
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#dc2626] hover:bg-[#b91c1c] text-white font-medium text-xs shadow-sm transition-all select-none cursor-pointer"
        >
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Overdue</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={(e) => handleCycleDueStatus(task, e)}
        title="Click to cycle status"
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#16a34a] hover:bg-[#15803d] text-white font-medium text-xs shadow-sm transition-all select-none cursor-pointer"
      >
        <Calendar className="w-3.5 h-3.5" />
        <span>{dueStatus}</span>
      </button>
    );
  };

  return (
    <div
      id="daily-notepad"
      className="scroll-mt-24 rounded-2xl bg-gradient-to-br from-[#1e40af]/90 via-[#1e293b]/95 to-[#065f46]/90 p-6 shadow-2xl border border-sky-400/20 backdrop-blur-xl transition-all flex flex-col gap-5 text-white"
    >
      {/* 1. Header Bar: Title on left, Calendar and Actions on right */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold tracking-tight text-sky-400">
              Due Date Management
            </h2>
            <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-sky-950/80 text-sky-300 border border-sky-400/30 font-semibold">
              {completedCount}/{totalCount} Done
            </span>
            {loading && <Loader2 className="w-4 h-4 animate-spin text-sky-400" />}
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Add your to-do items for today. Click any task to edit, and check it off when you're done!
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="h-9 px-3.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-400/40 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>{showAddForm ? "Close" : "Add Task"}</span>
          </button>

          <button
            type="button"
            onClick={loadBackendTasks}
            title="Refresh from database"
            className="h-9 w-9 rounded-lg bg-sky-950/60 border border-sky-400/30 flex items-center justify-center text-sky-400 hover:text-sky-300 transition-colors shadow-2xs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-between text-xs text-rose-200">
          <span>{error}</span>
          <button
            type="button"
            onClick={loadBackendTasks}
            className="underline font-semibold hover:text-white"
          >
            Retry
          </button>
        </div>
      )}

      {/* 2. Add Task Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddTask}
          className="p-4 rounded-xl bg-[#1e293b]/95 border border-sky-400/30 flex flex-col sm:flex-row items-center gap-3 shadow-lg animate-in fade-in slide-in-from-top-2"
        >
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Enter task title (e.g. Distributed Consensus Raft Implementation)..."
            autoFocus
            className="flex-1 w-full px-3.5 py-2 rounded-lg bg-slate-900/90 border border-slate-700 text-white placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
          />

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={newDueStatus}
              onChange={(e) => setNewDueStatus(e.target.value as DueStatus)}
              className="px-3 py-2 rounded-lg bg-slate-900/90 border border-slate-700 text-slate-200 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-sky-400 cursor-pointer"
            >
              <option value="Due Tomorrow">Due Tomorrow (Blue)</option>
              <option value="Overdue">Overdue (Red)</option>
              <option value="Due in 5 days">Due in 5 days (Green)</option>
              <option value="Due in 3 days">Due in 3 days (Green)</option>
              <option value="Due Today">Due Today (Green)</option>
            </select>

            <button
              type="submit"
              disabled={!newTitle.trim() || submitting}
              className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 font-semibold text-xs transition-all flex items-center gap-1 shadow-sm"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 stroke-[2.5]" />}
              <span>Save</span>
            </button>
          </div>
        </form>
      )}

      {/* 3. Celebration Banner when all tasks are done */}
      {allDone && (
        <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-emerald-300">All tasks completed!</div>
              <p className="text-[11px] text-slate-300">
                You've cleared your due date list. Enjoy the rest of your day!
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadBackendTasks}
            className="text-[11px] font-mono text-emerald-300 hover:underline flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reload</span>
          </button>
        </div>
      )}

      {/* 4. Task Rows List */}
      <div className="flex flex-col gap-3">
        {loading && tasks.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400 flex flex-col items-center justify-center gap-2 bg-[#1e293b]/40 rounded-xl border border-dashed border-white/10">
            <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
            <span>Loading tasks from PostgreSQL...</span>
          </div>
        ) : tasks.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400 flex flex-col items-center justify-center gap-2 bg-[#1e293b]/40 rounded-xl border border-dashed border-white/10">
            <CheckCircle2 className="w-8 h-8 text-sky-400/60" />
            <span>No tasks currently scheduled. Click "+ Add Task" to schedule one!</span>
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className={`group relative rounded-xl px-4 py-3.5 flex items-center justify-between gap-4 transition-all shadow-md ${
                task.completed
                  ? "bg-[#1e293b]/70 border border-white/5 opacity-80"
                  : "bg-[#253248]/90 hover:bg-[#2c3b54] border border-white/10 hover:border-sky-400/40"
              }`}
            >
              {/* Left Side: Squircle Checkbox & Task Title */}
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                {/* Large Rounded-Square Checkbox */}
                <button
                  type="button"
                  onClick={() => handleToggleComplete(task)}
                  aria-label={task.completed ? "Mark incomplete" : "Cut task as done"}
                  className={`w-7 h-7 rounded-lg transition-all flex items-center justify-center flex-shrink-0 cursor-pointer ${
                    task.completed
                      ? "bg-gradient-to-tr from-cyan-400 to-emerald-400 shadow-[0_0_12px_rgba(56,189,248,0.5)] border-none text-slate-950"
                      : "border-2 border-sky-400/80 hover:border-sky-300 bg-transparent hover:bg-sky-400/10 text-transparent"
                  }`}
                >
                  <Check
                    className={`w-4 h-4 stroke-[3] transition-transform ${
                      task.completed ? "scale-100" : "scale-0"
                    }`}
                  />
                </button>

                {/* Task Title (Editable) */}
                <div className="flex-1 min-w-0">
                  {editingId === task.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEdit(task.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        autoFocus
                        className="w-full px-2.5 py-1 rounded bg-slate-900 text-white border border-sky-400 text-sm focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(task.id)}
                        className="p-1 rounded bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                        title="Save"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="p-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => handleStartEdit(task)}
                      className="cursor-pointer group/title flex items-center gap-2"
                      title="Click to edit task title"
                    >
                      <span
                        className={`text-sm sm:text-base transition-all break-words select-none ${
                          task.completed
                            ? "line-through text-slate-400 font-normal decoration-slate-400/70 decoration-2"
                            : "text-white font-medium hover:text-sky-200"
                        }`}
                      >
                        {task.title}
                      </span>
                      <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover/title:opacity-100 transition-opacity flex-shrink-0" />
                    </div>
                  )}
                </div>
              </div>

              {/* Right Side: Due Badge & Action Buttons */}
              <div className="flex items-center gap-2.5 flex-shrink-0">
                {renderDueBadge(task)}

                {/* Cut / Delete Button */}
                <button
                  type="button"
                  onClick={() => handleDeleteTask(task.id)}
                  title="Cut / Delete this task"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 transition-colors opacity-70 hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 5. Footer Bar */}
      <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs text-slate-300">
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>PostgreSQL Persistent Storage · Port 8001</span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={loadBackendTasks}
            className="text-sky-400 hover:text-sky-300 text-[11px] font-mono transition-colors flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Sync</span>
          </button>
        </div>
      </div>
    </div>
  );
}
