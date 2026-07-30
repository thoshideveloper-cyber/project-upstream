import Link from "next/link";

import { UpstreamMark } from "@/components/brand/logo";
import { SHOW_REVIEWS_SECTION, CTA_HREF } from "@/content/site";
import { Container, Readout } from "./primitives";

/**
 * Two columns, not a four-column link farm.
 *
 * The old footer reprinted sixteen anchors — six of which pointed at the same
 * `#product` section — which is the standard SaaS link farm and told a reader
 * nothing the nav hadn't already. What's left is the path back into the page and
 * the path into the product, plus the legal links a public site is expected to
 * carry and previously didn't have at all.
 */
const NAV = [
  { label: "Product", href: "#product" },
  { label: "The follow-up clock", href: "#cadence" },
  { label: "Capabilities", href: "#capabilities" },
  { label: "Who it's for", href: "#teams" },
  { label: "What changes", href: "#compare" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Security", href: "#security" },
  ...(SHOW_REVIEWS_SECTION ? [{ label: "Customers", href: "#customers" }] : []),
  { label: "FAQ", href: "#faq" },
];

const START = [
  { label: "Book a demo", href: CTA_HREF },
  { label: "See the live demo", href: CTA_HREF },
  { label: "Sign in", href: CTA_HREF },
];

const LEGAL = [
  { label: "Privacy", href: CTA_HREF },
  { label: "Terms", href: CTA_HREF },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <Container className="py-14 md:py-16">
        <div className="grid gap-10 md:grid-cols-[1.6fr_1fr_1fr] md:gap-12">
          <div>
            <div className="flex items-center gap-2.5">
              <UpstreamMark size={20} className="text-foreground" />
              <span className="mkt-subhead text-lg text-foreground">Upstream</span>
            </div>
            <p className="mt-3 max-w-[34ch] text-sm leading-relaxed text-muted-foreground">
              One record for the whole team: who you&apos;re working, who you&apos;ve reached, and
              what you found out last time.
            </p>
          </div>

          <nav aria-label="Page sections">
            <Readout className="block">On this page</Readout>
            <ul className="mt-4 space-y-2.5">
              {NAV.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Get started">
            <Readout className="block">Get started</Readout>
            <ul className="mt-4 space-y-2.5">
              {START.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    prefetch={false}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-border pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Upstream. A demo product.
          </p>
          <ul className="flex items-center gap-5">
            {LEGAL.map((l) => (
              <li key={l.label}>
                <Link
                  href={l.href}
                  prefetch={false}
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </footer>
  );
}
