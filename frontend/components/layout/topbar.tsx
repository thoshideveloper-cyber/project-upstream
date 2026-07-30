"use client";

import { useState } from "react";
import { ChevronDown, LogOut, Menu, Search, UserRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { NavLinks } from "@/components/layout/sidebar";
import { UpstreamLogo } from "@/components/brand/logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { OPEN_EVENT } from "@/components/features/command-palette";

const ROLE_LABEL: Record<string, string> = {
  ANALYST: "Analyst",
  PARTNER: "Partner",
};

export function Topbar() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    try {
      await api.post("/auth/logout");
    } catch {
      // even if the call fails, drop local state and bounce to login
    }
    queryClient.clear();
    router.push("/login");
  }

  if (!user) return null;

  return (
    <header
      className="flex h-14 shrink-0 items-center justify-between border-b px-4 md:px-6"
      style={{
        background: "var(--background)",
        borderColor: "var(--border)",
        boxShadow: "0 1px 0 oklch(0.72 0.16 58 / 0.06)",
      }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <button
          onClick={() => setMobileOpen(true)}
          className="-ml-1 rounded-md p-1.5 text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground md:hidden"
          aria-label="Open navigation"
        >
          <Menu className="size-5" />
        </button>
        <span className="truncate text-sm font-medium">{user.firm.name}</span>

        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent(OPEN_EVENT))}
          className="ml-1 flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
          style={{ borderColor: "var(--border)" }}
          aria-label="Open command palette"
        >
          <Search className="size-3.5" />
          <span className="hidden text-xs sm:inline">Search…</span>
          <kbd className="hidden items-center gap-0.5 rounded border bg-muted px-1 py-0.5 font-sans text-[10px] leading-none sm:inline-flex">
            <span className="text-[11px]">⌘</span>K
          </kbd>
        </button>
      </div>

      {/* Mobile navigation drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div
            className="bg-sidebar text-sidebar-foreground absolute left-0 top-0 flex h-full w-64 flex-col border-r shadow-xl"
            style={{ borderColor: "var(--sidebar-border)" }}
          >
            <div className="flex h-14 items-center justify-between border-b px-4" style={{ borderColor: "var(--sidebar-border)" }}>
              <UpstreamLogo />
              <button onClick={() => setMobileOpen(false)} aria-label="Close navigation" className="text-muted-foreground hover:text-foreground">
                <X className="size-5" />
              </button>
            </div>
            <NavLinks onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex items-center gap-1">
        <ThemeToggle />

        <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="gap-2" />}>
          <span className="bg-primary/10 flex size-7 items-center justify-center rounded-full">
            <UserRound className="text-primary-ink size-4" />
          </span>
          <span className="hidden text-sm sm:inline">{user.full_name}</span>
          <span className="bg-primary/10 text-primary-ink rounded px-1.5 py-0.5 text-xs font-medium">
            {ROLE_LABEL[user.role] ?? user.role}
          </span>
          <ChevronDown className="text-muted-foreground size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="truncate font-normal">{user.email}</DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} variant="destructive">
            <LogOut className="size-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
