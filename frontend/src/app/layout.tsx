import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { LayoutProvider } from "@/context/LayoutContext";
import { FocusTimerProvider } from "@/context/FocusTimerContext";
import { QuickTaskModal } from "@/components/layout/QuickTaskModal";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StudyPilot — Study Planner & Interview Preparation",
  description: "Simple, powerful study planner, coding interview tracker, and AI study coach for students and professionals.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const saved = localStorage.getItem('studypilot-theme');
                if (saved === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                  localStorage.setItem('studypilot-theme', 'light');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="antialiased min-h-screen bg-background text-on-surface transition-colors duration-150">
        <ThemeProvider>
          <AuthProvider>
            <FocusTimerProvider>
              <LayoutProvider>
                {children}
                <QuickTaskModal />
              </LayoutProvider>
            </FocusTimerProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
