"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  ChevronsUpDown,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
} from "lucide-react";

import { activeNavHref, visibleNav, visibleNavSections } from "@/components/layout/nav";
import { UpstreamMark } from "@/components/brand/logo";
import { OPEN_EVENT } from "@/components/features/command-palette";
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
import { useProjects } from "@/hooks/use-projects";
import { api } from "@/lib/api";
import { initials } from "@/lib/format";
import { recentProjects } from "@/lib/recent-projects";
import { cn } from "@/lib/utils";

/**
 * The navigation rail.
 *
 * The one dark surface in the product, on purpose: it is the frame, and the frame
 * should never be mistaken for the work. Everything global lives here — where you are,
 * search, the project you are in, and who you are signed in as (the role stays on
 * screen because it decides which numbers a person is seeing). Page-level context —
 * breadcrumbs, titles, actions — belongs to the page.
 */

/** How many projects the rail lists before it defers to "All projects". */
const PROJECT_LIMIT = 7;

/** Above this many, the rail offers a filter rather than a longer list. */
const SEARCH_AT = 6;

const ROLE_LABEL: Record<string, string> = {
  ANALYST: "Analyst",
  PARTNER: "Partner",
};

/** Active nav item ground — one step lighter than hover, so "here" beats "under the pointer". */
const ACTIVE_GROUND = "bg-[oklch(0.29_0.008_265)]";

/* ── Persisted UI state ─────────────────────────────────────────────────────── */

/**
 * A boolean or set remembered per browser, hydration-safe: the first render uses the
 * default so server and client markup agree, then a mount effect restores what was
 * saved. Reading localStorage during render would mismatch on every reload.
 */
function useExpanded(): [Set<string>, (key: string) => void] {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(["/projects"]));

  useEffect(() => {
    try {
      const raw = localStorage.getItem("upstream-nav-expanded");
      if (!raw) return;
      const saved: unknown = JSON.parse(raw);
      if (!Array.isArray(saved)) return;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExpanded(new Set(saved as string[]));
    } catch {
      /* keep defaults */
    }
  }, []);

  const toggle = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        localStorage.setItem("upstream-nav-expanded", JSON.stringify([...next]));
      } catch {
        /* ignore quota / private-mode errors */
      }
      return next;
    });
  }, []);

  return [expanded, toggle];
}

function useRailCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(localStorage.getItem("upstream-rail-collapsed") === "1");
    } catch {
      /* keep default */
    }
  }, []);
  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem("upstream-rail-collapsed", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);
  return [collapsed, toggle];
}

/** "⌘" on a Mac, "Ctrl" elsewhere — resolved after mount so SSR markup stays stable. */
export function useModKey(): string {
  const [mod, setMod] = useState("Ctrl");
  useEffect(() => {
    const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (mac) setMod("⌘");
  }, []);
  return mod;
}

/* ── Keyboard: "g" then a letter ───────────────────────────────────────────── */

/**
 * Go-to chords, the Linear/Gmail idiom: press `g`, then the item's letter within a
 * second. Never fires while typing, or inside a dialog or menu, so it cannot steal a
 * keystroke from a field — and `[` folds the rail.
 */
