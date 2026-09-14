import Link from "next/link";

import { CTA_HREF, FOOTER_NOTE, NAV } from "@/content/site";
import { Mark } from "./nav";

/**
 * The footer.
 *
 * No invented office addresses, no borrowed customer logos, no press page that
 * does not exist. It carries the two true things a first-time reader needs
 * after the closing: where to go next, and the disclosure that the book in
 * every screenshot is demo data.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-hair">
      <div className="mx-auto w-full max-w-[84rem] px-6 py-14 sm:px-8 lg:px-12">
        <div className="flex flex-wrap items-start justify-between gap-10">
          <div className="max-w-[34ch]">
            <div className="flex items-center gap-2.5">
              <Mark className="h-5 w-5 text-accent" />
              <span className="u-subhead text-[1.0625rem]">Upstream</span>
            </div>
            <p className="mt-4 text-[0.875rem] leading-relaxed text-fg-muted">
              Origination and outreach for boutique M&amp;A desks. The master list, the follow-up
              clock and the contact record, joined.
            </p>
          </div>

          <nav aria-label="Footer" className="flex flex-wrap gap-x-10 gap-y-3">
            <ul className="space-y-2">
              {NAV.map((item) => (
                <li key={item.href}>
                  <a href={item.href} className="text-[0.875rem] text-fg-muted hover:text-fg">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
            <ul className="space-y-2">
              <li>
                <Link href={CTA_HREF} prefetch={false} className="text-[0.875rem] text-fg-muted hover:text-fg">
                  See it running
                </Link>
              </li>
              <li>
                <Link href={CTA_HREF} prefetch={false} className="text-[0.875rem] text-fg-muted hover:text-fg">
                  Talk to us
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <p className="u-mono mt-12 max-w-[70ch] border-t border-hair pt-6 text-[0.6875rem] leading-relaxed text-fg-muted">
          {FOOTER_NOTE}
        </p>
        <p className="u-mono mt-3 text-[0.6875rem] text-fg-muted">© {year} Upstream.</p>
      </div>
    </footer>
  );
}
