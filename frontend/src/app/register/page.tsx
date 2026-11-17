"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  GraduationCap,
  Briefcase,
  User as UserIcon,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [accountType, setAccountType] = useState<"student" | "professional">("student");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim() || !email.trim() || !password) {
      setError("Please fill out all required fields.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);
    try {
      await register({
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        account_type: accountType,
      });
      // Immediately take to role-specific onboarding
      router.push("/onboarding");
    } catch (err: any) {
      setError(err.message || "Registration failed. An account with this email may already exist.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-primary/10 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-[300px] h-[300px] bg-tertiary/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-lg z-10 py-6">
        {/* Header Branding */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="flex items-center gap-2.5 mb-2.5">
            <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-base shadow-sm">
              SP
            </div>
            <span className="font-semibold text-2xl tracking-tight text-slate-900 dark:text-white">
              StudyPilot
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Create your account
          </h1>
          <p className="text-xs text-slate-500 dark:text-on-surface-variant mt-1">
            Personalized study companion designed for your background & career goals
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
            {/* Step 1: Account Type Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                I am using StudyPilot as a:
              </label>
              <div className="grid grid-cols-2 gap-3">
                {/* Student Option */}
                <button
                  type="button"
                  onClick={() => setAccountType("student")}
                  className={`p-3.5 rounded-xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                    accountType === "student"
                      ? "bg-indigo-50/70 dark:bg-primary/10 border-primary text-primary dark:text-primary ring-1 ring-primary"
                      : "bg-slate-50 dark:bg-surface-container-low border-slate-200 dark:border-white/10 text-slate-600 dark:text-on-surface-variant hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <GraduationCap className="w-5 h-5" />
                    {accountType === "student" && <CheckCircle2 className="w-4 h-4 text-primary" />}
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-slate-900 dark:text-white">Student</div>
                    <div className="text-[11px] text-slate-500 dark:text-on-surface-variant mt-0.5 leading-tight">
                      Undergrad, grad, or preparing for first role
                    </div>
                  </div>
                </button>

                {/* Professional Option */}
                <button
                  type="button"
                  onClick={() => setAccountType("professional")}
                  className={`p-3.5 rounded-xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                    accountType === "professional"
                      ? "bg-indigo-50/70 dark:bg-primary/10 border-primary text-primary dark:text-primary ring-1 ring-primary"
                      : "bg-slate-50 dark:bg-surface-container-low border-slate-200 dark:border-white/10 text-slate-600 dark:text-on-surface-variant hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Briefcase className="w-5 h-5" />
                    {accountType === "professional" && <CheckCircle2 className="w-4 h-4 text-primary" />}
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-slate-900 dark:text-white">Professional</div>
                    <div className="text-[11px] text-slate-500 dark:text-on-surface-variant mt-0.5 leading-tight">
                      Software engineer or leveling up skills
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label
                htmlFor="fullName"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Full Name
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-outline" />
                <input
                  id="fullName"
                  type="text"
                  name="fullName"
                  autoComplete="name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Alex River"
                  className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-slate-50 dark:bg-surface-container-low border border-[#E2E8F0] dark:border-outline-variant/20 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                />
              </div>
            </div>

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
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-outline" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
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
              <p className="text-[11px] text-slate-400 dark:text-outline mt-1 font-mono">
                Must be at least 8 characters. Hashed securely with Argon2.
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 mt-3 rounded-xl bg-primary hover:bg-primary/95 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating your account...</span>
                </>
              ) : (
                <>
                  <span>Continue to Onboarding</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-white/10" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase">
              <span className="bg-white dark:bg-[#181c22] px-3 text-slate-400 dark:text-outline font-mono">
                Already registered?
              </span>
            </div>
          </div>

          {/* Login Callout */}
          <div className="text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/90 transition-colors"
            >
              <span>Sign in to your account</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
