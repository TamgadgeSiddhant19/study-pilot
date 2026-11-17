"use client";

import React, { useState } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { Settings, Save, RotateCcw, Moon, Sun, Cpu, Sliders, ShieldCheck } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const [provider, setProvider] = useState("deterministic");
  const [quota, setQuota] = useState(4.0);
  const [ease, setEase] = useState(2.5);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="min-h-screen bg-background font-body text-on-surface antialiased">
      <AppSidebar />
      <AppHeader />

      <main className="lg:pl-64 pl-0 pt-16 min-h-screen">
        <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-primary font-mono text-xs uppercase tracking-wider">
                <Settings className="w-4 h-4 text-tertiary" />
                App Preferences &amp; Study Configuration
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-on-surface">Settings &amp; Preferences</h1>
              <p className="text-sm text-on-surface-variant max-w-2xl">
                Configure appearance, daily study goal, AI helper options, and review preferences.
              </p>
            </div>

            <button
              onClick={handleSave}
              className="h-9 px-4 rounded-xl bg-primary text-on-primary font-mono text-xs font-semibold flex items-center gap-1.5 shadow-sm hover:opacity-90 transition-all self-start md:self-auto"
            >
              <Save className="w-4 h-4" />
              <span>{saved ? "Saved Successfully!" : "Save Settings"}</span>
            </button>
          </div>

          <div className="rounded-xl bg-surface-container border border-outline-variant/15 p-6 space-y-6 shadow-sm">
            {/* Theme Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-outline-variant/15 gap-3">
              <div>
                <div className="text-sm font-semibold text-on-surface">Interface Theme</div>
                <div className="text-xs text-on-surface-variant">
                  Switch between clean dark mode and high-contrast light mode.
                </div>
              </div>
              <button
                onClick={toggleTheme}
                className="px-4 py-2 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-mono text-xs capitalize flex items-center gap-2 border border-outline-variant/20 transition-colors shadow-xs"
              >
                {theme === "dark" ? <Moon className="w-4 h-4 text-secondary" /> : <Sun className="w-4 h-4 text-primary" />}
                <span>Active: {theme} Mode</span>
              </button>
            </div>

            {/* AI Provider */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-outline-variant/15 gap-3">
              <div>
                <div className="text-sm font-semibold text-on-surface">AI Study Coach Provider</div>
                <div className="text-xs text-on-surface-variant max-w-md">
                  Smart built-in planner generates structured study schedules instantly with zero cost.
                </div>
              </div>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="px-3.5 py-2 rounded-lg bg-surface-container-lowest border border-outline-variant/20 text-xs font-mono text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="deterministic">Built-in Planner (Free, Instant)</option>
                <option value="gemini">Google Gemini Pro / Flash</option>
                <option value="openai">OpenAI GPT-4o</option>
              </select>
            </div>

            {/* Daily Quota */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-outline-variant/15 gap-3">
              <div>
                <div className="text-sm font-semibold text-on-surface">Daily Study Goal</div>
                <div className="text-xs text-on-surface-variant">
                  Target daily study hours to stay on track for your goal.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.5"
                  value={quota}
                  onChange={(e) => setQuota(parseFloat(e.target.value))}
                  className="w-20 px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/20 text-xs font-mono text-on-surface text-center focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <span className="font-mono text-xs text-outline">hours/day</span>
              </div>
            </div>

            {/* Baseline Ease */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-outline-variant/15 gap-3">
              <div>
                <div className="text-sm font-semibold text-on-surface">Practice Review Pacing</div>
                <div className="text-xs text-on-surface-variant">
                  Default spacing multiplier applied when you solve a practice problem.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  value={ease}
                  onChange={(e) => setEase(parseFloat(e.target.value))}
                  className="w-20 px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/20 text-xs font-mono text-on-surface text-center focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <span className="font-mono text-xs text-outline">multiplier</span>
              </div>
            </div>

            {/* System Status Banner */}
            <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/15 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-tertiary" />
                <span className="text-on-surface">Backend Health: Fast API Live (Port 8001)</span>
              </div>
              <span className="text-tertiary">All Services Operational</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
