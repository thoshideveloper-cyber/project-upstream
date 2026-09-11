import {
  BarChart3,
  Building2,
  CalendarClock,
  CheckSquare,
  FileSpreadsheet,
  FolderKanban,
  Home,
  LineChart,
  Settings,
  Telescope,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { Role } from "@/types";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** If set, only these roles see the item. Undefined = visible to all. */
  roles?: Role[];
  /**
   * Marks an item as having live children the sidebar resolves at render time.
   *
   * This file stays a *static* declaration — the command palette reads it during
   * render and cannot await anything — so the marker names a source and `sidebar.tsx`
   * does the fetching. Adding data here would make every consumer of NAV_SECTIONS
   * depend on the query client.
   */
  expandable?: { source: "projects" };
  /** Keyboard chord shown beside the item and bound by the shell (`g` then this key). */
  chord?: string;
}

export interface NavSection {
  /** Section caption. Omit for the top (unlabeled) group. */
  label?: string;
  items: NavItem[];
}

/**
 * Navigation grouped to mirror the analyst's day:
 *
 *   Home      what needs me          (the desk, my declared work)
 *   Deals     where the work lives   (projects → the firm's companies → discovery)
 *   Outreach  acting on it           (the cadence queue, the people)
 *   Insights  learning from it
 *
 * Strictly *global* product areas. Anything scoped to one project — its workspace, its
 * work, its analytics, its history — belongs to the project's own navigation
 * (`components/project/project-nav.tsx`), so the two never compete to tell you where
 * you are.
 *
 * "My work" is the cross-project inbox: every task assigned to you, including personal
 * ones that belong to no project. Project work still lives in the project; this is the
 * one door that shows all of it together.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: "Home", href: "/dashboard", icon: Home, chord: "h" },
      { label: "My work", href: "/tasks", icon: CheckSquare, chord: "w" },
    ],
  },
  {
    label: "Deals",
    items: [
      {
        label: "Projects",
        href: "/projects",
        icon: FolderKanban,
        expandable: { source: "projects" },
        chord: "p",
      },
      { label: "Master List", href: "/master", icon: Building2, chord: "m" },
      { label: "Sourcing", href: "/sourcing", icon: Telescope, chord: "d" },
    ],
  },
  {
    label: "Outreach",
    items: [
      { label: "Schedule", href: "/schedule", icon: CalendarClock, chord: "s" },
      { label: "Contacts", href: "/contacts", icon: Users, chord: "c" },
    ],
  },
  {
    label: "Insights",
    items: [
      { label: "Analytics", href: "/analytics", icon: BarChart3, chord: "a" },
      { label: "Project health", href: "/analytics/projects", icon: LineChart, roles: ["PARTNER"] },
    ],
  },
  {
    label: "Workspace",
    items: [
      // Onboarding is not a one-off: a firm brings a workbook per client and the
      // contact list arrives separately, so the importer needs a standing home rather
      // than only the projects empty state. The reach of any one import is scoped
      // server-side, so it is open to analysts too.
      { label: "Import", href: "/import", icon: FileSpreadsheet },
      { label: "Settings", href: "/settings", icon: Settings, roles: ["PARTNER"] },
    ],
  },
];

/** Flattened list (kept for any consumer that wants a single sequence). */
export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

export function visibleNav(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));
}

/** Role-filtered sections, with empty sections dropped. */
export function visibleNavSections(role: Role): NavSection[] {
  return NAV_SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter((item) => !item.roles || item.roles.includes(role)),
  })).filter((s) => s.items.length > 0);
}

/**
 * The nav item a path belongs to — longest matching prefix wins, so
 * `/analytics/projects` lights "Project health", not "Analytics".
 */
export function activeNavHref(pathname: string, items: NavItem[]): string | null {
  let best: string | null = null;
  for (const item of items) {
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      if (!best || item.href.length > best.length) best = item.href;
    }
  }
  // Company and contact dossiers are reached from the Master List and Contacts.
  if (!best && pathname.startsWith("/companies")) return "/master";
  return best;
}
