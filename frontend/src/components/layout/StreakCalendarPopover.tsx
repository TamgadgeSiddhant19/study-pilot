"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Flame,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { getStreakData, StreakData } from "@/lib/api";

const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

interface CalendarDay {
  dayNumber: number;
  dateStr: string;
  isoDate: string;
  isCurrentMonth: boolean;
  isStreak: boolean;
  hours: number;
  isToday: boolean;
  isFuture: boolean;
}

interface CalendarWeek {
  weekNum: number;
  days: CalendarDay[];
}

export function StreakCalendarPopover() {
  const [isOpen, setIsOpen] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [hoveredDay, setHoveredDay] = useState<{
    date: string;
    hours: number;
    isStreak: boolean;
  } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Month navigation: default to current month
  const [currentDate, setCurrentDate] = useState(() => new Date(2026, 0, 1));
  const [todayISO, setTodayISO] = useState("");

  const loadData = async () => {
    try {
      const data = await getStreakData();
      setStreakData(data);
    } catch (err) {
      console.error("Failed to load streak data:", err);
    }
  };

  useEffect(() => {
    const now = new Date();
    setCurrentDate(now);
    setTodayISO(now.toISOString().split("T")[0]);
    loadData();
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  const streakDays = streakData?.current_streak ?? 0;
  const nextMilestone = streakData?.next_milestone ?? 7;
  const daysToMilestone = streakData?.days_to_milestone ?? Math.max(0, nextMilestone - streakDays);
  const milestoneProgressPct = streakData?.milestone_progress_pct ?? 0;
  const avgHours = streakData?.average_daily_hours ?? 0.0;

  // Map of daily records keyed by ISO date YYYY-MM-DD
  const recordsMap = useMemo(() => {
    const map = new Map<string, number>();
    if (streakData?.daily_records) {
      for (const rec of streakData.daily_records) {
        map.set(rec.date, rec.hours);
      }
    }
    return map;
  }, [streakData]);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const monthName = currentDate.toLocaleDateString("en-US", { month: "long" });

  const handlePrevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // Build the dynamic calendar grid based on real user session records
  const calendarWeeks = useMemo<CalendarWeek[]>(() => {
    const today = todayISO ? new Date(todayISO) : new Date(2026, 0, 1);

    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);

    // Monday-based day of week (0 = Mon, 6 = Sun)
    const firstDayWeekday = (firstDayOfMonth.getDay() + 6) % 7;
    const totalDaysInMonth = lastDayOfMonth.getDate();

    // Days from previous month
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();

    const allDays: CalendarDay[] = [];

    // Prepend days from previous month to align with Monday
    for (let i = firstDayWeekday - 1; i >= 0; i--) {
      const dNum = prevMonthLastDay - i;
      const prevDate = new Date(currentYear, currentMonth - 1, dNum);
      const iso = prevDate.toISOString().split("T")[0];
      const hours = recordsMap.get(iso) || 0;
      allDays.push({
        dayNumber: dNum,
        dateStr: prevDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        isoDate: iso,
        isCurrentMonth: false,
        isStreak: false,
        hours,
        isToday: iso === todayISO,
        isFuture: prevDate > today,
      });
    }

    // Current month days
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const thisDate = new Date(currentYear, currentMonth, d);
      const iso = thisDate.toISOString().split("T")[0];
      const hours = recordsMap.get(iso) || 0;
      const isToday = iso === todayISO;
      const isFuture = thisDate > today;

      // Only mark streak if user has an active streak and studied on that day
      let isStreak = false;
      if (streakDays > 0 && !isFuture && hours > 0) {
        // Calculate difference in days from today
        const diffDays = Math.round((today.getTime() - thisDate.getTime()) / (1000 * 3600 * 24));
        if (diffDays >= 0 && diffDays < streakDays) {
          isStreak = true;
        }
      }

      allDays.push({
        dayNumber: d,
        dateStr: thisDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        isoDate: iso,
        isCurrentMonth: true,
        isStreak,
        hours,
        isToday,
        isFuture,
      });
    }

    // Next month padding to complete the last week
    const remainingDays = (7 - (allDays.length % 7)) % 7;
    for (let d = 1; d <= remainingDays; d++) {
      const nextDate = new Date(currentYear, currentMonth + 1, d);
      const iso = nextDate.toISOString().split("T")[0];
      allDays.push({
        dayNumber: d,
        dateStr: nextDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        isoDate: iso,
        isCurrentMonth: false,
        isStreak: false,
        hours: 0,
        isToday: false,
        isFuture: true,
      });
    }

    // Split into weeks
    const weeks: CalendarWeek[] = [];
    for (let i = 0; i < allDays.length; i += 7) {
      weeks.push({
        weekNum: Math.floor(i / 7) + 1,
        days: allDays.slice(i, i + 7),
      });
    }

    return weeks;
  }, [currentYear, currentMonth, recordsMap, streakDays, todayISO]);

  // Color intensity helper for Calendar-wise Heatmap
  const getHeatmapCellStyle = (day: CalendarDay) => {
    if (!day.isCurrentMonth) {
      return "bg-transparent text-slate-300 dark:text-slate-700 cursor-default";
    }
    if (day.isFuture) {
      return "bg-slate-50 dark:bg-white/[0.02] text-slate-400 dark:text-slate-600 border border-slate-100 dark:border-white/5";
    }
    if (day.hours === 0) {
      return "bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10";
    }
    if (day.hours < 2.0) {
      return "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 font-semibold hover:ring-1 hover:ring-emerald-400";
    }
    if (day.hours < 3.5) {
      return "bg-emerald-200 dark:bg-emerald-700/80 text-emerald-950 dark:text-white font-bold hover:ring-1 hover:ring-emerald-400";
    }
    return "bg-emerald-500 dark:bg-emerald-500 text-white font-bold shadow-xs hover:bg-emerald-600";
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Header Streak Trigger Badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="View Active Streak Calendar"
        title="View Daily Active Streak & Consistency"
        className={`h-9 px-3 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer ${
          isOpen
            ? "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-400 shadow-xs"
            : streakDays > 0
            ? "bg-amber-500/10 hover:bg-amber-500/15 border-amber-500/25 text-amber-800 dark:text-amber-300 hover:border-amber-500/40"
            : "bg-slate-100 hover:bg-slate-200/80 dark:bg-white/5 dark:hover:bg-white/10 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400"
        }`}
      >
        <Flame
          className={`w-4 h-4 ${
            streakDays > 0
              ? "text-amber-500 fill-amber-500 animate-pulse"
              : "text-slate-400 dark:text-slate-500"
          }`}
        />
        <span className="font-bold">{streakDays}</span>
        <span className="hidden sm:inline font-medium text-[11px] opacity-90">days</span>
      </button>

      {/* Adaptive Theme Popover Card */}
      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-[330px] max-w-[92vw] rounded-3xl bg-white dark:bg-[#16181d] text-slate-800 dark:text-white border border-slate-200 dark:border-white/10 shadow-2xl p-5 z-50 animate-in fade-in zoom-in-95 duration-150">
          {/* Top Row: Year, Month & Controls */}
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{currentYear}</div>
              <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <span>{monthName}</span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handlePrevMonth}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Previous Month"
                aria-label="Previous Month"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleNextMonth}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Next Month"
                aria-label="Next Month"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 ml-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Close"
                aria-label="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Separate Tabs: Streak View vs Heatmap */}
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="p-0.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setShowHeatmap(false)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  !showHeatmap
                    ? "bg-white dark:bg-[#20242b] text-amber-600 dark:text-amber-400 shadow-xs font-bold"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                <Flame className={`w-3.5 h-3.5 ${!showHeatmap ? "text-amber-500 fill-amber-500" : "text-slate-400"}`} />
                <span>Streak</span>
              </button>

              <button
                type="button"
                onClick={() => setShowHeatmap(true)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  showHeatmap
                    ? "bg-white dark:bg-[#20242b] text-emerald-600 dark:text-emerald-400 shadow-xs font-bold"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                <Sparkles className={`w-3.5 h-3.5 ${showHeatmap ? "text-emerald-500" : "text-slate-400"}`} />
                <span>Heatmap</span>
              </button>
            </div>

            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
              Avg: <strong className="text-slate-800 dark:text-slate-200">{avgHours}h</strong>/day
            </span>
          </div>

          {/* Table Header: Weekday columns */}
          <div className="mt-4 grid grid-cols-8 text-center text-[10px] font-semibold text-slate-400 dark:text-slate-500 tracking-wider mb-2 select-none">
            <div className="font-mono">#</div>
            {WEEKDAYS.map((wd) => (
              <div key={wd}>{wd}</div>
            ))}
          </div>

          {/* Calendar Body: Mode 1 (Streak Flames) or Mode 2 (Calendar-wise Heatmap with dates) */}
          <div className="space-y-1.5 select-none">
            {calendarWeeks.map((week) => (
              <div key={week.weekNum} className="grid grid-cols-8 items-center text-center">
                {/* Week Index */}
                <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 flex items-center justify-center">
                  {week.weekNum}
                </div>

                {/* 7 Days per week */}
                {week.days.map((day, dIdx) => {
                  const isHovered = hoveredDay?.date === day.dateStr;

                  if (!showHeatmap) {
                    /* Streak View: Flames on real streak days */
                    return (
                      <div
                        key={`${week.weekNum}-${dIdx}`}
                        onMouseEnter={() =>
                          setHoveredDay({
                            date: day.dateStr,
                            hours: day.hours,
                            isStreak: day.isStreak,
                          })
                        }
                        onMouseLeave={() => setHoveredDay(null)}
                        className="h-8 flex items-center justify-center relative cursor-pointer group"
                      >
                        {day.isStreak ? (
                          <div className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-amber-500/15 dark:hover:bg-amber-500/20 transition-all">
                            <span
                              className="text-base leading-none select-none drop-shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse"
                              role="img"
                              aria-label="Lit streak flame"
                            >
                              🔥
                            </span>
                          </div>
                        ) : day.isToday ? (
                          <div className="w-6 h-6 rounded-full bg-slate-900 dark:bg-slate-700 text-white font-bold text-[11px] flex items-center justify-center ring-2 ring-primary">
                            {day.dayNumber}
                          </div>
                        ) : !day.isCurrentMonth ? (
                          <span className="text-[11px] font-medium text-slate-300 dark:text-slate-600">
                            {day.dayNumber}
                          </span>
                        ) : day.isFuture ? (
                          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                            {day.dayNumber}
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">
                            {day.dayNumber}
                          </span>
                        )}
                      </div>
                    );
                  } else {
                    /* Heatmap View: Calendar-wise with visible dates and heat intensity colors */
                    const heatStyle = getHeatmapCellStyle(day);

                    return (
                      <div
                        key={`${week.weekNum}-${dIdx}`}
                        onMouseEnter={() =>
                          setHoveredDay({
                            date: day.dateStr,
                            hours: day.hours,
                            isStreak: day.isStreak,
                          })
                        }
                        onMouseLeave={() => setHoveredDay(null)}
                        className="h-8 flex items-center justify-center relative"
                      >
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] transition-all cursor-pointer ${heatStyle} ${
                            day.isToday ? "ring-2 ring-primary ring-offset-1 dark:ring-offset-[#16181d]" : ""
                          } ${isHovered ? "scale-110 z-10 shadow-sm" : ""}`}
                        >
                          {day.dayNumber}
                        </div>
                      </div>
                    );
                  }
                })}
              </div>
            ))}
          </div>

          {/* Heatmap Legend Bar (Visible when in heatmap mode) */}
          {showHeatmap && (
            <div className="mt-3 pt-2 border-t border-slate-100 dark:border-white/10 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
              <span className="font-medium">Focus intensity:</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px]">0h</span>
                <div className="w-2.5 h-2.5 rounded-xs bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10" title="0h / Rest" />
                <div className="w-2.5 h-2.5 rounded-xs bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800/40" title="< 2.0h" />
                <div className="w-2.5 h-2.5 rounded-xs bg-emerald-200 dark:bg-emerald-700/80" title="2.0h - 3.5h" />
                <div className="w-2.5 h-2.5 rounded-xs bg-emerald-500 dark:bg-emerald-500" title="3.5h+" />
                <span className="text-[9px]">4h+</span>
              </div>
            </div>
          )}

          {/* Bottom Card Footer */}
          <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-white/10 space-y-2">
            <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
              <Flame
                className={`w-4 h-4 shrink-0 ${
                  streakDays > 0 ? "text-amber-500 fill-amber-500" : "text-slate-400"
                }`}
              />
              <span>
                {streakDays > 0 ? (
                  <>
                    You are on a <strong className="text-slate-900 dark:text-white font-bold">{streakDays}-day streak</strong>
                    {hoveredDay ? (
                      <span className="text-emerald-600 dark:text-amber-400 ml-1 font-mono font-semibold">
                        ({hoveredDay.date}: {hoveredDay.hours}h)
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className="text-slate-500 dark:text-slate-400">
                    No active streak yet · Log a study session today to start your streak!
                  </span>
                )}
              </span>
            </div>

            {/* Next Milestone Bar */}
            <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-2 border border-slate-100 dark:border-white/5">
              <div className="flex items-center justify-between text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                <span className="text-slate-700 dark:text-slate-300">
                  Next milestone: <strong className="text-amber-600 dark:text-amber-400 font-semibold">{nextMilestone} days</strong>
                </span>
                <span className="font-mono text-slate-500 dark:text-slate-400">{daysToMilestone}d left</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${milestoneProgressPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
