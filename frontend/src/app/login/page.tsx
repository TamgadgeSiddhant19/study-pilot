"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Eye, EyeOff, Lock, Mail, ArrowRight, Loader2, AlertCircle, Sparkles, Zap, Check } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirect");
  const redirectPath = rawRedirect && !rawRedirect.startsWith("/login") ? rawRedirect : "/";
  const { login, loginDemo, isAuthenticated, loading: authLoading, user } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already authenticated, redirect to destination
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      router.replace(redirectPath);
    }
  }, [authLoading, isAuthenticated, user, redirectPath, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Please fill in both email and password.");
      return;
    }

    setLoading(true);
    try {
      await login({ email: email.trim(), password });
      router.replace(redirectPath);
    } catch (err: any) {
      setError(err.message || "Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    setDemoLoading(true);
    try {
      await loginDemo();
      router.replace(redirectPath);
    } catch (err: any) {
      setError(err.message || "Failed to log in with demo account. Please try again.");
    } finally {
      setDemoLoading(false);
    }
  };

  const handleAutofillDemo = () => {
    setEmail("demo@studypilot.io");
    setPassword("Demo@123456");
    setError(null);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-secondary/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md z-10">
        {/* Header Branding */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-base shadow-sm">
              SP
            </div>
            <span className="font-semibold text-2xl tracking-tight text-slate-900 dark:text-white">
              StudyPilot
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Welcome back
          </h1>
          <p className="text-xs text-slate-500 dark:text-on-surface-variant mt-1">
            Sign in to continue your personalized study journey
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-[#181c22] border border-[#E2E8F0] dark:border-white/10 rounded-2xl p-6 sm:p-8 shadow-sm">
          {error && (
            <div
              role="alert"
              className="mb-6 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-outline" />
                <input
                  id="email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@domain.com"
                  className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-slate-50 dark:bg-surface-container-low border border-[#E2E8F0] dark:border-outline-variant/20 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-outline" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full h-11 pl-10 pr-10 rounded-xl bg-slate-50 dark:bg-surface-container-low border border-[#E2E8F0] dark:border-outline-variant/20 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-outline dark:hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 mt-2 rounded-xl bg-primary hover:bg-primary/95 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Access Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-white/10" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-wider font-semibold">
              <span className="bg-white dark:bg-[#181c22] px-2.5 text-slate-400 dark:text-outline font-mono">
                Development Quick Access
              </span>
            </div>
          </div>

          {/* One-Click Demo Login Button */}
          <button
            type="button"
            disabled={loading || demoLoading}
            onClick={handleDemoLogin}
            className="w-full h-11 rounded-xl bg-gradient-to-r from-violet-600/10 via-primary/15 to-indigo-600/10 hover:from-violet-600/20 hover:via-primary/25 hover:to-indigo-600/20 border border-primary/30 hover:border-primary/60 text-slate-900 dark:text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-xs group cursor-pointer disabled:opacity-60"
          >
            {demoLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span>Signing in as Demo User...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-amber-500 fill-amber-500 group-hover:scale-110 transition-transform" />
                <span className="font-semibold text-slate-800 dark:text-slate-100">One-Click Demo Student Login</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-mono ml-1 font-bold">DEV</span>
              </>
            )}
          </button>

          {/* Demo Account Credentials Badge */}
          <div className="mt-3 p-2.5 rounded-xl bg-slate-50 dark:bg-surface-container-low border border-slate-200 dark:border-white/10 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 animate-pulse" />
              <div className="truncate font-mono text-[11px]">
                <span className="text-slate-900 dark:text-slate-200 font-medium">demo@studypilot.io</span>
                <span className="text-slate-400 mx-1.5">•</span>
                <span className="text-slate-500">Demo@123456</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAutofillDemo}
              className="text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors ml-2 px-2 py-1 rounded-md bg-primary/10 hover:bg-primary/15 flex-shrink-0 cursor-pointer flex items-center gap-1"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span>Filled!</span>
                </>
              ) : (
                <span>Auto-fill</span>
              )}
            </button>
          </div>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-white/10" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase">
              <span className="bg-white dark:bg-[#181c22] px-3 text-slate-400 dark:text-outline font-mono">
                New to StudyPilot?
              </span>
            </div>
          </div>

          {/* Registration Callout */}
          <div className="text-center">
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/90 transition-colors"
            >
              <span>Create a free account</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center mt-6 text-[11px] text-slate-400 dark:text-outline flex items-center justify-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span>PostgreSQL + Argon2 Powered Security</span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
