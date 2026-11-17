"use client";

import React, { useEffect, useState, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { useAuth } from "@/context/AuthContext";
import {
  Sparkles,
  Bot,
  Send,
  RotateCcw,
  CheckCircle2,
  Calendar,
  ArrowRight,
  Loader2,
  User,
  Plus,
  FileText,
  BookOpen,
  AlertCircle,
  ExternalLink,
  X,
} from "lucide-react";
import {
  getCoachConversations,
  sendCoachMessage,
  generateCoachPlan,
  applyCoachPlan,
  resetCoachContext,
  confirmActionProposal,
  rejectActionProposal,
  CoachMessage,
  StructuredPlan,
  ActionProposal,
  RAGSource,
} from "@/lib/api";

const SUGGESTED_PROMPTS = [
  { label: "Plan my week", prompt: "Plan my study schedule for this week based on my target role." },
  { label: "What should I study next?", prompt: "What should I focus on studying next today?" },
  { label: "Help me revise", prompt: "Help me revise key concepts from my recent study topics." },
  { label: "Explain a concept", prompt: "Can you explain dynamic programming memoization with an intuitive analogy?" },
];

function CoachChat() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const initialPrompt = searchParams.get("prompt");

  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | undefined>(undefined);
  const [inputMsg, setInputMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [responsePreference, setResponsePreference] = useState<"balanced" | "concise" | "step_by_step">("balanced");
  const [knowledgeScope, setKnowledgeScope] = useState<"both" | "documents" | "general">("both");
  const [lastError, setLastError] = useState<{ message: string; failedPrompt: string } | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<RAGSource | null>(null);

  // Plan generation modal / confirmation
  const [generatedPlan, setGeneratedPlan] = useState<StructuredPlan | null>(null);
  const [applyingPlan, setApplyingPlan] = useState(false);
  const [planApplied, setPlanApplied] = useState(false);

  // Proposal confirmation state
  const [actionStates, setActionStates] = useState<Record<number, "pending" | "confirming" | "confirmed" | "rejected">>({});

  const handleConfirmProposal = async (proposalId: number) => {
    setActionStates((prev) => ({ ...prev, [proposalId]: "confirming" }));
    try {
      await confirmActionProposal(proposalId);
      setActionStates((prev) => ({ ...prev, [proposalId]: "confirmed" }));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("task-created"));
      }
    } catch (err: any) {
      alert(err?.message || "Failed to confirm action proposal");
      setActionStates((prev) => ({ ...prev, [proposalId]: "pending" }));
    }
  };

  const handleRejectProposal = async (proposalId: number) => {
    try {
      await rejectActionProposal(proposalId);
      setActionStates((prev) => ({ ...prev, [proposalId]: "rejected" }));
    } catch (err) {
      console.error("Failed to reject proposal:", err);
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadConversations = async () => {
    if (!user) {
      setMessages([]);
      setActiveConversationId(undefined);
      setLoadingHistory(false);
      return;
    }
    try {
      setLoadingHistory(true);
      const convs = await getCoachConversations();
      if (convs && convs.length > 0) {
        setActiveConversationId(convs[0].id);
        if (convs[0].messages && convs[0].messages.length > 0) {
          setMessages(convs[0].messages);
        } else {
          setMessages([]);
        }
      } else {
        setActiveConversationId(undefined);
        setMessages([]);
      }
    } catch (err) {
      console.error("Failed to load coach messages:", err);
      setMessages([]);
      setActiveConversationId(undefined);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      loadConversations();
    }
  }, [user?.id, authLoading]);

  useEffect(() => {
    const handleAuthChange = () => {
      loadConversations();
    };
    const handleLogout = () => {
      setMessages([]);
      setActiveConversationId(undefined);
      setGeneratedPlan(null);
    };

    window.addEventListener("studypilot-user-changed", handleAuthChange);
    window.addEventListener("studypilot-logout", handleLogout);
    return () => {
      window.removeEventListener("studypilot-user-changed", handleAuthChange);
      window.removeEventListener("studypilot-logout", handleLogout);
    };
  }, [user?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle incoming query param prompt
  useEffect(() => {
    if (initialPrompt && !sending && messages.length === 0) {
      executeSendMessage(initialPrompt);
    }
  }, [initialPrompt]);

  const executeSendMessage = async (text: string) => {
    if (!text.trim() || sending) return;

    setInputMsg("");
    setSending(true);
    setLastError(null);

    const optimisticMsg: CoachMessage = {
      id: Date.now(),
      role: "user",
      content: text.trim(),
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const assistantMsg = await sendCoachMessage(
        text.trim(),
        activeConversationId,
        responsePreference,
        knowledgeScope
      );
      if (assistantMsg.conversation_id) {
        setActiveConversationId(assistantMsg.conversation_id);
      }
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error("Coach message dispatch error:", err);
      const errMsg = err?.message || "Failed to communicate with the AI Study Coach.";
      setLastError({
        message: errMsg,
        failedPrompt: text.trim(),
      });
      const errorBubble: CoachMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: `Unable to generate response: ${errMsg}. Please verify that GEMINI_API_KEY is configured in backend/.env.`,
        grounding_source: "Provider Error",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorBubble]);
    } finally {
      setSending(false);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sending) {
      executeSendMessage(inputMsg);
    }
  };

  const handleRetryLast = () => {
    if (lastError && !sending) {
      executeSendMessage(lastError.failedPrompt);
    }
  };

  const handleResetContext = async () => {
    if (window.confirm("Start a fresh conversation with your Study Coach?")) {
      try {
        await resetCoachContext();
        setMessages([]);
        setActiveConversationId(undefined);
        setLastError(null);
      } catch (err) {
        console.error("Failed to reset:", err);
      }
    }
  };

  // Quick Plan Generator
  const handleQuickGeneratePlan = async () => {
    setSending(true);
    try {
      const plan = await generateCoachPlan({
        learning_goal: user?.target_role || "AI Systems Engineer",
        available_hours_per_day: user?.daily_flight_quota_hours || 4.0,
        deadline_days: 14,
        current_skill_level: "Intermediate",
        completed_topics: [],
      });
      setGeneratedPlan(plan);
      setPlanApplied(false);
    } catch (err) {
      console.error("Failed to generate plan:", err);
    } finally {
      setSending(false);
    }
  };

  const handleApplyPlan = async () => {
    if (!generatedPlan) return;
    setApplyingPlan(true);
    try {
      await applyCoachPlan(generatedPlan);
      setPlanApplied(true);
      // Inform other views to refresh tasks
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("task-created"));
      }
    } catch (err) {
      console.error("Failed to apply plan:", err);
    } finally {
      setApplyingPlan(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <AppSidebar />

      <div className="lg:pl-64 pl-0">
        <AppHeader />

        <main className="pt-20 pb-8 px-4 sm:px-8 max-w-4xl mx-auto flex flex-col h-[calc(100vh-5rem)]">
          {/* Header Bar */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-white/10 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-base font-semibold text-slate-900 dark:text-white">
                  AI Study Coach
                </h1>
                <p className="text-[11px] text-slate-500 dark:text-outline">
                  Personalized study guidance and curriculum planning
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleQuickGeneratePlan}
                disabled={sending}
                className="h-8 px-3 rounded-lg bg-indigo-50 dark:bg-primary/20 text-primary text-xs font-semibold hover:bg-indigo-100 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Generate Study Plan</span>
              </button>

              {messages.length > 0 && (
                <button
                  onClick={handleResetContext}
                  title="Clear conversation"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:text-outline dark:hover:text-white transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Plan Proposal Confirmation Banner */}
          {generatedPlan && (
            <div className="my-3 p-4 rounded-2xl bg-indigo-50/80 dark:bg-primary/10 border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-150">
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  Coach Proposed {generatedPlan.proposed_tasks.length} Study Tasks for {generatedPlan.target_role}
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300 truncate mt-0.5">
                  {generatedPlan.proposed_tasks.map((t) => t.title).slice(0, 2).join(" • ")}...
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {planApplied ? (
                  <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Added to My Plan
                  </span>
                ) : (
                  <>
                    <button
                      onClick={() => setGeneratedPlan(null)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={handleApplyPlan}
                      disabled={applyingPlan}
                      className="h-8 px-3.5 rounded-lg bg-primary hover:bg-primary/95 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                    >
                      {applyingPlan ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      <span>Add to My Schedule</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Conversation Stream */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            {loadingHistory ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-6">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-primary/20 text-primary flex items-center justify-center mb-3">
                  <Bot className="w-6 h-6" />
                </div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  How can I help you study today?
                </h2>
                <p className="text-xs text-slate-500 dark:text-outline mt-1 mb-6">
                  Ask for recommendations, breakdown of complex topics, or a structured study plan.
                </p>

                {/* Suggested prompts grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
                  {SUGGESTED_PROMPTS.map((item) => (
                    <button
                      key={item.label}
                      onClick={() => executeSendMessage(item.prompt)}
                      className="p-3 rounded-xl border border-slate-200/80 dark:border-white/10 hover:border-primary hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-xs cursor-pointer group"
                    >
                      <div className="font-semibold text-slate-900 dark:text-white group-hover:text-primary transition-colors">
                        {item.label}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-outline line-clamp-1 mt-0.5">
                        {item.prompt}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isUser = msg.role === "user";
                return (
                  <div
                    key={msg.id || idx}
                    className={`flex items-start gap-3 ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    {!isUser && (
                      <div className="w-7 h-7 rounded-lg bg-primary text-white flex items-center justify-center flex-shrink-0 mt-0.5 shadow-2xs">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}

                    <div
                      className={`max-w-[85%] rounded-2xl p-3.5 sm:p-4 text-xs sm:text-sm leading-relaxed shadow-xs ${
                        isUser
                          ? "bg-primary text-white rounded-br-xs"
                          : "bg-white dark:bg-[#181c22] border border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-slate-100 rounded-bl-xs"
                      }`}
                    >
                      {/* Grounding Status Pill */}
                      {!isUser && (
                        <div className="mb-2">
                          {msg.rag_used && msg.sources && msg.sources.length > 0 && msg.evidence_sufficient !== false ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                              <BookOpen className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span>Document-Grounded Answer ({msg.sources.length} sources)</span>
                            </span>
                          ) : msg.evidence_sufficient === false || msg.grounding_source?.includes("Insufficient Evidence") ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                              <AlertCircle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                              <span>Insufficient Evidence in Uploaded Notes</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-white/10">
                              <Sparkles className="w-3 h-3 text-primary" />
                              <span>General Technical Knowledge</span>
                            </span>
                          )}
                        </div>
                      )}

                      <div className="whitespace-pre-wrap">{msg.content}</div>

                      {/* RAG Source Citations */}
                      {!isUser && msg.sources && msg.sources.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/5 space-y-1.5">
                          <div className="text-[10px] font-semibold text-slate-500 dark:text-outline flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              <FileText className="w-3 h-3 text-primary" />
                              <span>Retrieved Sources ({msg.sources.length}) — Click to inspect excerpt:</span>
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.sources.map((src, sIdx) => (
                              <button
                                key={sIdx}
                                type="button"
                                onClick={() => setSelectedCitation(src)}
                                className="text-[10px] px-2.5 py-1 rounded-lg bg-indigo-50/80 hover:bg-indigo-100 dark:bg-primary/10 dark:hover:bg-primary/20 border border-primary/20 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-all cursor-pointer group text-left"
                              >
                                <span className="font-semibold text-primary group-hover:underline truncate max-w-[140px]">
                                  {src.filename}
                                </span>
                                {src.section && (
                                  <span className="text-[9px] text-slate-400 dark:text-outline truncate max-w-[90px]">
                                    § {src.section}
                                  </span>
                                )}
                                {src.page_number && <span className="text-slate-500 text-[9px]">p.{src.page_number}</span>}
                                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-primary/10 text-primary font-bold">
                                  {Math.round(src.similarity_score * 100)}%
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Agent Action Proposals (Confirmation Flow) */}
                      {!isUser && msg.proposed_actions && msg.proposed_actions.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/10 space-y-2">
                          {msg.proposed_actions.map((proposal) => {
                            const state = actionStates[proposal.id] || proposal.status;
                            const isConfirmed = state === "confirmed";
                            const isConfirming = state === "confirming";
                            const isRejected = state === "rejected";

                            return (
                              <div
                                key={proposal.id}
                                className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-primary/20 space-y-2"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[11px] font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-primary" />
                                    Proposed Action: {proposal.action_type === "create_tasks" ? "Create Study Tasks" : "Reschedule Task"}
                                  </span>
                                  <span
                                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                                      isConfirmed
                                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 font-semibold"
                                        : isRejected
                                        ? "bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-400"
                                        : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 font-semibold"
                                    }`}
                                  >
                                    {isConfirmed ? "Confirmed" : isRejected ? "Dismissed" : "Requires Confirmation"}
                                  </span>
                                </div>

                                <p className="text-xs text-slate-600 dark:text-slate-300">
                                  {proposal.summary}
                                </p>

                                {/* Task preview if create_tasks */}
                                {proposal.action_type === "create_tasks" && Array.isArray(proposal.payload) && (
                                  <div className="space-y-1 bg-white dark:bg-[#12161b] p-2 rounded-lg border border-slate-200/50 dark:border-white/5 text-[11px]">
                                    {proposal.payload.map((t: any, tIdx: number) => (
                                      <div key={tIdx} className="flex items-center justify-between text-slate-700 dark:text-slate-200">
                                        <span className="font-medium truncate mr-2">• {t.title}</span>
                                        <div className="flex items-center gap-1.5 flex-shrink-0 text-[10px] text-slate-400 font-mono">
                                          <span className="px-1.5 py-0.2 rounded bg-primary/10 text-primary font-semibold">{t.priority || "P1"}</span>
                                          <span>{t.duration_minutes || 45}m</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Action Buttons */}
                                {!isConfirmed && !isRejected && (
                                  <div className="flex items-center gap-2 pt-1">
                                    <button
                                      onClick={() => handleConfirmProposal(proposal.id)}
                                      disabled={isConfirming}
                                      className="h-7 px-3 rounded-lg bg-primary hover:bg-primary/95 text-white text-[11px] font-semibold flex items-center gap-1 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                                    >
                                      {isConfirming ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                      <span>Confirm &amp; Add to Schedule</span>
                                    </button>
                                    <button
                                      onClick={() => handleRejectProposal(proposal.id)}
                                      disabled={isConfirming}
                                      className="h-7 px-2.5 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 text-[11px] font-medium cursor-pointer"
                                    >
                                      Dismiss
                                    </button>
                                  </div>
                                )}

                                {isConfirmed && (
                                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 pt-0.5">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Tasks committed to your schedule successfully.</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {!isUser && msg.grounding_source && (
                        <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-white/5 flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-outline font-medium">
                          <Sparkles className="w-3 h-3 text-primary flex-shrink-0" />
                          <span className="truncate">{msg.grounding_source}</span>
                        </div>
                      )}
                    </div>

                    {isUser && (
                      <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {sending && (
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-primary text-white flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white dark:bg-[#181c22] border border-slate-200/80 dark:border-white/10 rounded-2xl p-3.5 text-xs text-slate-500 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  <span>Searching learning documents & generating answer...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggested Prompt Chips (when in chat) */}
          {messages.length > 0 && (
            <div className="flex items-center gap-1.5 py-1.5 overflow-x-auto no-scrollbar flex-shrink-0">
              {SUGGESTED_PROMPTS.map((item) => (
                <button
                  key={item.label}
                  onClick={() => executeSendMessage(item.prompt)}
                  disabled={sending}
                  className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-[11px] whitespace-nowrap transition-colors flex-shrink-0 cursor-pointer font-medium disabled:opacity-50"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {/* Error Banner with Retry */}
          {lastError && (
            <div className="flex items-center justify-between p-2.5 my-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-300 flex-shrink-0 animate-in fade-in duration-150">
              <span className="truncate pr-2">⚠️ {lastError.message}</span>
              <button
                type="button"
                onClick={handleRetryLast}
                disabled={sending}
                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-[11px] flex items-center gap-1 flex-shrink-0 cursor-pointer disabled:opacity-50 transition-colors"
              >
                <RotateCcw className="w-3 h-3" /> Retry
              </button>
            </div>
          )}

          {/* Bottom Bar: Style & Scope Selector + Input */}
          <div className="pt-2 border-t border-slate-200/80 dark:border-white/10 flex-shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-outline font-semibold">
                    Scope:
                  </span>
                  {(["both", "documents", "general"] as const).map((sc) => (
                    <button
                      key={sc}
                      type="button"
                      onClick={() => setKnowledgeScope(sc)}
                      disabled={sending}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                        knowledgeScope === sc
                          ? "bg-indigo-600 text-white shadow-2xs"
                          : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10"
                      }`}
                    >
                      {sc === "both" ? "📚 Docs + AI" : sc === "documents" ? "📄 Docs Only" : "🌐 AI Only"}
                    </button>
                  ))}
                </div>

                <div className="h-3 w-px bg-slate-200 dark:bg-white/10 hidden sm:block" />

                <div className="flex items-center gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-outline font-semibold">
                    Mode:
                  </span>
                  {(["balanced", "step_by_step", "concise"] as const).map((pref) => (
                    <button
                      key={pref}
                      type="button"
                      onClick={() => setResponsePreference(pref)}
                      disabled={sending}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                        responsePreference === pref
                          ? "bg-primary text-white shadow-2xs"
                          : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10"
                      }`}
                    >
                      {pref === "balanced" ? "Balanced" : pref === "step_by_step" ? "Step-by-Step" : "Concise"}
                    </button>
                  ))}
                </div>
              </div>

              {activeConversationId && (
                <span className="text-[10px] text-slate-400 dark:text-outline font-mono">
                  Session #{activeConversationId}
                </span>
              )}
            </div>

            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
              <input
                type="text"
                value={inputMsg}
                onChange={(e) => setInputMsg(e.target.value)}
                placeholder="Ask your coach anything (e.g. 'Explain RAG vs Fine-tuning')..."
                disabled={sending}
                className="flex-1 h-11 px-4 rounded-xl bg-slate-50 dark:bg-surface-container-low border border-slate-200 dark:border-white/10 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary focus:bg-white dark:focus:bg-[#181c22] transition-all disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!inputMsg.trim() || sending}
                className="h-11 px-4 rounded-xl bg-primary hover:bg-primary/95 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer flex-shrink-0"
              >
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Send</span>
              </button>
            </form>
          </div>
        </main>
      </div>

      {/* Citation Preview Modal */}
      {selectedCitation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#181c22] border border-slate-200 dark:border-white/10 p-5 sm:p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-white/5 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[320px]">
                    {selectedCitation.filename}
                  </h3>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                    {selectedCitation.chunk_id && <span>Chunk #{selectedCitation.chunk_id}</span>}
                    {selectedCitation.page_number && <span>• Page {selectedCitation.page_number}</span>}
                    <span>• {Math.round(selectedCitation.similarity_score * 100)}% Match</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCitation(null)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Section heading if available */}
            {selectedCitation.section && (
              <div className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <span className="font-semibold text-primary">Section:</span>
                <span className="truncate">{selectedCitation.section}</span>
              </div>
            )}

            {/* Snippet Quote Callout */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-outline uppercase tracking-wider">
                Supporting Evidence Excerpt
              </span>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#12161b] border border-slate-200/80 dark:border-white/5 text-xs leading-relaxed text-slate-800 dark:text-slate-200 font-mono whitespace-pre-wrap max-h-56 overflow-y-auto">
                &ldquo;{selectedCitation.snippet}&rdquo;
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5">
              <Link
                href="/resources"
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                onClick={() => setSelectedCitation(null)}
              >
                <span>View Full Document in Resources</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <button
                type="button"
                onClick={() => setSelectedCitation(null)}
                className="h-8 px-4 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AICoachPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <CoachChat />
    </Suspense>
  );
}
