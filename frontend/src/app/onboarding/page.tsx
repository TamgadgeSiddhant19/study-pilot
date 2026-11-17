"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { createTask } from "@/lib/api";
import {
  GraduationCap,
  Briefcase,
  Sparkles,
  ArrowRight,
  Check,
  Loader2,
  Target,
  Code2,
  Cpu,
} from "lucide-react";

const SUGGESTED_GOALS = [
  {
    id: "ai",
    title: "AI Systems Engineer",
    desc: "LLMs, Vector Databases, and Scalable GenAI Systems",
    icon: Cpu,
  },
  {
    id: "dsa",
    title: "Algorithms & Coding Interviews",
    desc: "Master patterns for Top Tech & FAANG interviews",
    icon: Code2,
  },
  {
    id: "backend",
    title: "Backend & System Design",
    desc: "Distributed systems, caching, databases & APIs",
    icon: Target,
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading: authLoading, updateProfile } = useAuth();

  const [accountType, setAccountType] = useState<"student" | "professional">("student");
  const [selectedGoal, setSelectedGoal] = useState("AI Systems Engineer");
  const [customGoal, setCustomGoal] = useState("");
  const [createStarterTask, setCreateStarterTask] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    } else if (user) {
      if (user.account_type) setAccountType(user.account_type);
      if (user.target_role) setSelectedGoal(user.target_role);
    }
  }, [user, authLoading, router]);

  const handleComplete = async () => {
    setSaving(true);
    const finalGoal = customGoal.trim() ? customGoal.trim() : selectedGoal;

    try {
      await updateProfile({
        account_type: accountType,
        target_role: finalGoal,
        is_onboarded: true,
      });

      // Optionally create a gentle starter task so new users have something immediately actionable
      if (createStarterTask) {
        try {
          await createTask({
            title: `Review foundations for ${finalGoal}`,
            subject: accountType === "student" ? "Course Prep" : "Career Track",
            priority: "P1",
            estimated_minutes: 30,
            status: "todo",
            completed: false,
          });
        } catch {
          // Non-critical if task creation fails
        }
      }

      router.push("/");
    } catch (err) {
      console.error("Failed to update profile:", err);
      router.push("/");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    setSaving(true);
    try {
      await updateProfile({ is_onboarded: true });
    } catch {
      // Ignore
    } finally {
      router.push("/");
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background relative overflow-hidden py-10">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-primary/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-xl z-10 space-y-6">
        {/* Header Branding */}
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Quick 1-Minute Setup</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Welcome, {user?.full_name?.split(" ")[0] || "Learner"}!
          </h1>
          <p className="text-xs text-slate-500 dark:text-outline mt-1">
            Let's tailor StudyPilot to your primary study goal. You can change this anytime.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-[#181c22] border border-slate-200 dark:border-white/10 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          {/* Step 1: Account Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              I am currently a:
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAccountType("student")}
                className={`p-3.5 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                  accountType === "student"
                    ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                    : "border-slate-200 dark:border-white/10 hover:border-slate-300 text-slate-700 dark:text-slate-300"
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-white/10 flex items-center justify-center text-primary">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Student</div>
                  <div className="text-[11px] text-slate-400">Exams &amp; Internships</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAccountType("professional")}
                className={`p-3.5 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                  accountType === "professional"
                    ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                    : "border-slate-200 dark:border-white/10 hover:border-slate-300 text-slate-700 dark:text-slate-300"
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-white/10 flex items-center justify-center text-primary">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Professional</div>
                  <div className="text-[11px] text-slate-400">Career &amp; Upskilling</div>
                </div>
              </button>
            </div>
          </div>

          {/* Step 2: Learning Goal */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Choose your primary learning goal:
            </label>
            <div className="space-y-2.5">
              {SUGGESTED_GOALS.map((goal) => {
                const Icon = goal.icon;
                const isSelected = selectedGoal === goal.title && !customGoal.trim();
                return (
                  <button
                    key={goal.id}
                    type="button"
                    onClick={() => {
                      setSelectedGoal(goal.title);
                      setCustomGoal("");
                    }}
                    className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                        : "border-slate-200 dark:border-white/10 hover:border-slate-300 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-600 dark:text-slate-300">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-900 dark:text-white">
                          {goal.title}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-outline">
                          {goal.desc}
                        </div>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-primary" />}
                  </button>
                );
              })}
            </div>

            {/* Custom write-in goal */}
            <div className="mt-3">
              <input
                type="text"
                placeholder="Or type a custom goal (e.g. AWS Solutions Architect)..."
                value={customGoal}
                onChange={(e) => setCustomGoal(e.target.value)}
                className="w-full h-10 px-3.5 rounded-xl bg-slate-50 dark:bg-surface-container-low border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Starter action checkbox */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-container-low border border-slate-100 dark:border-white/5 flex items-center gap-3">
            <input
              type="checkbox"
              id="starter-task"
              checked={createStarterTask}
              onChange={(e) => setCreateStarterTask(e.target.checked)}
              className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary"
            />
            <label htmlFor="starter-task" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              Add a starter study task to my schedule to help me get started today.
            </label>
          </div>

          {/* Actions */}
          <div className="space-y-3 pt-2">
            <button
              onClick={handleComplete}
              disabled={saving}
              className="w-full h-11 rounded-xl bg-primary hover:bg-primary/95 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-60 cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <span>Save &amp; Open StudyPilot</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={handleSkip}
                className="text-xs text-slate-400 hover:text-slate-600 dark:text-outline dark:hover:text-white transition-colors cursor-pointer"
              >
                Skip for now, I'll customize later
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
