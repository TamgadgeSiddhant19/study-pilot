"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

interface LayoutContextType {
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
  toggleMobileSidebar: () => void;
  quickTaskModalOpen: boolean;
  setQuickTaskModalOpen: (open: boolean) => void;
  openQuickTask: () => void;
  closeQuickTask: () => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [quickTaskModalOpen, setQuickTaskModalOpen] = useState(false);

  const toggleMobileSidebar = useCallback(() => {
    setMobileSidebarOpen((prev) => !prev);
  }, []);

  const openQuickTask = useCallback(() => {
    setQuickTaskModalOpen(true);
  }, []);

  const closeQuickTask = useCallback(() => {
    setQuickTaskModalOpen(false);
  }, []);

  return (
    <LayoutContext.Provider
      value={{
        mobileSidebarOpen,
        setMobileSidebarOpen,
        toggleMobileSidebar,
        quickTaskModalOpen,
        setQuickTaskModalOpen,
        openQuickTask,
        closeQuickTask,
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error("useLayout must be used within a LayoutProvider");
  }
  return context;
}
