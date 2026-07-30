"use client";

import { useEffect, useState } from "react";
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
  { label: "Capabilities", href: "#capabilities" },
  { label: "Teams", href: "#teams" },
  { label: "Security", href: "#security" },
  ...(SHOW_REVIEWS_SECTION ? [{ label: "Customers", href: "#customers" }] : []),
  { label: "FAQ", href: "#faq" },
];

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Escape closes the drawer — it was a one-way door for keyboard users.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        className={cn(
          "transition-colors duration-300",
          scrolled
            ? "border-b border-border bg-background/80 backdrop-blur-xl"
            : "border-b border-transparent",
        )}
      >
        <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6 md:px-8">
          <Link href="/" className="shrink-0" aria-label="Upstream home">
            <UpstreamLogo markSize={22} />
          </Link>

          <div className="hidden items-center gap-7 lg:flex">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            <ThemeToggle className="mr-1" />
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
              className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Book a demo
            </Link>
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-foreground"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
            >
              {open ? <X className="size-4.5" /> : <Menu className="size-4.5" />}
            </button>
          </div>
        </nav>
      </div>

      {open && (
        <div className="border-b border-border bg-background/95 backdrop-blur-xl lg:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-6 py-4">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-2 flex gap-2">
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
