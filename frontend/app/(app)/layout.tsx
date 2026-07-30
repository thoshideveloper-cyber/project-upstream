"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/features/command-palette";
import { ConfirmProvider } from "@/components/features/confirm-dialog";
import { useAuth } from "@/hooks/use-auth";

/**
 * Authenticated app shell: persistent sidebar + top bar.
 *
 * Behaviour:
 *   - Loading: render a full-screen spinner while /auth/me is in-flight.
 *   - 401 / no session: apiFetch redirects to /login immediately; render null.
 *   - Authenticated: render the shell with sidebar + topbar.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="border-primary size-8 animate-spin rounded-full border-4 border-t-transparent" />
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
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          {/* Scroll + padding live on template.tsx so each route gets an entrance
              animation without a wrapping box breaking the grid's full-height layout. */}
          <main className="min-h-0 flex-1">{children}</main>
        </div>
        {/* Global ⌘K command palette — jump-to + quick actions. */}
        <CommandPalette />
      </div>
    </ConfirmProvider>
  );
}
