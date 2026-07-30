"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  Building2,
  CornerDownLeft,
  FolderOpen,
  PenLine,
  Plus,
  Search,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useProjects } from "@/hooks/use-projects";
import { useMandates } from "@/hooks/use-mandates";
import { useCompanies } from "@/hooks/use-companies";
import { useContacts } from "@/hooks/use-contacts";
import { visibleNav } from "@/components/layout/nav";
import { AddCompanyForm } from "@/components/features/add-company";
import { LogOutreachDialog } from "@/components/features/log-outreach-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  filterGroups,
  flattenGroups,
  moveIndex,
  type PaletteGroup,
  type PaletteItem,
  type PaletteItemKind,
} from "@/lib/command-palette";

/** Custom event other components (e.g. the top bar button) fire to open the palette. */
export const OPEN_EVENT = "command-palette:open";

const KIND_ICON: Record<PaletteItemKind, LucideIcon> = {
  action: Plus,
  page: Search,
  project: FolderOpen,
  mandate: Target,
  company: Building2,
  contact: Users,
};

type Mode = "search" | "log-pick";

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Follow-up dialogs launched from the palette. They live here — in the always-mounted
  // parent — so they survive the palette (and its body) closing.
  const [addOpen, setAddOpen] = useState(false);
  const [logTarget, setLogTarget] = useState<{ id: number; name: string } | null>(null);

  // Global ⌘K / Ctrl-K + the topbar button open the palette.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  return (
    <>
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/30 supports-backdrop-filter:backdrop-blur-[2px] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
          <DialogPrimitive.Popup className="fixed left-1/2 top-[12vh] z-50 flex max-h-[70vh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 flex-col overflow-hidden rounded-xl bg-popover text-popover-foreground shadow-2xl ring-1 ring-border outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
            {/* Body (and its data queries) only mount while the palette is open. */}
            {open && (
              <PaletteBody
                onClose={() => setOpen(false)}
                onNewCompany={() => {
                  setOpen(false);
                  setAddOpen(true);
                }}
                onLogCompany={(t) => {
                  setOpen(false);
                  setLogTarget(t);
                }}
              />
            )}
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Launched actions — always mounted, independent of the palette lifecycle. */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add a company</DialogTitle>
            <DialogDescription>
              It joins your firm-wide database and starts its outreach cadence — log the first email
              now or later.
            </DialogDescription>
          </DialogHeader>
          {addOpen && (
            <AddCompanyForm
              onAdded={(c) => {
                setAddOpen(false);
                router.push(`/companies/${c.id}`);
              }}
              onCancel={() => setAddOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {logTarget && (
        <LogOutreachDialog
          companyId={logTarget.id}
          companyName={logTarget.name}
          trigger={null}
          open
          onOpenChange={(o) => {
            if (!o) setLogTarget(null);
          }}
        />
      )}
    </>
  );
}

interface PaletteBodyProps {
  onClose: () => void;
  onNewCompany: () => void;
  onLogCompany: (target: { id: number; name: string }) => void;
}

function PaletteBody({ onClose, onNewCompany, onLogCompany }: PaletteBodyProps) {
  const router = useRouter();
  const { user } = useAuth();

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [mode, setMode] = useState<Mode>("search");
  const [active, setActive] = useState(0);

  // Debounce the server-search query so keystrokes don't fan out to the API.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 180);
    return () => clearTimeout(t);
  }, [query]);

  const searchTerm = debounced;
  const searchEnabled = searchTerm.length >= 2;

  // Small, cached reference lists — filtered client-side.
  const { data: projectData } = useProjects();
  const { data: mandateData } = useMandates();
  // Large sets — server-side search, only once the query is meaningful.
  const { data: companyData, isFetching: companiesFetching } = useCompanies(
    { q: searchTerm, page_size: 6 },
    { enabled: searchEnabled },
  );
  const { data: contactData, isFetching: contactsFetching } = useContacts(
    { q: searchTerm },
    { enabled: searchEnabled },
  );

  const role = user?.role ?? "ANALYST";

  // ── Static groups (client-filtered by the live query) ──────────────────────
  const staticGroups = useMemo<PaletteGroup[]>(() => {
    const actions: PaletteItem[] = [
      {
        id: "action-new-company",
        kind: "action",
        label: "New company",
        sublabel: "Add a target and start its cadence",
        keywords: "create add master list",
        action: "new-company",
      },
      {
        id: "action-log-outreach",
        kind: "action",
        label: "Log outreach…",
        sublabel: "Record a touch against a company",
        keywords: "email follow up call event touch",
        action: "log-outreach",
      },
    ];

    const pages: PaletteItem[] = visibleNav(role).map((n) => ({
      id: `page-${n.href}`,
      kind: "page",
      label: n.label,
      sublabel: "Go to page",
      keywords: n.href,
      href: n.href,
    }));

    const projects: PaletteItem[] = (projectData?.items ?? []).map((p) => ({
      id: `project-${p.id}`,
      kind: "project",
      label: p.name,
      sublabel: p.client_name,
      keywords: "project deal room",
      href: `/projects/${p.id}`,
    }));

    const mandates: PaletteItem[] = (mandateData?.items ?? []).map((m) => ({
      id: `mandate-${m.id}`,
      kind: "mandate",
      label: m.name,
      sublabel: m.client_name,
      keywords: `${m.type} engagement mandate`,
      href: `/companies?mandate_id=${m.id}`,
    }));

    return [
      { heading: "Quick actions", items: actions },
      { heading: "Pages", items: pages },
      { heading: "Projects", items: projects },
      { heading: "Engagements", items: mandates },
    ];
  }, [role, projectData, mandateData]);

  // ── Dynamic groups (already server-filtered) ───────────────────────────────
  const dynamicGroups = useMemo<PaletteGroup[]>(() => {
    if (!searchEnabled) return [];
    const companies: PaletteItem[] = (companyData?.items ?? []).slice(0, 6).map((c) => ({
      id: `company-${c.id}`,
      kind: "company",
      label: c.company_name,
      sublabel: c.hq ?? undefined,
      href: `/companies/${c.id}`,
    }));
    const contacts: PaletteItem[] = (contactData?.items ?? []).slice(0, 6).map((c) => ({
      id: `contact-${c.id}`,
      kind: "contact",
      label: c.contact_person,
      sublabel: [c.designation, c.company_name].filter(Boolean).join(" · ") || undefined,
      href: `/contacts/${c.id}`,
    }));
    const groups: PaletteGroup[] = [];
    if (companies.length) groups.push({ heading: "Companies", items: companies });
    if (contacts.length) groups.push({ heading: "Contacts", items: contacts });
    return groups;
  }, [searchEnabled, companyData, contactData]);

  // Assemble the visible list. In log-pick mode we show ONLY company matches.
  const groups = useMemo<PaletteGroup[]>(() => {
    if (mode === "log-pick") {
      const companies = dynamicGroups.find((g) => g.heading === "Companies");
      return companies ? [{ heading: "Pick a company to log against", items: companies.items }] : [];
    }
    return [...filterGroups(staticGroups, query), ...dynamicGroups];
  }, [mode, staticGroups, dynamicGroups, query]);

  const flat = useMemo(() => flattenGroups(groups), [groups]);

  // Keep the highlighted row valid as results change.
  useEffect(() => {
    setActive((a) => (flat.length === 0 ? 0 : Math.min(a, flat.length - 1)));
  }, [flat.length]);

  // Scroll the highlighted row into view.
  useEffect(() => {
    const el = flat[active] ? document.getElementById(flat[active].id) : null;
    el?.scrollIntoView({ block: "nearest" });
  }, [active, flat]);

  const select = useCallback(
    (item: PaletteItem | undefined) => {
      if (!item) return;
      if (mode === "log-pick" && item.kind === "company") {
        onLogCompany({ id: Number(item.id.replace("company-", "")), name: item.label });
        return;
      }
      if (item.action === "new-company") {
        onNewCompany();
        return;
      }
      if (item.action === "log-outreach") {
        setMode("log-pick");
        setQuery("");
        setActive(0);
        return;
      }
      if (item.href) {
        onClose();
        router.push(item.href);
      }
    },
    [mode, onClose, onLogCompany, onNewCompany, router],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => moveIndex(a, flat.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => moveIndex(a, flat.length, -1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(Math.max(0, flat.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      select(flat[active]);
    } else if (e.key === "Escape" && mode === "log-pick") {
      // First Escape backs out of log-pick; the dialog handles a second Escape.
      e.preventDefault();
      e.stopPropagation();
      setMode("search");
      setActive(0);
    }
  };

  const activeId = flat[active]?.id;
  const fetching = searchEnabled && (companiesFetching || contactsFetching);

  return (
    <>
      {/* Search field */}
      <div className="flex items-center gap-2.5 border-b px-3.5" style={{ borderColor: "var(--border)" }}>
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
        <input
          autoFocus
          role="combobox"
          aria-expanded
          aria-controls="command-palette-list"
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          aria-label={mode === "log-pick" ? "Search a company to log outreach against" : "Search Upstream"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            mode === "log-pick"
              ? "Search a company to log against…"
              : "Search companies, contacts, projects — or jump to a page"
          }
          className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          data-testid="command-input"
        />
        {fetching && (
          <span
            className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-transparent"
            aria-hidden
          />
        )}
      </div>

      {/* Results */}
      <div
        id="command-palette-list"
        role="listbox"
        aria-label="Results"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1.5"
      >
        {flat.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {searchEnabled || query.trim().length === 0
              ? "No matches."
              : "Keep typing to search companies & contacts…"}
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.heading} className="mb-1 last:mb-0">
              <div className="px-3.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {group.heading}
              </div>
              {group.items.map((item) => {
                const idx = flat.indexOf(item);
                const isActive = idx === active;
                const Icon = KIND_ICON[item.kind];
                return (
                  <div
                    key={item.id}
                    id={item.id}
                    role="option"
                    aria-selected={isActive}
                    onClick={() => select(item)}
                    onMouseMove={() => setActive(idx)}
                    className={cn(
                      "mx-1.5 flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-sm",
                      isActive ? "bg-primary/10 text-foreground" : "text-foreground/90",
                    )}
                    data-testid="command-item"
                  >
                    <Icon
                      className={cn("size-4 shrink-0", isActive ? "text-primary-ink" : "text-muted-foreground")}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.sublabel && (
                      <span className="max-w-[45%] shrink-0 truncate text-xs text-muted-foreground">
                        {item.sublabel}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Footer hints — keyboard-first affordances */}
      <div
        className="flex items-center gap-4 border-t px-3.5 py-2 text-[11px] text-muted-foreground"
        style={{ borderColor: "var(--border)" }}
      >
        <span className="flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          navigate
        </span>
        <span className="flex items-center gap-1">
          <Kbd>
            <CornerDownLeft className="size-3" />
          </Kbd>
          open
        </span>
        <span className="flex items-center gap-1">
          <Kbd>esc</Kbd>
          {mode === "log-pick" ? "back" : "close"}
        </span>
        {mode === "log-pick" && (
          <span className="ml-auto flex items-center gap-1 text-primary-ink">
            <PenLine className="size-3" /> Logging outreach
          </span>
        )}
      </div>
    </>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded border bg-muted px-1 font-sans text-[10px] leading-none text-muted-foreground">
      {children}
    </kbd>
  );
}
