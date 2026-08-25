"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setDark(document.documentElement.classList.contains("dark")));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function toggleTheme() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.style.colorScheme = next ? "dark" : "light";
    localStorage.setItem("sellpilot-theme", next ? "dark" : "light");
    setDark(next);
  }

  return (
    <button type="button" onClick={toggleTheme} className="theme-toggle" aria-label={`Switch to ${dark ? "light" : "dark"} mode`} title={`Switch to ${dark ? "light" : "dark"} mode`}>
      <span className="theme-toggle-icon">{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</span>
      {!compact && <span>{dark ? "Light" : "Dark"}</span>}
    </button>
  );
}
