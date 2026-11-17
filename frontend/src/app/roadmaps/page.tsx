"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { useAuth } from "@/context/AuthContext";
import {
  Network,
  CheckCircle2,
  Clock,
  Circle,
  ArrowRight,
  GitBranch,
  Check,
  Sparkles,
  Layers,
  Award,
  ChevronRight,
  Bookmark,
} from "lucide-react";
import { getRoadmaps, updateTopicMastery, Roadmap } from "@/lib/api";

export default function RoadmapsPage() {
  const { user, loading: authLoading } = useAuth();
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [activeSlug, setActiveSlug] = useState("ai-systems");
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user) {
      setRoadmaps([]);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const data = await getRoadmaps();
      setRoadmaps(data);
      if (data.length > 0 && !activeSlug) {
        setActiveSlug(data[0].slug);
      }
    } catch (err) {
      console.error("Failed to load roadmaps:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user, activeSlug]);

  useEffect(() => {
    if (!authLoading) {
      loadData();
    }
  }, [authLoading, loadData]);

  useEffect(() => {
    const handleSync = () => {
      loadData();
    };
    const handleLogout = () => {
      setRoadmaps([]);
      setIsLoading(false);
    };

    window.addEventListener("studypilot-data-changed", handleSync);
    window.addEventListener("studypilot-user-changed", handleSync);
    window.addEventListener("studypilot-logout", handleLogout);
    return () => {
      window.removeEventListener("studypilot-data-changed", handleSync);
      window.removeEventListener("studypilot-user-changed", handleSync);
      window.removeEventListener("studypilot-logout", handleLogout);
    };
  }, [loadData]);

  const activeRoadmap = roadmaps.find((r) => r.slug === activeSlug) || roadmaps[0];

  const handleToggleTopic = async (topicId: number, currentStatus: string) => {
    const nextStatus = currentStatus === "mastered" ? "in_progress" : "mastered";
    const nextMastery = nextStatus === "mastered" ? 100 : 50;
    try {
      await updateTopicMastery(topicId, { status: nextStatus, mastery_percentage: nextMastery });
      await loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const totalTopics = activeRoadmap?.topics?.length || 0;
  const masteredTopics = activeRoadmap?.topics?.filter((t) => t.status === "mastered" || t.mastery_percentage >= 90).length || 0;
  const progressPct = totalTopics > 0 ? Math.round((masteredTopics / totalTopics) * 100) : 0;

  return (
    <div className="min-h-screen bg-background font-body text-on-surface antialiased">
      <AppSidebar />
      <AppHeader />

      <main className="lg:pl-64 pl-0 pt-16 min-h-screen">
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
          {/* My Plan Sub-Navigation Tabs */}
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200/80 dark:border-white/10 text-xs">
            <Link
              href="/plan"
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 font-medium transition-colors"
            >
              Daily Study Plan
            </Link>
            <span className="px-3 py-1.5 rounded-lg bg-primary text-white font-semibold shadow-2xs">
              Career Roadmaps
            </span>
          </div>

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-primary font-mono text-xs uppercase tracking-wider">
                <GitBranch className="w-4 h-4 text-tertiary" />
                Curriculum &amp; Milestones
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-on-surface">Career &amp; Tech Roadmaps</h1>
              <p className="text-xs sm:text-sm text-on-surface-variant max-w-2xl">
                Clear step-by-step topic guides to help you build solid skills and prepare for technical interviews.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-surface-container font-mono text-xs text-on-surface-variant border border-outline-variant/15">
                Target Role: <strong className="text-primary font-semibold">{user?.target_role || "Software Engineer"}</strong>
              </span>
            </div>
          </div>

          {/* Roadmap Selection Tabs */}
          <div className="flex items-center gap-3 overflow-x-auto pb-2">
            {roadmaps.map((r) => {
              const isActive = (activeRoadmap?.slug === r.slug) || (activeSlug === r.slug);
              return (
                <button
                  key={r.id}
                  onClick={() => setActiveSlug(r.slug)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 border transition-all shadow-xs ${
                    isActive
                      ? "bg-surface-container-high border-primary text-on-surface ring-1 ring-primary/30"
                      : "bg-surface-container-low border-outline-variant/15 text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                  }`}
                >
                  <Network className={`w-4 h-4 ${isActive ? "text-primary" : "text-outline"}`} />
                  <span>{r.title}</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-surface-container-lowest font-mono text-[10px] text-outline">
                    {r.topics?.length ?? 0}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Roadmap Container */}
          {activeRoadmap && (
            <div className="rounded-xl bg-surface-container border border-outline-variant/15 p-6 space-y-6 shadow-sm">
              {/* Roadmap Header Summary */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-5 border-b border-outline-variant/15 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-on-surface tracking-tight">{activeRoadmap.title}</h2>
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono text-[10px] uppercase font-semibold">
                      {activeRoadmap.category}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant max-w-xl">
                    {activeRoadmap.description || "In-depth engineering curriculum designed to build production competence."}
                  </p>
                </div>

                {/* Progress Metric */}
                <div className="flex items-center gap-4 bg-surface-container-lowest px-4 py-3 rounded-xl border border-outline-variant/10">
                  <div className="space-y-0.5">
                    <span className="font-mono text-[10px] uppercase text-outline">Milestones Completed</span>
                    <div className="font-mono text-sm font-bold text-on-surface">
                      {masteredTopics} <span className="text-outline font-normal">/ {totalTopics}</span>
                    </div>
                  </div>
                  <div className="h-8 w-px bg-surface-container-highest" />
                  <div className="space-y-1">
                    <div className="flex items-center justify-between font-mono text-xs gap-3">
                      <span className="text-outline">Mastery</span>
                      <span className="text-tertiary font-bold">{progressPct}%</span>
                    </div>
                    <div className="h-1.5 w-28 rounded-full bg-surface-container-high overflow-hidden">
                      <div className="h-full bg-tertiary transition-all" style={{ width: `${progressPct}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Topics / Milestones Breakdown */}
              <div className="space-y-3">
                <div className="flex items-center justify-between font-mono text-xs text-outline px-1">
                  <span>CURRICULUM PHASES & MILESTONES</span>
                  <span>CLICK ROW TO TOGGLE COMPLETION</span>
                </div>

                {isLoading ? (
                  <div className="py-12 text-center text-outline font-mono text-xs">
                    Loading curriculum roadmap...
                  </div>
                ) : activeRoadmap.topics?.length === 0 ? (
                  <div className="py-12 text-center text-outline font-mono text-xs">
                    No curriculum milestones found in this track.
                  </div>
                ) : (
                  activeRoadmap.topics?.map((topic, i) => {
                    const isDone = topic.status === "mastered" || topic.mastery_percentage >= 90;
                    return (
                      <div
                        key={topic.id}
                        onClick={() => handleToggleTopic(topic.id, topic.status)}
                        className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs ${
                          isDone
                            ? "bg-surface-container-low/60 border-outline-variant/10 hover:border-outline-variant/20"
                            : "bg-surface-container-low hover:bg-surface-container-high border-outline-variant/15"
                        }`}
                      >
                        <div className="flex items-start gap-3.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleTopic(topic.id, topic.status);
                            }}
                            className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center transition-colors border ${
                              isDone
                                ? "bg-tertiary border-tertiary text-on-tertiary"
                                : "border-outline text-transparent hover:border-primary"
                            }`}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </button>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] text-outline font-semibold uppercase">
                                Phase {i + 1}
                              </span>
                              <span className="text-outline text-[10px]">·</span>
                              <span className="font-mono text-[10px] text-primary">{topic.category}</span>
                            </div>
                            <h3
                              className={`text-sm font-semibold text-on-surface ${
                                isDone ? "line-through text-outline" : ""
                              }`}
                            >
                              {topic.title}
                            </h3>
                            {topic.description && (
                              <p className="text-xs text-on-surface-variant max-w-xl">
                                {topic.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end md:self-auto">
                          <div className="flex items-center gap-1.5 font-mono text-xs text-outline">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{topic.estimated_hours || 4}h</span>
                          </div>
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-mono text-[11px] font-medium ${
                              isDone
                                ? "bg-tertiary/15 text-tertiary"
                                : topic.status === "in_progress"
                                ? "bg-secondary/15 text-secondary"
                                : "bg-surface-container-high text-outline"
                            }`}
                          >
                            {isDone ? "Mastered" : topic.status === "in_progress" ? "In Progress" : "Scheduled"}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
