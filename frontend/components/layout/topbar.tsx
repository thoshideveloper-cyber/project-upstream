"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Search, X } from "lucide-react";

import { AccountMenu, NavLinks, RailSearch } from "@/components/layout/sidebar";
import { UpstreamLogo } from "@/components/brand/logo";
import { useAuth } from "@/hooks/use-auth";
import { OPEN_EVENT } from "@/components/features/command-palette";

/**
 * The small-screen bar. On desktop the navigation rail carries search and the account;
 * below `md` the rail is a drawer, so this bar holds the three things a phone needs:
 * open the menu, go home, search.
 */
export function Topbar() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Navigating closes the drawer, whatever triggered the navigation.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
  }, [pathname]);

  // Escape closes the drawer.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  if (!user) return null;

  return (
    <header className="flex h-12 shrink-0 items-center gap-1 border-b border-border bg-background px-2 md:hidden">
      <button
        onClick={() => setMobileOpen(true)}
        className="grid size-9 place-items-center rounded-md text-foreground hover:bg-accent"
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </button>
      <Link href="/dashboard" className="px-1 text-foreground" aria-label="Upstream — home">
        <UpstreamLogo markSize={20} />
      </Link>
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent(OPEN_EVENT))}
        className="ml-auto grid size-9 place-items-center rounded-md text-foreground hover:bg-accent"
        aria-label="Open command palette"
      >
        <Search className="size-4.5" />
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div
            className="absolute inset-0 bg-[oklch(0.18_0.01_265/0.4)]"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="app-rail absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col bg-sidebar text-sidebar-foreground shadow-lg">
            <div className="flex h-12 items-center justify-between px-3">
              <UpstreamLogo markSize={20} className="text-sidebar-foreground" />
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="grid size-8 place-items-center rounded-md text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <X className="size-4.5" />
              </button>
            </div>
            <div className="px-3 pb-3">
              <RailSearch onOpen={() => setMobileOpen(false)} />
            </div>
            <NavLinks onNavigate={() => setMobileOpen(false)} />
            <div className="border-t border-sidebar-border p-2">
              <AccountMenu />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
