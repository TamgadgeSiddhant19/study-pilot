"use client";

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { logFocusSession } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export type TimerSessionType = "focus" | "short_break" | "long_break";

export interface TimerSettings {
  focusDuration: number; // in minutes
  shortBreakDuration: number;
  longBreakDuration: number;
  longBreakInterval: number; // default 4
  soundEnabled: boolean;
  notificationsEnabled: boolean;
}

export interface LinkedTask {
  id: number;
  title: string;
  subject?: string;
  estimated_minutes?: number;
}

export interface FocusTimerContextType {
  sessionType: TimerSessionType;
  isRunning: boolean;
  isPaused: boolean;
  remainingSeconds: number;
  totalSeconds: number;
  cycleCount: number; // 1 to longBreakInterval
  linkedTask: LinkedTask | null;
  settings: TimerSettings;
  isPopoverOpen: boolean;
  setIsPopoverOpen: (open: boolean) => void;
  togglePopover: () => void;
  startTimer: (task?: LinkedTask | null, customDurationMinutes?: number) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  resetTimer: () => void;
  switchSessionType: (type: TimerSessionType) => void;
  skipToNext: () => void;
  setLinkedTask: (task: LinkedTask | null) => void;
  updateSettings: (newSettings: Partial<TimerSettings>) => void;
  formatTime: (seconds: number) => string;
}

const DEFAULT_SETTINGS: TimerSettings = {
  focusDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  longBreakInterval: 4,
  soundEnabled: true,
  notificationsEnabled: true,
};

const TIMER_STORAGE_KEY = "studypilot_focus_timer_state_v1";

const FocusTimerContext = createContext<FocusTimerContextType | undefined>(undefined);

function playChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.15); // E5
    osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.35); // G5

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 1.2);
  } catch (e) {
    console.debug("Audio chime skipped:", e);
  }
}

