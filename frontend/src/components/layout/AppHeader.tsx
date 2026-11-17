"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  Search,
  Plus,
  Moon,
  Sun,
  LogOut,
  User as UserIcon,
  Settings,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useLayout } from "@/context/LayoutContext";
import { StreakCalendarPopover } from "@/components/layout/StreakCalendarPopover";
import { FocusTimerControl } from "@/components/timer/FocusTimerControl";

interface AppHeaderProps {
  title?: string;
  onAddTaskClick?: () => void;
  onLogSolvedClick?: () => void;
}

export function AppHeader({ title, onAddTaskClick, onLogSolvedClick }: AppHeaderProps) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { user, logout, isAuthenticated } = useAuth();
  const { toggleMobileSidebar, openQuickTask } = useLayout();
  const [searchVal, setSearchVal] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Derive readable title if not passed
  const getPageTitle = () => {
    if (title) return title;
    if (pathname === "/") return "Today's Overview";
    if (pathname.startsWith("/plan")) return "My Study Plan";
    if (pathname.startsWith("/roadmaps")) return "Roadmaps";
    if (pathname.startsWith("/leetcode")) return "Coding Practice";
    if (pathname.startsWith("/codelab")) return "CodeLab Online Compiler";
    if (pathname.startsWith("/resources")) return "Study Resources";
    if (pathname.startsWith("/coach")) return "AI Study Coach";
    if (pathname.startsWith("/analytics")) return "My Progress";
    if (pathname.startsWith("/focus")) return "Focus Sessions";
    if (pathname.startsWith("/settings")) return "Settings";
    if (pathname.startsWith("/onboarding")) return "Learning Profile";
    return "Dashboard";
  };

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const getInitials = (name?: string) => {
    if (!name) return "SP";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="fixed top-0 left-0 lg:left-64 right-0 h-16 bg-white/90 dark:bg-[#10141a]/90 backdrop-blur-md z-30 flex items-center justify-between px-4 sm:px-8 border-b border-slate-200/80 dark:border-white/10 transition-colors">
      {/* Left: Mobile hamburger + Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleMobileSidebar}
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-outline dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight">
            {getPageTitle()}
          </h1>
        </div>
      </div>

      {/* Center: Search input */}
      <div className="hidden md:flex flex-1 max-w-sm mx-6">
        <div className="relative w-full flex items-center">
          <Search className="absolute left-3 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search topics, tasks, problems..."
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            className="w-full h-8 pl-8 pr-12 rounded-lg bg-slate-50 dark:bg-surface-container-low border border-slate-200 dark:border-white/10 text-xs text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary focus:bg-white dark:focus:bg-[#181c22] transition-all"
          />
          <kbd className="absolute right-2 px-1.5 py-0.5 rounded text-[10px] bg-slate-200/60 dark:bg-white/10 text-slate-500 dark:text-outline font-mono">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Global Focus Timer Control */}
        <FocusTimerControl />

        {/* Quick Add Task button */}
        <button
          onClick={onAddTaskClick || openQuickTask}
          className="h-8 px-3 rounded-lg bg-primary hover:bg-primary/95 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Add Task</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          title={`Switch to ${theme === "dark" ? "Light" : "Dark"} mode`}
          className="p-2 rounded-lg text-slate-500 dark:text-outline hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
        >
          {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>

        {/* Active Study Streak Badge & Calendar Popover */}
        <StreakCalendarPopover />

        {/* User Menu */}
        {isAuthenticated && user ? (
          <div className="relative pl-1" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-8 h-8 rounded-full bg-primary/10 dark:bg-primary/20 text-primary flex items-center justify-center text-xs font-bold ring-1 ring-slate-200 dark:ring-white/10 hover:ring-primary cursor-pointer transition-all"
              title={user.full_name || user.email}
            >
              {getInitials(user.full_name)}
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white dark:bg-[#181c22] border border-slate-200 dark:border-white/10 shadow-lg py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="px-3.5 py-2 border-b border-slate-100 dark:border-white/10">
                  <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                    {user.full_name}
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-outline truncate">
                    {user.email}
                  </div>
                </div>

                <div className="py-1">
                  <Link
                    href="/onboarding"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3.5 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                    <span>Learning Profile</span>
                  </Link>

                  <Link
                    href="/settings"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3.5 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-400" />
                    <span>Preferences & Goals</span>
                  </Link>

                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors text-left cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Link
            href="/login"
            className="h-8 px-3 rounded-lg bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-800 dark:text-white text-xs font-semibold flex items-center transition-all"
          >
            Sign In
          </Link>
        )}
      </div>
    </header>
  );
}
