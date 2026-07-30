"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/theme";
import { cn } from "@/lib/utils";

/**
 * Nav theme toggle. Persists via the localStorage-backed store in components/theme
 * (survives reloads + syncs across tabs). Mounted-guarded so the icon never
 * mismatches the pre-paint init script during hydration.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";
  const next = isDark ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className={cn(
        "relative inline-flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground",
        "transition-colors hover:border-primary/40 hover:text-foreground",
        className,
      )}
    >
      {/* Render a stable box until mounted; then the current-theme glyph. */}
      {mounted &&
        (isDark ? (
          <Moon className="size-4.5" aria-hidden />
        ) : (
          <Sun className="size-4.5" aria-hidden />
        ))}
    </button>
  );
}
