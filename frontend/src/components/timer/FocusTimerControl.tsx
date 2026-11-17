"use client";

import React, { useState, useRef, useEffect } from "react";
import { useFocusTimer, TimerSessionType } from "@/context/FocusTimerContext";
import {
  Timer,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Settings,
  X,
  Volume2,
  VolumeX,
  Check,
  CheckCircle2,
  Clock,
  Sparkles,
  Link as LinkIcon,
} from "lucide-react";

export function FocusTimerControl() {
  const {
    sessionType,
    isRunning,
    isPaused,
    remainingSeconds,
    totalSeconds,
    cycleCount,
    linkedTask,
    settings,
    isPopoverOpen,
    setIsPopoverOpen,
    togglePopover,
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    switchSessionType,
    skipToNext,
    setLinkedTask,
    updateSettings,
    formatTime,
  } = useFocusTimer();

  const [showSettings, setShowSettings] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsPopoverOpen(false);
        setShowSettings(false);
      }
    };
    if (isPopoverOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isPopoverOpen, setIsPopoverOpen]);

  // Calculate percentage
  const progressPct = totalSeconds > 0 ? Math.max(0, Math.min(100, Math.round(((totalSeconds - remainingSeconds) / totalSeconds) * 100))) : 0;
  const circumference = 2 * Math.PI * 42; // radius = 42
  const strokeDashoffset = circumference - (progressPct / 100) * circumference;

  const getSessionColor = (type: TimerSessionType) => {
    if (type === "focus") return "primary";
    if (type === "short_break") return "emerald";
    return "indigo";
  };

  const getSessionLabel = (type: TimerSessionType) => {
    if (type === "focus") return "Focus";
    if (type === "short_break") return "Short Break";
    return "Long Break";
  };

  return (
    <div className="relative inline-block" ref={popoverRef}>
      {/* 1. Compact Header Trigger Button */}
      <button
        type="button"
        onClick={togglePopover}
        className={`h-8 px-2.5 sm:px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer select-none ${
          isRunning && !isPaused
            ? sessionType === "focus"
              ? "bg-primary/10 border-primary text-primary dark:bg-primary/20 shadow-2xs"
              : "bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
            : isPaused
            ? "bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
            : "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
        }`}
        title="Open Pomodoro Focus Timer"
        aria-label="Pomodoro Focus Timer"
      >
        {/* Pulsing indicator dot when running */}
        {isRunning && !isPaused ? (
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                sessionType === "focus" ? "bg-primary" : "bg-emerald-500"
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                sessionType === "focus" ? "bg-primary" : "bg-emerald-500"
              }`}
            />
          </span>
        ) : isPaused ? (
          <span className="inline-flex rounded-full h-2 w-2 bg-amber-500" />
        ) : (
          <Timer className="w-3.5 h-3.5 text-slate-500 dark:text-outline" />
        )}

        <span className="font-mono font-medium">
          {isRunning || isPaused ? formatTime(remainingSeconds) : "Focus"}
        </span>

        {linkedTask && isRunning && (
          <span className="hidden lg:inline text-[10px] max-w-[90px] truncate text-slate-400 font-normal">
            • {linkedTask.title}
          </span>
        )}
      </button>

      {/* 2. Compact Popover Dropdown Panel */}
      {isPopoverOpen && (
        <div
          role="dialog"
          aria-label="Focus Timer Panel"
          className="absolute right-0 top-11 w-80 sm:w-88 rounded-2xl bg-white dark:bg-[#181c22] border border-slate-200 dark:border-white/10 shadow-2xl p-4 sm:p-5 z-50 text-on-surface animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header & Session Type Selector */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
            <div className="flex items-center gap-1.5 p-0.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/50 dark:border-white/5">
              {(["focus", "short_break", "long_break"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => switchSessionType(type)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                    sessionType === type
                      ? type === "focus"
                        ? "bg-primary text-white shadow-2xs"
                        : type === "short_break"
                        ? "bg-emerald-600 text-white shadow-2xs"
                        : "bg-indigo-600 text-white shadow-2xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {type === "focus" ? "Focus" : type === "short_break" ? "Short" : "Long"}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowSettings(!showSettings)}
                className={`p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer ${
                  showSettings ? "text-primary bg-primary/10" : ""
                }`}
                title="Timer Settings"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPopoverOpen(false);
                  setShowSettings(false);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Settings Drawer (Collapsible) */}
          {showSettings ? (
            <div className="py-3 space-y-3.5 animate-in fade-in duration-100">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
                <span>Duration Settings</span>
                <span className="text-[10px] text-slate-400">minutes</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">Focus</label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={settings.focusDuration}
                    onChange={(e) => updateSettings({ focusDuration: Math.max(1, parseInt(e.target.value) || 25) })}
                    className="w-full h-8 px-2 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-mono text-center focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">Short Break</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={settings.shortBreakDuration}
                    onChange={(e) => updateSettings({ shortBreakDuration: Math.max(1, parseInt(e.target.value) || 5) })}
                    className="w-full h-8 px-2 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-mono text-center focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">Long Break</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={settings.longBreakDuration}
                    onChange={(e) => updateSettings({ longBreakDuration: Math.max(1, parseInt(e.target.value) || 15) })}
                    className="w-full h-8 px-2 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-mono text-center focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              {/* Sound & Notification Toggles */}
              <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
                  className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 cursor-pointer"
                >
                  {settings.soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-primary" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
                  <span className="text-[11px]">Audio Chime</span>
                </button>

                <button
                  type="button"
                  onClick={() => updateSettings({ notificationsEnabled: !settings.notificationsEnabled })}
                  className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 cursor-pointer"
                >
                  <span className="text-[11px]">Notifications</span>
                  <span
                    className={`w-7 h-4 rounded-full flex items-center p-0.5 transition-colors ${
                      settings.notificationsEnabled ? "bg-primary justify-end" : "bg-slate-300 dark:bg-white/20 justify-start"
                    }`}
                  >
                    <span className="w-3 h-3 rounded-full bg-white shadow-xs" />
                  </span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="w-full h-7 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-[11px] font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          ) : (
            /* Main Timer View */
            <div className="py-4 space-y-4 text-center">
              {/* Linked Task Banner if active */}
              {linkedTask && (
                <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-primary/20 text-xs">
                  <div className="flex items-center gap-1.5 min-w-0 pr-2">
                    <LinkIcon className="w-3 h-3 text-primary flex-shrink-0" />
                    <span className="font-semibold text-slate-900 dark:text-white truncate">
                      {linkedTask.title}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLinkedTask(null)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-[10px] cursor-pointer"
                    title="Unlink Task"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Circular Countdown Display */}
              <div className="relative w-44 h-44 mx-auto flex items-center justify-center">
                <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                  {/* Background Track */}
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="transparent"
                    className="stroke-slate-100 dark:stroke-white/5"
                    strokeWidth="5"
                  />
                  {/* Active Progress Stroke */}
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="transparent"
                    className={`transition-all duration-500 ${
                      sessionType === "focus"
                        ? "stroke-primary"
                        : sessionType === "short_break"
                        ? "stroke-emerald-500"
                        : "stroke-indigo-500"
                    }`}
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                  />
                </svg>

                {/* Clock Digital Center */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-extrabold font-mono tracking-tight text-slate-900 dark:text-white">
                    {formatTime(remainingSeconds)}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-outline uppercase tracking-wider mt-0.5">
                    {getSessionLabel(sessionType)}
                  </span>
                </div>
              </div>

              {/* Pomodoro 4-Session Cycle Indicator */}
              <div className="flex items-center justify-center gap-2">
                <span className="text-[10px] text-slate-400 font-medium">Cycle:</span>
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: settings.longBreakInterval }, (_, i) => i + 1).map((c) => (
                    <div
                      key={c}
                      className={`h-2 rounded-full transition-all ${
                        c === cycleCount
                          ? "w-5 bg-primary"
                          : c < cycleCount
                          ? "w-2 bg-emerald-500"
                          : "w-2 bg-slate-200 dark:bg-white/10"
                      }`}
                      title={`Session ${c} of ${settings.longBreakInterval}`}
                    />
                  ))}
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  {cycleCount}/{settings.longBreakInterval}
                </span>
              </div>

              {/* Action Buttons: Play/Pause, Reset, Skip */}
              <div className="flex items-center justify-center gap-2.5 pt-1">
                {/* Reset button */}
                <button
                  type="button"
                  onClick={resetTimer}
                  title="Reset Timer"
                  className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                {/* Main Play / Pause Button */}
                {!isRunning || isPaused ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (isPaused) resumeTimer();
                      else startTimer(linkedTask);
                    }}
                    className="h-10 px-6 rounded-xl bg-primary hover:bg-primary/95 text-white font-semibold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>{isPaused ? "Resume" : "Start"}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={pauseTimer}
                    className="h-10 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-white/90 text-white dark:text-slate-900 font-semibold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <Pause className="w-4 h-4 fill-current" />
                    <span>Pause</span>
                  </button>
                )}

                {/* Skip to next session type */}
                <button
                  type="button"
                  onClick={skipToNext}
                  title="Skip to next session"
                  className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

