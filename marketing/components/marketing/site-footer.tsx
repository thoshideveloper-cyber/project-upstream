import Link from "next/link";

import { UpstreamMark } from "@/components/brand/logo";
import { SHOW_REVIEWS_SECTION, SIGN_IN_URL } from "@/content/site";

const COLS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "The registry", href: "#product" },
      { label: "Outreach desk", href: "#product" },
      { label: "Analytics", href: "#product" },
      { label: "Sourcing", href: "#capabilities" },
      { label: "Contacts", href: "#capabilities" },
      { label: "Security", href: "#security" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Who it's for", href: "#teams" },
      // Dropped with the section itself when there are no reviews to show.
      ...(SHOW_REVIEWS_SECTION ? [{ label: "Customers", href: "#customers" }] : []),
      { label: "Reach", href: "#reach" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Get started",
    links: [
      // Absolute: the product app is a separate deployment from this site.
      { label: "Sign in", href: SIGN_IN_URL },
      { label: "Book a demo", href: SIGN_IN_URL },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto w-full max-w-6xl px-6 py-14 md:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2">
              <UpstreamMark size={22} className="text-foreground" />
              <span
                className="font-display text-xl font-semibold tracking-tight text-foreground"
                style={{ letterSpacing: "-0.3px" }}
              >
                Upstream
              </span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              Relationship intelligence, institutionalised.
            </p>
          </div>

          {COLS.map((col) => (
            <div key={col.title}>
              <h3 className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Upstream. A demo product.</p>
          <p className="font-mono tracking-[0.15em]">Built for teams that run on follow-up</p>
        </div>
      </div>
    </footer>
  );
}
