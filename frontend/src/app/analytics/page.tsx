"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import {
  LineChart,
  Flame,
  Zap,
  Award,
  Target,
  ArrowUpRight,
} from "lucide-react";
import { getOverviewAnalytics, getFocusStats, OverviewData, FocusStats } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function AnalyticsPage() {
  const { user, loading: authLoading } = useAuth();
  const [analytics, setAnalytics] = useState<OverviewData | null>(null);
  const [focus, setFocus] = useState<FocusStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = () => {
    setIsLoading(true);
    Promise.all([getOverviewAnalytics(), getFocusStats()])
      .then(([a, f]) => {
        setAnalytics(a);
        setFocus(f);
      })
      .catch((err) => console.error("Failed to load analytics:", err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setAnalytics(null);
      setFocus(null);
      setIsLoading(false);
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

  const totalLC = analytics?.leetcode.total_solved || 0;
  const easyLC = analytics?.leetcode.easy || 0;
  const medLC = analytics?.leetcode.medium || 0;
  const hardLC = analytics?.leetcode.hard || 0;
  const dailyQuota = user?.daily_flight_quota_hours || analytics?.daily_flight_quota_hours || 4.0;

  return (
    <div className="min-h-screen bg-background font-body text-on-surface antialiased">
      <AppSidebar />
      <AppHeader />

      <main className="lg:pl-64 pl-0 pt-16 min-h-screen">
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
          {/* My Progress Sub-Navigation Tabs */}
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200/80 dark:border-white/10 text-xs">
            <span className="px-3 py-1.5 rounded-lg bg-primary text-white font-semibold shadow-2xs">
              Progress &amp; Mastery
            </span>
            <Link
              href="/focus"
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 font-medium transition-colors"
            >
              Focus Sessions
            </Link>
          </div>

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-primary font-mono text-xs uppercase tracking-wider">
                <LineChart className="w-4 h-4 text-tertiary" />
                Performance &amp; Statistics
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-on-surface">Progress &amp; Analytics</h1>
              <p className="text-xs sm:text-sm text-on-surface-variant max-w-2xl">
                Track your real daily study time, practice problems, and milestones.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-surface-container font-mono text-xs text-outline border border-outline-variant/15">
                Target: <strong className="text-primary font-semibold">{user?.target_role || "Software Engineering"}</strong>
                {user?.target_date ? ` · ${user.target_date}` : ""}
              </span>
            </div>
          </div>

          {/* Top 4 KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl bg-surface-container border border-outline-variant/15 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between text-outline font-mono text-xs">
                <span>STUDY PACE</span>
                <Target className="w-4 h-4 text-tertiary" />
              </div>
              <div className="my-2">
                <div className="text-3xl font-bold text-on-surface">{analytics?.on_track_percentage ?? 0}%</div>
              </div>
              <div className="text-xs text-tertiary font-mono flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>
                  {(analytics?.on_track_percentage ?? 0) > 0
                    ? `On track for ${user?.target_role || "target"}`
                    : "Add tasks to start tracking pace"}
                </span>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-surface-container border border-outline-variant/15 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between text-outline font-mono text-xs">
                <span>ACTIVE STREAK</span>
                <Flame className="w-4 h-4 text-secondary" />
              </div>
              <div className="my-2">
                <div className="text-3xl font-bold text-on-surface">{analytics?.streak_days ?? 0} Days</div>
              </div>
              <div className="text-xs text-secondary font-mono flex items-center gap-1">
                <span>
                  {(analytics?.streak_days ?? 0) > 0 ? "Active study streak" : "Complete daily study to build streak"}
                </span>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-surface-container border border-outline-variant/15 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between text-outline font-mono text-xs">
                <span>TOTAL PROBLEMS</span>
                <Award className="w-4 h-4 text-primary" />
              </div>
              <div className="my-2">
                <div className="text-3xl font-bold text-on-surface">{totalLC}</div>
              </div>
              <div className="text-xs text-primary font-mono">
                {easyLC} Easy · {medLC} Med · {hardLC} Hard
              </div>
            </div>

            <div className="p-5 rounded-xl bg-surface-container border border-outline-variant/15 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between text-outline font-mono text-xs">
                <span>WEEKLY STUDY TIME</span>
                <Zap className="w-4 h-4 text-tertiary" />
              </div>
              <div className="my-2">
                <div className="text-3xl font-bold text-on-surface">{focus?.weekly_hours ?? 0.0}h</div>
              </div>
              <div className="text-xs text-tertiary font-mono">
                {(focus?.weekly_hours ?? 0) > 0
                  ? `${focus?.weekly_hours}h logged this week`
                  : "0 hours logged this week"}
              </div>
            </div>
          </div>

          {/* Deep Analytics Bento Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Algorithmic Inventory Breakdown */}
            <div className="p-6 rounded-xl bg-surface-container border border-outline-variant/15 space-y-4 shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b border-outline-variant/15">
                <h3 className="font-semibold text-sm text-on-surface">Algorithmic Practice Distribution</h3>
                <span className="font-mono text-xs text-outline">{totalLC} Solved</span>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div>
                  <div className="flex justify-between pb-1">
                    <span className="text-tertiary">Easy Problems</span>
                    <span className="text-on-surface font-semibold">{easyLC}</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-container-lowest overflow-hidden">
                    <div
                      className="h-full bg-tertiary transition-all duration-500"
                      style={{ width: totalLC > 0 ? `${(easyLC / totalLC) * 100}%` : "0%" }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between pb-1">
                    <span className="text-secondary">Medium Problems</span>
                    <span className="text-on-surface font-semibold">{medLC}</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-container-lowest overflow-hidden">
                    <div
                      className="h-full bg-secondary transition-all duration-500"
                      style={{ width: totalLC > 0 ? `${(medLC / totalLC) * 100}%` : "0%" }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between pb-1">
                    <span className="text-error">Hard Problems</span>
                    <span className="text-on-surface font-semibold">{hardLC}</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-container-lowest overflow-hidden">
                    <div
                      className="h-full bg-error transition-all duration-500"
                      style={{ width: totalLC > 0 ? `${(hardLC / totalLC) * 100}%` : "0%" }}
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-surface-container-lowest border border-outline-variant/10 text-xs text-on-surface-variant flex items-center justify-between font-mono">
                <span>Questions Due for Review:</span>
                <span className="text-error font-semibold">{analytics?.leetcode.srs_due ?? 0} scheduled today</span>
              </div>
            </div>

            {/* Daily Study Hours & Milestones */}
            <div className="p-6 rounded-xl bg-surface-container border border-outline-variant/15 space-y-4 shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b border-outline-variant/15">
                <h3 className="font-semibold text-sm text-on-surface">Daily Study Goal</h3>
                <span className="font-mono text-xs text-primary">Daily Target: {dailyQuota}h</span>
              </div>

              <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/10 flex items-center justify-between">
                <div>
                  <span className="font-mono text-[10px] uppercase text-outline">Today's Focus Log</span>
                  <div className="text-2xl font-bold text-on-surface">
                    {analytics?.flight_hours_today ?? 0.0}{" "}
                    <span className="text-xs text-outline font-normal">/ {dailyQuota}h</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono text-[10px] uppercase text-outline">Goal Progress</span>
                  <div className="text-2xl font-bold text-tertiary">
                    {analytics?.flight_percentage ?? 0}%
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <span className="font-mono text-xs uppercase text-outline">Milestones Status</span>
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-on-surface">
                    {analytics?.milestones_completed ?? 0} of {analytics?.milestones_total ?? 0} Milestones Complete
                  </span>
                  <span className="text-primary font-bold">{analytics?.milestones_percentage ?? 0}%</span>
                </div>
                <div className="h-2 rounded-full bg-surface-container-lowest overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${analytics?.milestones_percentage ?? 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