export function FocusTimerProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [settings, setSettings] = useState<TimerSettings>(DEFAULT_SETTINGS);
  const [sessionType, setSessionType] = useState<TimerSessionType>("focus");
  const [remainingSeconds, setRemainingSeconds] = useState<number>(DEFAULT_SETTINGS.focusDuration * 60);
  const [totalSeconds, setTotalSeconds] = useState<number>(DEFAULT_SETTINGS.focusDuration * 60);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [endTimestamp, setEndTimestamp] = useState<number | null>(null);
  const [cycleCount, setCycleCount] = useState<number>(1);
  const [linkedTask, setLinkedTaskState] = useState<LinkedTask | null>(null);
  const [isPopoverOpen, setIsPopoverOpen] = useState<boolean>(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Restore from localStorage on initial client mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(TIMER_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.settings) setSettings(parsed.settings);
        if (parsed.sessionType) setSessionType(parsed.sessionType);
        if (parsed.cycleCount) setCycleCount(parsed.cycleCount);
        if (parsed.linkedTask) setLinkedTaskState(parsed.linkedTask);
        if (parsed.totalSeconds) setTotalSeconds(parsed.totalSeconds);

        if (parsed.isRunning && parsed.endTimestamp && !parsed.isPaused) {
          const now = Date.now();
          const diff = Math.max(0, Math.ceil((parsed.endTimestamp - now) / 1000));
          if (diff > 0) {
            setRemainingSeconds(diff);
            setEndTimestamp(parsed.endTimestamp);
            setIsRunning(true);
            setIsPaused(false);
          } else {
            // Finished while offline/closed
            setRemainingSeconds(0);
            setIsRunning(false);
            setIsPaused(false);
            setEndTimestamp(null);
          }
        } else if (parsed.isPaused && parsed.remainingSeconds) {
          setRemainingSeconds(parsed.remainingSeconds);
          setIsRunning(true);
          setIsPaused(true);
          setEndTimestamp(null);
        } else if (parsed.remainingSeconds) {
          setRemainingSeconds(parsed.remainingSeconds);
          setIsRunning(false);
          setIsPaused(false);
        }
      }
    } catch (e) {
      console.warn("Could not load stored timer state:", e);
    }
  }, []);

  // 2. Persist state to localStorage on changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stateToSave = {
        userId: user?.id,
        settings,
        sessionType,
        remainingSeconds,
        totalSeconds,
        isRunning,
        isPaused,
        endTimestamp,
        cycleCount,
        linkedTask,
      };
      localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(stateToSave));
    } catch {}
  }, [user?.id, settings, sessionType, remainingSeconds, totalSeconds, isRunning, isPaused, endTimestamp, cycleCount, linkedTask]);

  // 3. Clear on logout or user switch
  useEffect(() => {
    const handleLogout = () => {
      setIsRunning(false);
      setIsPaused(false);
      setEndTimestamp(null);
      setLinkedTaskState(null);
      setSessionType("focus");
      setRemainingSeconds(settings.focusDuration * 60);
      setTotalSeconds(settings.focusDuration * 60);
      if (typeof window !== "undefined") {
        localStorage.removeItem(TIMER_STORAGE_KEY);
      }
    };
    window.addEventListener("studypilot-logout", handleLogout);
    return () => window.removeEventListener("studypilot-logout", handleLogout);
  }, [settings.focusDuration]);

  const togglePopover = useCallback(() => {
    setIsPopoverOpen((prev) => !prev);
  }, []);

  const formatTime = useCallback((secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }, []);

  const getTargetDuration = useCallback((type: TimerSessionType, customMinutes?: number): number => {
    if (customMinutes && customMinutes > 0) return customMinutes * 60;
    if (type === "focus") return settings.focusDuration * 60;
    if (type === "short_break") return settings.shortBreakDuration * 60;
    return settings.longBreakDuration * 60;
  }, [settings]);

  // 4. Session Completion Handler
  const handleSessionComplete = useCallback(async () => {
    setIsRunning(false);
    setIsPaused(false);
    setEndTimestamp(null);
    setRemainingSeconds(0);

    // Audio chime
    if (settings.soundEnabled) {
      playChime();
    }

    // Browser notification
    if (settings.notificationsEnabled && typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        const title = sessionType === "focus" ? "Focus Session Complete! 🎯" : "Break Over! ⚡";
        const body =
          sessionType === "focus"
            ? (linkedTask ? `Completed: "${linkedTask.title}". Time for a rest!` : "Great focus! Take a breather.")
            : "Ready for another high-signal focus sprint?";
        try {
          new Notification(title, { body });
        } catch {}
      }
    }

    // Log to backend if it was a completed focus session
    if (sessionType === "focus" && user) {
      const minutesCompleted = Math.max(1, Math.round(totalSeconds / 60));
      try {
        await logFocusSession({
          subject: linkedTask?.subject || linkedTask?.title || "Pomodoro Focus",
          duration_minutes: minutesCompleted,
          session_type: "pomodoro",
          task_id: linkedTask?.id,
          completed: true,
          notes: JSON.stringify({
            planned_minutes: minutesCompleted,
            actual_minutes: minutesCompleted,
            session_type: "pomodoro",
            cycle: cycleCount,
          }),
        });
      } catch (err) {
        console.error("Failed to log focus session to backend:", err);
      }
    }

    // Transition cycle & prepare next session type (WITHOUT auto-starting)
    if (sessionType === "focus") {
      if (cycleCount >= settings.longBreakInterval) {
        // Next is Long Break
        setCycleCount(1);
        setSessionType("long_break");
        const nextDur = settings.longBreakDuration * 60;
        setTotalSeconds(nextDur);
        setRemainingSeconds(nextDur);
      } else {
        // Next is Short Break
        setCycleCount((prev) => prev + 1);
        setSessionType("short_break");
        const nextDur = settings.shortBreakDuration * 60;
        setTotalSeconds(nextDur);
        setRemainingSeconds(nextDur);
      }
    } else {
      // Break complete -> prepare next focus session
      setSessionType("focus");
      const nextDur = settings.focusDuration * 60;
      setTotalSeconds(nextDur);
      setRemainingSeconds(nextDur);
    }
  }, [sessionType, linkedTask, totalSeconds, user, cycleCount, settings]);

  // 5. Timer Tick Engine using exact end timestamp
  useEffect(() => {
    if (!isRunning || isPaused || !endTimestamp) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const tick = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.ceil((endTimestamp - now) / 1000));
      setRemainingSeconds(diff);
      if (diff <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        handleSessionComplete();
      }
    };

    tick();
    timerRef.current = setInterval(tick, 500);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        tick();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isRunning, isPaused, endTimestamp, handleSessionComplete]);

  // Actions
  const startTimer = useCallback(
    (task?: LinkedTask | null, customDurationMinutes?: number) => {
      // Request browser notification permission once on user gesture
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }

      if (task !== undefined) {
        setLinkedTaskState(task);
      }

      const dur = getTargetDuration(sessionType, customDurationMinutes);
      setTotalSeconds(dur);
      setRemainingSeconds(dur);
      const end = Date.now() + dur * 1000;
      setEndTimestamp(end);
      setIsRunning(true);
      setIsPaused(false);
    },
    [sessionType, getTargetDuration]
  );

  const pauseTimer = useCallback(() => {
    if (!isRunning || isPaused) return;
    setIsPaused(true);
    setEndTimestamp(null);
  }, [isRunning, isPaused]);

  const resumeTimer = useCallback(() => {
    if (!isRunning || !isPaused) return;
    const end = Date.now() + remainingSeconds * 1000;
    setEndTimestamp(end);
    setIsPaused(false);
  }, [isRunning, isPaused, remainingSeconds]);

  const resetTimer = useCallback(() => {
    setIsRunning(false);
    setIsPaused(false);
    setEndTimestamp(null);
    const dur = getTargetDuration(sessionType);
    setTotalSeconds(dur);
    setRemainingSeconds(dur);
  }, [sessionType, getTargetDuration]);

  const switchSessionType = useCallback(
    (type: TimerSessionType) => {
      setIsRunning(false);
      setIsPaused(false);
      setEndTimestamp(null);
      setSessionType(type);
      const dur = getTargetDuration(type);
      setTotalSeconds(dur);
      setRemainingSeconds(dur);
    },
    [getTargetDuration]
  );

  const skipToNext = useCallback(() => {
    setIsRunning(false);
    setIsPaused(false);
    setEndTimestamp(null);
    if (sessionType === "focus") {
      if (cycleCount >= settings.longBreakInterval) {
        setCycleCount(1);
        switchSessionType("long_break");
      } else {
        setCycleCount((prev) => prev + 1);
        switchSessionType("short_break");
      }
    } else {
      switchSessionType("focus");
    }
  }, [sessionType, cycleCount, settings.longBreakInterval, switchSessionType]);

  const updateSettings = useCallback(
    (newSettings: Partial<TimerSettings>) => {
      setSettings((prev) => {
        const updated = { ...prev, ...newSettings };
        if (!isRunning) {
          const currentDur =
            sessionType === "focus"
              ? updated.focusDuration * 60
              : sessionType === "short_break"
              ? updated.shortBreakDuration * 60
              : updated.longBreakDuration * 60;
          setTotalSeconds(currentDur);
          setRemainingSeconds(currentDur);
        }
        return updated;
      });
    },
    [isRunning, sessionType]
  );

  return (
    <FocusTimerContext.Provider
      value={{
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
        setLinkedTask: setLinkedTaskState,
        updateSettings,
        formatTime,
      }}
    >
      {children}
    </FocusTimerContext.Provider>
  );
}

export function useFocusTimer() {
  const context = useContext(FocusTimerContext);
  if (!context) {
    throw new Error("useFocusTimer must be used within a FocusTimerProvider");
  }
  return context;
}

