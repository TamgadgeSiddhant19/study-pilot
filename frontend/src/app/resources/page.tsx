"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import {
  BookMarked,
  Plus,
  ExternalLink,
  Star,
  Trash2,
  Bookmark,
  FileText,
  Search,
  Filter,
  X,
  Sparkles,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Bot,
  FileCode,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  getResources,
  createResource,
  updateResource,
  deleteResource,
  LearningResource,
  getDocuments,
  uploadDocument,
  deleteDocument,
  reprocessDocument,
  DocumentItem,
} from "@/lib/api";

export default function ResourcesPage() {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<"documents" | "links">("documents");

  // RAG Documents State
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [reprocessingId, setReprocessingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Link Bookmarks State
  const [resources, setResources] = useState<LearningResource[]>([]);
  const [category, setCategory] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [isLoadingLinks, setIsLoadingLinks] = useState(true);

  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [cat, setCat] = useState<"documentation" | "paper" | "course" | "book" | "article" | "video">("documentation");
  const [subject, setSubject] = useState("AI Systems");

  const loadDocs = async () => {
    try {
      setLoadingDocs(true);
      const res = await getDocuments();
      setDocuments(res.documents);
    } catch (err) {
      console.error("Failed to load documents:", err);
    } finally {
      setLoadingDocs(false);
    }
  };

  const loadLinks = async () => {
    try {
      setIsLoadingLinks(true);
      const data = await getResources(category || undefined);
      setResources(data);
    } catch (err) {
      console.error("Failed to load resources:", err);
    } finally {
      setIsLoadingLinks(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setDocuments([]);
      setResources([]);
      setLoadingDocs(false);
      setIsLoadingLinks(false);
      return;
    }
    loadDocs();
    loadLinks();

    const handleRefresh = () => {
      loadDocs();
      loadLinks();
    };
    window.addEventListener("studypilot-data-changed", handleRefresh);
    window.addEventListener("studypilot-user-changed", handleRefresh);
    return () => {
      window.removeEventListener("studypilot-data-changed", handleRefresh);
      window.removeEventListener("studypilot-user-changed", handleRefresh);
    };
  }, [category, authLoading, user?.id]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    setUploading(true);
    setUploadError(null);

    try {
      await uploadDocument(file);
      await loadDocs();
    } catch (err: any) {
      setUploadError(err.message || "Failed to upload document.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteDoc = async (id: number, name: string) => {
    if (!window.confirm(`Delete "${name}" and its indexed vector embeddings?`)) return;
    try {
      await deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (err: any) {
      alert(err.message || "Failed to delete document.");
    }
  };

  const handleReprocessDoc = async (id: number) => {
    setReprocessingId(id);
    try {
      await reprocessDocument(id);
      await loadDocs();
    } catch (err: any) {
      alert(err.message || "Failed to reprocess document.");
    } finally {
      setReprocessingId(null);
    }
  };

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !url) return;
    try {
      await createResource({ title, url, category: cat, subject, rating: 5, status: "bookmarked" });
      setShowAdd(false);
      setTitle("");
      setUrl("");
      await loadLinks();
    } catch (err) {
      console.error(err);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filteredLinks = resources.filter((r) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      r.title.toLowerCase().includes(q) ||
      r.subject?.toLowerCase().includes(q) ||
      r.category?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-background font-body text-on-surface antialiased">
      <AppSidebar />
      <AppHeader />

      <main className="lg:pl-64 pl-0 pt-16 min-h-screen">
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
          {/* Top Navigation Switcher */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-white/10">
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => setActiveTab("documents")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "documents"
                    ? "bg-primary text-white shadow-2xs"
                    : "bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>My Learning Documents (RAG)</span>
                {documents.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
                    {documents.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("links")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "links"
                    ? "bg-primary text-white shadow-2xs"
                    : "bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300"
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>Web Bookmarks</span>
              </button>
            </div>

            {activeTab === "links" && (
              <button
                onClick={() => setShowAdd(true)}
                className="h-8 px-3 rounded-lg bg-primary text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer hover:bg-primary/95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Save Link</span>
              </button>
            )}
          </div>

          {/* ========================================================= */}
          {/* TAB 1: RAG DOCUMENTS                                      */}
          {/* ========================================================= */}
          {activeTab === "documents" && (
            <div className="space-y-6">
              {/* Header Box */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-indigo-50/60 dark:bg-primary/10 border border-primary/20">
                <div className="space-y-1">
                  <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileCode className="w-5 h-5 text-primary" />
                    RAG Knowledge Base
                  </h1>
                  <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xl">
                    Upload your lecture notes, interview guides, and technical cheat-sheets.
                    Text is automatically chunked, embedded with Google Gemini, and indexed into pgvector so your AI Study Coach can ground answers in your real documents.
                  </p>
                </div>

                <div className="flex-shrink-0">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.md,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="h-10 px-4 rounded-xl bg-primary hover:bg-primary/95 text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Indexing Vectors...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        <span>Upload Learning Document</span>
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-slate-500 text-center mt-1">PDF, Markdown, or TXT (Max 15MB)</p>
                </div>
              </div>

              {/* Upload Error Banner */}
              {uploadError && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                  <button onClick={() => setUploadError(null)} className="p-1 hover:opacity-75">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Documents List */}
              {loadingDocs ? (
                <div className="py-20 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span>Loading your knowledge base...</span>
                </div>
              ) : documents.length === 0 ? (
                <div className="py-16 text-center border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl p-8 max-w-lg mx-auto">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-primary/20 text-primary flex items-center justify-center mx-auto mb-3">
                    <Upload className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                    No documents indexed yet
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Upload your first PDF or Markdown study notes to enable semantic search and document-grounded AI coaching.
                  </p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 px-3.5 rounded-lg bg-primary text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> Upload Now
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {documents.map((doc) => {
                    const isReady = doc.processing_status === "ready";
                    const isFailed = doc.processing_status === "failed";
                    const isProcessing = doc.processing_status === "processing" || reprocessingId === doc.id;

                    return (
                      <div
                        key={doc.id}
                        className="p-4 rounded-xl bg-white dark:bg-[#181c22] border border-slate-200/80 dark:border-white/10 flex flex-col justify-between gap-3 shadow-xs hover:border-primary/40 transition-all"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 font-mono">
                              {doc.filename.endsWith(".pdf") ? "PDF" : doc.filename.endsWith(".md") ? "Markdown" : "Text"}
                            </span>

                            {isReady && (
                              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{doc.chunk_count} Chunks Indexed</span>
                              </span>
                            )}
                            {isProcessing && (
                              <span className="text-[11px] font-semibold text-blue-600 flex items-center gap-1">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Indexing...</span>
                              </span>
                            )}
                            {isFailed && (
                              <span className="text-[11px] font-semibold text-rose-600 flex items-center gap-1" title={doc.error_message || "Failed"}>
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>Extraction Failed</span>
                              </span>
                            )}
                          </div>

                          <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate" title={doc.filename}>
                            {doc.filename}
                          </h3>

                          <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-outline font-mono">
                            <span>{formatFileSize(doc.file_size_bytes)}</span>
                            <span>•</span>
                            <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                          </div>

                          {isFailed && doc.error_message && (
                            <p className="text-[11px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 p-2 rounded-lg mt-1 line-clamp-2">
                              {doc.error_message}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-white/5 text-xs">
                          <Link
                            href={`/coach?prompt=Summarize the key takeaways from ${doc.filename}&scope=documents`}
                            className="text-primary hover:underline font-semibold flex items-center gap-1 text-[11px]"
                          >
                            <Bot className="w-3 h-3" />
                            <span>Ask Coach</span>
                          </Link>

                          <div className="flex items-center gap-2">
                            {isFailed && (
                              <button
                                onClick={() => handleReprocessDoc(doc.id)}
                                disabled={isProcessing}
                                className="p-1 rounded text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                                title="Retry Processing"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteDoc(doc.id, doc.filename)}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                              title="Delete Document"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: WEB BOOKMARKS                                      */}
          {/* ========================================================= */}
          {activeTab === "links" && (
            <div className="space-y-6">
              {/* Search & Category Filter Pills */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search bookmarks by title or topic..."
                    className="w-full h-8 pl-9 pr-3 rounded-lg bg-white dark:bg-[#181c22] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto text-xs">
                  {["", "paper", "documentation", "course", "book"].map((c) => (
                    <button
                      key={c}
                      onClick={() => setCategory(c)}
                      className={`px-3 py-1 rounded-lg text-xs capitalize transition-colors cursor-pointer ${
                        category === c
                          ? "bg-primary text-white font-semibold shadow-2xs"
                          : "bg-white dark:bg-[#181c22] border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      {c || "All Categories"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resource Grid */}
              {isLoadingLinks ? (
                <div className="py-16 text-center text-slate-400 font-mono text-xs">
                  Loading bookmarks...
                </div>
              ) : filteredLinks.length === 0 ? (
                <div className="py-16 text-center text-slate-400 font-mono text-xs">
                  No matching bookmarks found. Click "Save Link" to add one!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredLinks.map((res) => (
                    <div
                      key={res.id}
                      className="p-5 rounded-xl bg-white dark:bg-[#181c22] border border-slate-200/80 dark:border-white/10 flex flex-col justify-between gap-4 hover:border-primary/40 transition-all shadow-xs group"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-primary text-[10px] uppercase font-semibold">
                            {res.category}
                          </span>
                          <div className="flex items-center gap-1 text-amber-500">
                            <Star className="w-3.5 h-3.5 fill-current" />
                            <span className="font-mono text-xs">{res.rating}/5</span>
                          </div>
                        </div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-primary transition-colors leading-snug">
                          {res.title}
                        </h3>
                        <p className="text-xs text-slate-500">
                          Domain: <strong className="font-medium text-slate-700 dark:text-slate-300">{res.subject}</strong>
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-white/5">
                        <span className="text-[10px] text-slate-400 uppercase font-mono">{res.status}</span>
                        <a
                          href={res.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1 transition-colors"
                        >
                          <span>Open Link</span>
                          <ExternalLink className="w-3 h-3 text-primary" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Save Resource Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#181c22] border border-slate-200/80 dark:border-white/10 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-primary" />
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">Save Knowledge Resource</h3>
              </div>
              <button
                onClick={() => setShowAdd(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLink} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Resource Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Attention Is All You Need"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Target URL</label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://arxiv.org/abs/1706.03762"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Category</label>
                  <select
                    value={cat}
                    onChange={(e) => setCat(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="documentation">Documentation</option>
                    <option value="paper">ArXiv / Paper</option>
                    <option value="course">Course</option>
                    <option value="book">Book</option>
                    <option value="article">Article / Guide</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Subject</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. GenAI, System Design"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/95 transition-all shadow-sm cursor-pointer"
                >
                  Save to Vault
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
