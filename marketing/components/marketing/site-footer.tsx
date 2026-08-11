import Link from "next/link";

import { UpstreamMark } from "@/components/brand/logo";
import { CTA_HREF, SHOW_REVIEWS_SECTION } from "@/content/site";
import { Container, Readout, Stamp } from "./primitives";

/**
 * A colophon, not a link farm.
 *
 * An earlier footer reprinted sixteen anchors, six of which pointed at the same
 * section, which is the standard SaaS pattern and told a reader nothing the nav
 * had not. What is left is the path back into the document, the path into the
 * product, and the legal links a public site is expected to carry and once did
 * not have at all.
 *
 * The line under the wordmark is the page's thesis in one sentence, which is
 * the last thing worth leaving someone with.
 */
const NAV = [
  { label: "The cost", href: "#ledger" },
  { label: "The desk", href: "#desk" },
  { label: "The clock", href: "#clock" },
  { label: "The record", href: "#record" },
  { label: "Security", href: "#secret" },
  ...(SHOW_REVIEWS_SECTION ? [{ label: "Customers", href: "#customers" }] : []),
  { label: "Objections", href: "#faq" },
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
      <Container className="py-16 md:py-20">
        <div className="grid gap-12 md:grid-cols-[1.7fr_1fr_1fr] md:gap-14">
          <div>
            <div className="flex items-center gap-2.5">
              <UpstreamMark size={20} className="text-foreground" />
              <span className="mkt-subhead text-xl text-foreground">Upstream</span>
            </div>
            <p className="mkt-subhead mt-5 max-w-[30ch] text-[1.15rem] leading-snug text-foreground/85">
              The record a deal desk&rsquo;s outreach runs on.
            </p>
            <p className="mt-4 max-w-[36ch] text-sm leading-relaxed text-muted-foreground">
              Origination and outreach for boutique M&amp;A desks. Three spreadsheets, held by the
              firm instead of by whoever still works here.
            </p>
          </div>

          <nav aria-label="Page sections">
            <Readout className="block">On this page</Readout>
            <ul className="mt-5 space-y-2.5">
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
            <ul className="mt-5 space-y-2.5">
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

        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-border pt-6 sm:flex-row sm:items-center">
          <Stamp>© {new Date().getFullYear()} Upstream · a demo product</Stamp>
          <ul className="flex items-center gap-6">
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
