"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion, useScroll, useSpring } from "motion/react";

import { UpstreamLogo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/marketing/theme-toggle";
import { CTA_HREF, SHOW_REVIEWS_SECTION } from "@/content/site";
import { cn } from "@/lib/utils";
import { EASE, SPRING } from "@/components/motion/primitives";

/**
 * A document header, not a floating pill.
 *
 * The previous nav was a detached rounded bar hovering over the page. It is a
 * good pattern and it is on several thousand sites, and on a page set as a
 * register it was the one element pretending to be an app. This one is a rule
 * across the top of the document: transparent over the fold, and as the reader
 * leaves the fold it earns a hairline, a blur and the section stamp.
 *
 * The stamp is the point. On a page this long "how much more of this is there"
 * is the question that closes tabs, so the chrome answers two forms of it at
 * once: the stamp says which entry you are reading, and the amber rule along
 * the bottom edge says how far through the document you are. Both are
 * information, so both survive `prefers-reduced-motion`; only their easing goes.
 */

const LINKS = [
  { label: "The desk", href: "#desk", stamp: "02 / The desk" },
  { label: "The clock", href: "#clock", stamp: "03 / The clock" },
  { label: "The record", href: "#record", stamp: "04 / The record" },
  { label: "Security", href: "#secret", stamp: "05 / The secret" },
  ...(SHOW_REVIEWS_SECTION ? [{ label: "Customers", href: "#customers", stamp: "07 / Customers" }] : []),
  { label: "FAQ", href: "#faq", stamp: "06 / Objections" },
];

/** The ledger has no nav link, but it still names the chrome when you are in it. */
const STAMPS: Record<string, string> = {
  ledger: "01 / The cost",
  ...Object.fromEntries(LINKS.map((l) => [l.href.slice(1), l.stamp])),
};
const IDS = Object.keys(STAMPS);

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.4 });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Which section is under the reading line. The margin pins the trigger band
  // to the upper third: a section counts as current once its top clears the
  // bar, not when it first peeks in from the bottom.
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
      { rootMargin: "-18% 0px -58% 0px", threshold: [0, 0.2, 0.5, 1] },
    );
    for (const id of IDS) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, []);

  // Escape closes the drawer. It was a one-way door for keyboard users.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const stamp = active ? STAMPS[active] : null;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        scrolled ? "border-b border-border bg-background/80 backdrop-blur-xl" : "border-b border-transparent",
      )}
    >
      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 w-full max-w-[92rem] items-center justify-between gap-4 px-5 sm:px-7 md:px-10"
      >
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/" className="shrink-0" aria-label="Upstream home">
            <UpstreamLogo markSize={20} />
          </Link>

          {/* The stamp arrives with the border, once the fold is behind you. */}
          <AnimatePresence mode="wait">
            {scrolled && stamp && (
              <motion.span
                key={stamp}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 6 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="hidden shrink-0 items-center gap-3 md:flex"
              >
                <span aria-hidden className="h-3.5 w-px bg-border" />
                <span className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
                  {stamp}
                </span>
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div className="hidden items-center lg:flex">
          {LINKS.map((l) => {
            const on = active === l.href.slice(1);
            return (
              <a
                key={l.href}
                href={l.href}
                aria-current={on ? "true" : undefined}
                className={cn(
                  "relative px-3.5 py-5 text-sm transition-colors duration-200",
                  on ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {l.label}
                {on && (
                  // One indicator that travels between links. Six separate
                  // hover backgrounds never read as one thing moving.
                  <motion.span
                    layoutId="nav-indicator"
                    aria-hidden
                    className="absolute inset-x-3 bottom-3 h-px bg-primary"
                    transition={SPRING}
                  />
                )}
              </a>
            );
          })}
        </div>

        <div className="hidden items-center gap-1.5 lg:flex">
          <ThemeToggle />
          <Link
            href={CTA_HREF}
            prefetch={false}
            className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign in
          </Link>
          <Link
            href={CTA_HREF}
            prefetch={false}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors duration-200 hover:bg-primary/90 active:scale-[0.985] motion-reduce:active:scale-100"
          >
            Book a demo
          </Link>
        </div>

        <div className="flex items-center gap-1.5 lg:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex size-9 items-center justify-center rounded-md border border-border text-foreground"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
          >
            {open ? <X className="size-4.5" /> : <Menu className="size-4.5" />}
          </button>
        </div>
      </nav>

      {/* Reading progress, on the header's own bottom edge rather than as a
          second floating bar. It is information, so it is not gated on motion
          preference; only the spring that smooths it is. */}
      <motion.span
        aria-hidden
        style={{ scaleX: progress }}
        className="absolute inset-x-0 bottom-0 block h-px origin-left bg-primary/80"
      />

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-nav"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden border-t border-border bg-background/95 backdrop-blur-xl lg:hidden"
          >
            <div className="flex flex-col px-5 py-3 sm:px-7">
              {LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  aria-current={active === l.href.slice(1) ? "true" : undefined}
                  className={cn(
                    "flex items-baseline gap-3 border-b border-border py-3.5 text-[15px] transition-colors last:border-b-0",
                    active === l.href.slice(1) ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <span className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground">
                    {l.stamp.split(" / ")[0]}
                  </span>
                  {l.label}
                </a>
              ))}
              <div className="mt-4 flex gap-2 pb-1">
                <Link
                  href={CTA_HREF}
                  prefetch={false}
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-md border border-border text-sm text-foreground"
                >
                  Sign in
                </Link>
                <Link
                  href={CTA_HREF}
                  prefetch={false}
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground"
                >
                  Book a demo
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
