"use client";

import { useSyncExternalStore } from "react";

/**
 * Minimal class-based theme store (drop-in for the parts of next-themes we used).
 *
 * Why not next-themes: its <ThemeProvider> renders the theme-init <script> inside
 * the React tree, which React 19.2 flags in dev ("Encountered a script tag while
 * rendering React component"). Here the init script is server-rendered from the
 * root layout <head> (see THEME_INIT_SCRIPT), and this module is just a
 * localStorage-backed store — no provider, no script in the tree.
 *
 * Storage key and values ("theme" = "dark" | "light") match what next-themes
 * wrote, so existing users keep their choice.
 */

export type Theme = "dark" | "light";

const STORAGE_KEY = "theme";

/** Inline in the root layout <head> so the class lands before first paint. */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  STORAGE_KEY,
)});var d=t!=="light";var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light"}catch(e){document.documentElement.classList.add("dark")}})()`;

const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  // Cross-tab sync: another tab switching theme fires "storage" here.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      applyTheme(getSnapshot());
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function applyTheme(t: Theme) {
  // Suppress transitions for the swap so the whole page flips at once.
  const css = document.createElement("style");
  css.textContent = "*,*::before,*::after{transition:none!important}";
  document.head.appendChild(css);
  const root = document.documentElement;
  root.classList.toggle("dark", t === "dark");
  root.style.colorScheme = t;
  void getComputedStyle(document.body).transition; // flush before re-enabling
  setTimeout(() => css.remove(), 1);
}

function setTheme(t: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, t);
  } catch {}
  applyTheme(t);
  for (const l of listeners) l();
}

export function useTheme(): { theme: Theme; resolvedTheme: Theme; setTheme: (t: Theme) => void } {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => "dark" as Theme);
  return { theme, resolvedTheme: theme, setTheme };
}