function useNavChords(onToggleRail: () => void) {
  const router = useRouter();
  const { user } = useAuth();
  const pending = useRef<number | null>(null);

  useEffect(() => {
    const items = visibleNav(user?.role ?? "ANALYST").filter((i) => i.chord);
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (
        t instanceof HTMLElement &&
        (t.isContentEditable ||
          t.closest('input, textarea, select, [role="dialog"], [role="menu"], [role="listbox"]'))
      ) {
        return;
      }
      if (pending.current !== null) {
        const hit = items.find((i) => i.chord === e.key.toLowerCase());
        window.clearTimeout(pending.current);
        pending.current = null;
        if (hit) {
          e.preventDefault();
          router.push(hit.href);
        }
        return;
      }
      if (e.key === "g") {
        pending.current = window.setTimeout(() => {
          pending.current = null;
        }, 1000);
        return;
      }
      if (e.key === "[") {
        e.preventDefault();
        onToggleRail();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, user?.role, onToggleRail]);
}

/* ── The links ─────────────────────────────────────────────────────────────── */

/** Shared nav list — the desktop rail and the mobile drawer both render it. */
export function NavLinks({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const { user } = useAuth();
  const role = user?.role ?? "ANALYST";
  const sections = visibleNavSections(role);
  const activeHref = activeNavHref(pathname, visibleNav(role));
  const [expanded, toggleExpanded] = useExpanded();

  // Fetched here rather than declared in nav.ts, which stays a static declaration the
  // command palette can read during render.
  const { data: projects } = useProjects(false);
  const [projectQuery, setProjectQuery] = useState("");

  // Read once after mount rather than during render: localStorage during render is a
  // hydration mismatch, and recency only has to be right after the first paint.
  const [recent, setRecent] = useState<number[]>([]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecent(recentProjects());
  }, [pathname]);

  type NavChild = { label: string; href: string; overdue: number; active: boolean };

  /**
   * The project list, ordered by what this person is doing: the open project first,
   * then the ones they have visited, then everything else by attention. Ranking the
   * whole list by overdue count put a dormant imported book above the two projects they
   * live in, and turned a way of getting somewhere into a leaderboard of problems.
   */
  const projectChildren = useMemo((): NavChild[] => {
    const items = projects?.items ?? [];
    const q = projectQuery.trim().toLowerCase();
    const matching = q
      ? items.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.client_name ?? "").toLowerCase().includes(q),
        )
      : items;

    const rank = (id: number) => {
      if (pathname.startsWith(`/projects/${id}`)) return -1;
      const i = recent.indexOf(id);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };

    return [...matching]
      .sort(
        (a, b) =>
          rank(a.id) - rank(b.id) ||
          (b.overdue_count ?? 0) - (a.overdue_count ?? 0) ||
          a.name.localeCompare(b.name),
      )
      .slice(0, q ? 20 : PROJECT_LIMIT)
      .map((p) => ({
        label: p.name,
        href: `/projects/${p.id}`,
        overdue: p.overdue_count ?? 0,
        active: pathname.startsWith(`/projects/${p.id}`),
      }));
  }, [projects, projectQuery, recent, pathname]);

  const totalProjects = projects?.items.length ?? 0;

  return (
    <nav aria-label="Main" className="flex-1 overflow-y-auto overscroll-contain px-2 pb-3">
      {sections.map((section, i) => (
        <div key={section.label ?? i} className={cn(i > 0 && "mt-4")}>
          {section.label &&
            (collapsed ? (
              <div className="mx-2 mb-2 h-px bg-sidebar-border" aria-hidden />
            ) : (
              <p className="px-2.5 pb-1 text-[11px] font-medium text-[oklch(0.62_0.009_265)]">
                {section.label}
              </p>
            ))}
          <ul className="space-y-px">
            {section.items.map((item) => {
              const active = activeHref === item.href;
              const Icon = item.icon;
              const isExpandable = !!item.expandable && !collapsed;
              const isOpen = expanded.has(item.href);
              const showProjects = isExpandable && isOpen;

              return (
                <li key={item.href}>
                  <div className="group/row flex items-center">
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      title={
                        collapsed
                          ? item.label
                          : item.chord
                            ? `${item.label} — press G then ${item.chord.toUpperCase()}`
                            : undefined
                      }
                      className={cn(
                        "nav-item flex h-8 min-w-0 flex-1 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors",
                        collapsed && "justify-center px-0",
                        active
                          ? cn(ACTIVE_GROUND, "font-medium text-sidebar-accent-foreground")
                          : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground",
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-4 shrink-0",
                          active ? "text-sidebar-foreground" : "opacity-90",
                        )}
                        strokeWidth={1.75}
                        aria-hidden
                      />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>

                    {isExpandable && (
                      <button
                        type="button"
                        onClick={() => toggleExpanded(item.href)}
                        aria-expanded={isOpen}
                        aria-label={`${isOpen ? "Collapse" : "Expand"} ${item.label}`}
                        className="ml-0.5 grid size-7 shrink-0 place-items-center rounded-md text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      >
                        <ChevronRight
                          className={cn("size-3.5 transition-transform duration-150", isOpen && "rotate-90")}
                          aria-hidden
                        />
                      </button>
                    )}
                  </div>

                  {showProjects && (
                    <div className="ml-[18px] mt-0.5 border-l border-sidebar-border pl-2">
                      {totalProjects > SEARCH_AT && (
                        <div className="relative mb-1 mt-0.5">
                          <Search
                            className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-sidebar-muted"
                            aria-hidden
                          />
                          <input
                            type="search"
                            value={projectQuery}
                            onChange={(e) => setProjectQuery(e.target.value)}
                            placeholder={`Find in ${totalProjects}`}
                            aria-label="Find a project"
                            className="h-7 w-full rounded-md bg-sidebar-accent pl-6 pr-2 text-xs text-sidebar-foreground outline-none ring-1 ring-inset ring-sidebar-border placeholder:text-sidebar-muted focus-visible:ring-sidebar-ring"
                          />
                        </div>
                      )}

                      <ul className="space-y-px">
                        {projectChildren.map((child) => (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              onClick={onNavigate}
                              aria-current={child.active ? "page" : undefined}
                              title={
                                child.overdue > 0
                                  ? `${child.overdue} overdue follow-${child.overdue === 1 ? "up" : "ups"}`
                                  : child.label
                              }
                              className={cn(
                                "flex h-7 items-center gap-2 rounded-md px-2 text-[12.5px] transition-colors",
                                child.active
                                  ? cn(ACTIVE_GROUND, "font-medium text-sidebar-foreground")
                                  : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground",
                              )}
                            >
                              <span className="min-w-0 flex-1 truncate">{child.label}</span>
                              {/* A dot, not a number: the rail says "something in there is
                                  late"; the magnitude lives on the projects list, where
                                  projects can actually be compared. */}
                              {child.overdue > 0 && (
                                <span
                                  className="size-1.5 shrink-0 rounded-full bg-danger"
                                  aria-label={`${child.overdue} overdue`}
                                />
                              )}
                            </Link>
                          </li>
                        ))}

                        {projectChildren.length === 0 && (
                          <li className="px-2 py-1 text-xs text-sidebar-muted">
                            {totalProjects === 0 ? "No projects yet." : "No project matches."}
                          </li>
                        )}

                        {!projectQuery && totalProjects > PROJECT_LIMIT && (
                          <li>
                            <Link
                              href="/projects"
                              onClick={onNavigate}
                              className="flex h-7 items-center rounded-md px-2 text-[12.5px] text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                            >
                              All {totalProjects} projects
                            </Link>
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/* ── Header, search, account ───────────────────────────────────────────────── */

export function RailSearch({ collapsed = false, onOpen }: { collapsed?: boolean; onOpen?: () => void }) {
  const mod = useModKey();
  return (
    <button
      type="button"
      onClick={() => {
        onOpen?.();
        window.dispatchEvent(new CustomEvent(OPEN_EVENT));
      }}
      aria-label="Open command palette"
      title={collapsed ? `Search (${mod} K)` : undefined}
      className={cn(
        "flex h-8 w-full items-center gap-2 rounded-md bg-sidebar-accent px-2.5 text-[13px] text-sidebar-muted ring-1 ring-inset ring-sidebar-border transition-colors hover:text-sidebar-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      <Search className="size-3.5 shrink-0" aria-hidden />
      {!collapsed && (
        <>
          <span>Search</span>
          <kbd className="ml-auto inline-flex h-[18px] items-center rounded-[4px] border border-sidebar-border px-1 font-sans text-[10.5px] font-medium leading-none text-sidebar-muted">
            {mod} K
          </kbd>
        </>
      )}
    </button>
  );
}

export function AccountMenu({ collapsed = false }: { collapsed?: boolean }) {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

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
  const role = ROLE_LABEL[user.role] ?? user.role;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Account: ${user.full_name}, ${role}`}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md p-1.5 text-left transition-colors hover:bg-sidebar-accent data-[popup-open]:bg-sidebar-accent",
              collapsed && "justify-center",
            )}
          />
        }
      >
        <span
          className="grid size-7 shrink-0 place-items-center rounded-md bg-sidebar-foreground text-[11px] font-semibold text-sidebar"
          aria-hidden
        >
          {initials(user.full_name)}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium leading-4 text-sidebar-foreground">
                {user.full_name}
              </span>
              <span className="block truncate text-[11px] leading-4 text-sidebar-muted">{role}</span>
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-sidebar-muted" aria-hidden />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" sideOffset={6} className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5 py-2">
            <span className="truncate text-sm font-medium text-foreground">{user.full_name}</span>
            <span className="truncate font-normal">{user.email}</span>
            <span className="truncate font-normal">
              {role} · {user.firm?.name}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {user.role === "PARTNER" && (
          <DropdownMenuItem render={<Link href="/settings" />}>
            <Settings className="text-muted-foreground" aria-hidden />
            Settings
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="text-muted-foreground" aria-hidden />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RailBrand({ collapsed }: { collapsed: boolean }) {
  const { user } = useAuth();
  return (
    <Link
      href="/dashboard"
      className={cn("flex min-w-0 items-center gap-2.5 rounded-md", collapsed && "justify-center")}
      aria-label="Upstream — home"
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-sidebar-foreground text-sidebar">
        <UpstreamMark size={18} />
      </span>
      {!collapsed && (
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold leading-4 text-sidebar-foreground">
            {user?.firm?.name ?? "Upstream"}
          </span>
          <span className="block text-[11px] leading-4 text-sidebar-muted">Upstream</span>
        </span>
      )}
    </Link>
  );
}

/* ── The rail ──────────────────────────────────────────────────────────────── */

export function Sidebar() {
  const [collapsed, toggleCollapsed] = useRailCollapsed();
  useNavChords(toggleCollapsed);

  return (
    <aside
      className={cn(
        "app-rail hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-150 md:flex",
        collapsed ? "w-[60px]" : "w-[248px]",
      )}
      aria-label="Primary"
    >
      <div className={cn("flex h-14 items-center gap-2 px-3", collapsed && "justify-center px-2")}>
        <RailBrand collapsed={collapsed} />
        {!collapsed && (
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label="Collapse sidebar"
            title="Collapse sidebar ( [ )"
            className="ml-auto grid size-7 shrink-0 place-items-center rounded-md text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <PanelLeftClose className="size-4" aria-hidden />
          </button>
        )}
      </div>

      <div className={cn("px-3 pb-3", collapsed && "px-2")}>
        <RailSearch collapsed={collapsed} />
      </div>

      <NavLinks collapsed={collapsed} />

      <div className={cn("space-y-1 border-t border-sidebar-border p-2")}>
        {collapsed && (
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label="Expand sidebar"
            title="Expand sidebar ( [ )"
            className="grid h-8 w-full place-items-center rounded-md text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <PanelLeftOpen className="size-4" aria-hidden />
          </button>
        )}
        <AccountMenu collapsed={collapsed} />
      </div>
    </aside>
  );
}
