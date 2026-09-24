"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    // The initial theme is selected by the pre-hydration script in layout.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(current);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    localStorage.setItem("openreply-theme", next);
    setTheme(next);
  }

  const dark = theme === "dark";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      onClick={toggle}
      className="flex w-full items-center justify-between rounded border border-border bg-surface px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-surface-hover"
    >
      <span className="flex items-center gap-2">
        {dark ? <Moon aria-hidden="true" className="h-4 w-4" /> : <Sun aria-hidden="true" className="h-4 w-4" />}
        {dark ? "暗色模式" : "亮色模式"}
      </span>
      <span className="text-xs text-muted">{dark ? "已開啟" : "已關閉"}</span>
    </button>
  );
}
