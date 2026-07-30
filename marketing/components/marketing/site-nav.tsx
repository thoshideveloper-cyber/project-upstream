"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import { UpstreamLogo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/marketing/theme-toggle";
import { SHOW_REVIEWS_SECTION, CTA_HREF } from "@/content/site";
import { cn } from "@/lib/utils";

// "Customers" appears only when there is a customers section to jump to — the
// section, its anchor and this link all come from the same flag.
const LINKS = [
  { label: "Product", href: "#product" },
  { label: "Cadence", href: "#cadence" },
  { label: "Capabilities", href: "#capabilities" },
  { label: "Compare", href: "#compare" },
  { label: "Security", href: "#security" },
  ...(SHOW_REVIEWS_SECTION ? [{ label: "Customers", href: "#customers" }] : []),
  { label: "FAQ", href: "#faq" },
];

const IDS = LINKS.map((l) => l.href.slice(1));

/**
 * A floating console bar rather than a full-width sticky header.
 *
 * The old nav was a transparent strip that grew a border and a blur at 8px of
 * scroll — the default, and it told the reader nothing about where they were on
 * a page with nine anchors. This one is detached from the viewport edge, so the
 * page visibly runs underneath it, and it tracks the section you're actually in:
 * an amber capsule slides between links as you scroll. That's the one piece of
 * state the page can genuinely report, so it's the one the chrome reports.
 */
export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Which section is under the reading line. rootMargin pins the trigger band to
  // the upper third: a section counts as "current" once its top clears the bar,
  // not when it first peeks in from the bottom.
  useEffect(() => {
    const seen = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.intersectionRatio);
        let best: string | null = null;
        let bestRatio = 0;
        for (const id of IDS) {
          const r = seen.get(id) ?? 0;
          if (r > bestRatio) {
            bestRatio = r;
            best = id;
          }
        }
        setActive(bestRatio > 0 ? best : null);
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    for (const id of IDS) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, []);

  // Measure the capsule off the live DOM — the labels are variable-width, so
  // there is no arithmetic that gets this right across locales or font swaps.
  const measure = useCallback(() => {
    if (!active) return setPill(null);
    const el = linkRefs.current[active];
    const list = listRef.current;
    if (!el || !list) return setPill(null);
    setPill({ x: el.offsetLeft, w: el.offsetWidth });
  }, [active]);

  useLayoutEffect(measure, [measure]);
  useEffect(() => {
    window.addEventListener("resize", measure);
    // The font swaps in after hydration and every label changes width with it.
    document.fonts?.ready.then(measure).catch(() => {});
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  // Escape closes the drawer — it was a one-way door for keyboard users.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-4 sm:pt-4">
      <nav
        aria-label="Primary"
        className={cn(
          "mx-auto flex w-full max-w-6xl items-center justify-between gap-3 rounded-xl px-3 py-2 transition-all duration-300 sm:px-4",
          scrolled
            ? "border border-border bg-background/70 backdrop-blur-xl"
            : "border border-transparent",
        )}
      >
        <Link href="/" className="shrink-0 pl-1" aria-label="Upstream home">
          <UpstreamLogo markSize={20} />
        </Link>

        <div ref={listRef} className="relative hidden items-center gap-1 lg:flex">
          {/* The capsule. Rendered once and moved, so the travel between links is
              the animation — six separate hover backgrounds would not read as
              one indicator moving. */}
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-y-0 rounded-lg bg-primary/12 ring-1 ring-primary/25 transition-all duration-300 ease-out",
              pill ? "opacity-100" : "opacity-0",
            )}
            style={pill ? { transform: `translateX(${pill.x}px)`, width: pill.w } : { width: 0 }}
          />
          {LINKS.map((l) => {
            const id = l.href.slice(1);
            const on = active === id;
            return (
              <a
                key={l.href}
                href={l.href}
                ref={(n) => {
                  linkRefs.current[id] = n;
                }}
                aria-current={on ? "true" : undefined}
                className={cn(
                  "relative rounded-lg px-3 py-1.5 text-sm transition-colors duration-200",
                  on ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {l.label}
              </a>
            );
          })}
        </div>

        <div className="hidden items-center gap-1 lg:flex">
          <ThemeToggle />
          <Link
            href={CTA_HREF}
            prefetch={false}
            className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign in
          </Link>
          <Link
            href={CTA_HREF}
            prefetch={false}
            className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-[background-color,transform] duration-200 hover:bg-primary/90 active:scale-[0.985]"
          >
            Book a demo
          </Link>
        </div>

        <div className="flex items-center gap-1 lg:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-foreground"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
          >
            {open ? <X className="size-4.5" /> : <Menu className="size-4.5" />}
          </button>
        </div>
      </nav>

      {open && (
        <div
          id="mobile-nav"
          className="mx-auto mt-2 w-full max-w-6xl overflow-hidden rounded-xl border border-border bg-background/95 backdrop-blur-xl lg:hidden"
        >
          <div className="flex flex-col p-2">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                aria-current={active === l.href.slice(1) ? "true" : undefined}
                className={cn(
                  "rounded-lg px-3 py-2.5 text-sm transition-colors",
                  active === l.href.slice(1)
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
                )}
              >
                {l.label}
              </a>
            ))}
            <div className="mt-2 flex gap-2 border-t border-border pt-2">
              <Link
                href={CTA_HREF}
                prefetch={false}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-border text-sm text-foreground"
              >
                Sign in
              </Link>
              <Link
                href={CTA_HREF}
                prefetch={false}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground"
              >
                Book a demo
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
