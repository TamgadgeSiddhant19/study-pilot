"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const v2Init = localStorage.getItem("studypilot-theme-v2");
    if (!v2Init) {
      // Force initial reset to clean light theme matching user request
      localStorage.setItem("studypilot-theme-v2", "true");
      localStorage.setItem("studypilot-theme", "light");
      setThemeState("light");
      document.documentElement.classList.remove("dark");
      return;
    }

    const saved = localStorage.getItem("studypilot-theme") as Theme | null;
    if (saved === "dark") {
      setThemeState("dark");
      document.documentElement.classList.add("dark");
    } else {
      setThemeState("light");
      document.documentElement.classList.remove("dark");
      localStorage.setItem("studypilot-theme", "light");
    }
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem("studypilot-theme", t);
    document.documentElement.classList.toggle("dark", t === "dark");
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
