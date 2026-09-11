"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/features/command-palette";
import { ConfirmProvider } from "@/components/features/confirm-dialog";
import { useAuth } from "@/hooks/use-auth";

/**
 * Authenticated app shell: the navigation rail + the page.
 *
 * Behaviour:
 *   - Loading: render the shell's silhouette while /auth/me is in flight, so the frame
 *     does not jump from a spinner to a sidebar on every hard reload.
 *   - 401 / no session: apiFetch redirects to /login immediately; render null.
 *   - Authenticated: render the rail, the (mobile-only) top bar and the page.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-dvh overflow-hidden" aria-busy="true" aria-label="Loading Upstream">
        <div className="hidden w-[248px] shrink-0 bg-sidebar md:block" />
        <div className="flex-1 space-y-4 px-8 py-6">
          <div className="h-3 w-32 animate-pulse rounded bg-ink-100" />
          <div className="h-6 w-64 animate-pulse rounded bg-ink-100" />
          <div className="h-72 animate-pulse rounded-lg bg-ink-100 ring-1 ring-border" />
        </div>
      </div>
    );
  }

  if (!user) {
    // apiFetch already called window.location.href = "/login"; render nothing while navigating.
    return null;
  }

  return (
    // ConfirmProvider wraps the shell so any route can `await confirm(...)`
    // before a destructive action (replaces window.confirm).
    <ConfirmProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-foreground focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-background"
      >
        Skip to content
      </a>
      <div className="flex h-dvh overflow-hidden bg-background">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          {/* Scroll + padding live on template.tsx so each route gets its frame without a
              wrapping box breaking the grid's full-height layout. */}
          <main className="min-h-0 flex-1">{children}</main>
        </div>
        {/* Global ⌘K command palette — jump-to + quick actions. */}
        <CommandPalette />
      </div>
    </ConfirmProvider>
  );
}
