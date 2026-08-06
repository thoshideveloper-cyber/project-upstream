import {
  BarChart3,
  Building2,
  CalendarClock,
  FileSpreadsheet,
  FolderOpen,
  LayoutDashboard,
  LineChart,
  Settings,
  Target,
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
}

export interface NavSection {
  /** Section eyebrow. Omit for the top (unlabeled) group. */
  label?: string;
  items: NavItem[];
}

/**
 * Navigation grouped to mirror the analyst's workflow:
 * Pipeline (find & organize) → Outreach (act) → Insights (learn) → Admin.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Pipeline",
    items: [
      { label: "Projects", href: "/projects", icon: FolderOpen },
      // Onboarding is not a one-off: a firm brings a workbook per client and the
      // contact list arrives separately, so the importer needs a standing home rather
      // than only the projects empty state, which disappears after the first import.
      // It sits in Pipeline, not Admin — for an analyst this is how their own book
      // gets in, and the reach of any one import is scoped server-side.
      { label: "Import", href: "/import", icon: FileSpreadsheet },
      { label: "Sourcing", href: "/sourcing", icon: Target },
      { label: "Master List", href: "/master", icon: Building2 },
    ],
  },
  {
    label: "Outreach",
    items: [
      { label: "Schedule", href: "/schedule", icon: CalendarClock },
      { label: "Contacts", href: "/contacts", icon: Users },
    ],
  },
  {
    label: "Insights",
    items: [
      { label: "Analytics", href: "/analytics", icon: BarChart3 },
      { label: "Project health", href: "/analytics/projects", icon: LineChart, roles: ["PARTNER"] },
    ],
  },
  {
    label: "Admin",
    items: [{ label: "Settings", href: "/settings", icon: Settings, roles: ["PARTNER"] }],
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
