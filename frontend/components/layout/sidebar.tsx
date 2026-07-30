"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { visibleNavSections } from "@/components/layout/nav";
import { UpstreamLogo } from "@/components/brand/logo";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

/** Shared nav link list — reused by the desktop sidebar and the mobile drawer. */
export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const sections = visibleNavSections(user?.role ?? "ANALYST");

  return (
    <nav className="flex-1 space-y-4 overflow-y-auto p-2">
      {sections.map((section, i) => (
        <div key={section.label ?? i} className="space-y-0.5">
          {section.label && (
            <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {section.label}
            </p>
          )}
          {section.items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "nav-item flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
                  active
                    ? "active bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
                )}
              >
                <Icon className={cn("size-4 shrink-0", active && "text-primary-ink")} />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function Sidebar() {
  const { user } = useAuth();

  return (
    <aside
      className="bg-sidebar text-sidebar-foreground hidden w-60 shrink-0 flex-col border-r md:flex"
      style={{ borderColor: "var(--sidebar-border)" }}
    >
      {/* Brand */}
      <div className="flex h-14 items-center gap-2 border-b px-4" style={{ borderColor: "var(--sidebar-border)" }}>
        <UpstreamLogo />
      </div>

      <NavLinks />

      <div className="border-t p-4 text-xs" style={{ borderColor: "var(--sidebar-border)" }}>
        <p className="text-muted-foreground truncate">{user?.firm?.name ?? "Upstream"}</p>
      </div>
    </aside>
  );
}
