"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarCheck,
  Code2,
  Sparkles,
  TrendingUp,
  Settings,
  LogOut,
  X,
  BookMarked,
  Map,
  Timer,
  Terminal,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLayout } from "@/context/LayoutContext";

interface PrimaryDestination {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: (pathname: string) => boolean;
  sublinks?: { label: string; href: string; icon: React.ComponentType<{ className?: string }> }[];
}

export function AppSidebar() {
  const pathname = usePathname();
  const { user, logout, isAuthenticated } = useAuth();
  const { mobileSidebarOpen, setMobileSidebarOpen } = useLayout();

  const destinations: PrimaryDestination[] = [
    {
      label: "Home",
      href: "/",
      icon: LayoutDashboard,
      isActive: (path) => path === "/",
    },
    {
      label: "My Plan",
      href: "/plan",
      icon: CalendarCheck,
      isActive: (path) => path.startsWith("/plan") || path.startsWith("/roadmaps"),
      sublinks: [
        { label: "Roadmaps", href: "/roadmaps", icon: Map },
      ],
    },
    {
      label: "Practice",
      href: "/leetcode",
      icon: Code2,
      isActive: (path) => path.startsWith("/leetcode") || path.startsWith("/resources") || path.startsWith("/codelab"),
      sublinks: [
        { label: "Resources", href: "/resources", icon: BookMarked },
      ],
    },
    {
      label: "Study Coach",
      href: "/coach",
      icon: Sparkles,
      isActive: (path) => path.startsWith("/coach"),
    },
    {
      label: "My Progress",
      href: "/analytics",
      icon: TrendingUp,
      isActive: (path) => path.startsWith("/analytics") || path.startsWith("/focus"),
      sublinks: [
        { label: "Focus Log", href: "/focus", icon: Timer },
      ],
    },
  ];

  const getInitials = (name?: string) => {
    if (!name) return "SP";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between">
      <div className="flex flex-col flex-1 min-h-0">
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200/80 dark:border-white/10">
          <Link
            href="/"
            onClick={() => setMobileSidebarOpen(false)}
            className="flex items-center gap-2.5 group"
          >
            <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center font-bold text-sm shadow-xs tracking-tight group-hover:scale-105 transition-transform">
              SP
            </div>
            <div>
              <span className="font-semibold text-base tracking-tight text-slate-900 dark:text-white">
                StudyPilot
              </span>
              <span className="block text-[10px] text-slate-400 dark:text-outline font-medium -mt-0.5">
                Study Companion
              </span>
            </div>
          </Link>

          {/* Close button on mobile */}
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:text-outline dark:hover:text-white"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Primary Navigation Links */}
        <div className="overflow-y-auto flex-1 px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-outline font-mono">
            Navigation
          </div>
          <nav className="space-y-1">
            {destinations.map((item) => {
              const Icon = item.icon;
              const active = item.isActive(pathname);
              return (
                <div key={item.label} className="space-y-0.5">
                  <Link
                    href={item.href}
                    onClick={() => setMobileSidebarOpen(false)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all ${
                      active
                        ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-white font-semibold shadow-2xs border border-primary/20 dark:border-transparent"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white font-medium"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${active ? "text-primary dark:text-primary-container" : "text-slate-400 dark:text-slate-400"}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.label === "Study Coach" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary dark:bg-primary/30 dark:text-indigo-200 font-mono font-semibold">
                        AI
                      </span>
                    )}
                  </Link>

                  {/* Secondary sublinks when active */}
                  {active && item.sublinks && (
                    <div className="pl-9 pr-2 py-1 space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
                      {item.sublinks.map((sub) => {
                        const SubIcon = sub.icon;
                        const isSubActive = pathname === sub.href;
                        return (
                          <Link
                            key={sub.label}
                            href={sub.href}
                            onClick={() => setMobileSidebarOpen(false)}
                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] transition-colors ${
                              isSubActive
                                ? "text-primary dark:text-white font-semibold bg-slate-100 dark:bg-white/10"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
                            }`}
                          >
                            <SubIcon className="w-3 h-3" />
                            <span>{sub.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </div>

      {/* User & Settings Footer */}
      <div className="p-3 border-t border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-transparent">
        {isAuthenticated && user ? (
          <div className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-100/80 dark:hover:bg-white/5 transition-colors">
            <Link
              href="/onboarding"
              onClick={() => setMobileSidebarOpen(false)}
              className="flex items-center gap-2.5 min-w-0 flex-1"
            >
              <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold ring-1 ring-slate-200 dark:ring-white/10 flex-shrink-0">
                {getInitials(user.full_name)}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                  {user.full_name}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-outline truncate">
                  {user.target_role || (user.account_type === "student" ? "Student" : "Professional")}
                </div>
              </div>
            </Link>

            <div className="flex items-center gap-0.5">
              <Link
                href="/settings"
                onClick={() => setMobileSidebarOpen(false)}
                title="Settings"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:text-outline dark:hover:text-white transition-colors"
              >
                <Settings className="w-4 h-4" />
              </Link>
              <button
                onClick={() => logout()}
                title="Sign out"
                aria-label="Sign out"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:text-outline dark:hover:text-rose-400 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <Link
            href="/login"
            onClick={() => setMobileSidebarOpen(false)}
            className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary/95 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition-all"
          >
            Sign In / Register
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-64 bg-white dark:bg-[#10141a] z-40 flex-col justify-between border-r border-slate-200/80 dark:border-white/10 shadow-xs">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] h-full bg-white dark:bg-[#10141a] shadow-xl border-r border-slate-200 dark:border-white/10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
