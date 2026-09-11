import type { Metadata } from "next";
import { Bricolage_Grotesque, Onest, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";

/**
 * Three faces, three jobs.
 *
 *   Bricolage Grotesque  the argument. A variable grotesk with a real width
 *                        axis, which is the reason it is here: the display
 *                        narrows as the page descends into deep water and
 *                        opens back out when it surfaces, so the type carries
 *                        the arc rather than reporting it. Nobody reaches for
 *                        this face by default, which is the other reason.
 *   Onest                the reading face. Warm, neutral, drawn for small
 *                        sizes, and not Inter.
 *   Spline Sans Mono     every number the server computed: dates, counts,
 *                        stamps, days late. Engineered and slightly narrow, so
 *                        a column of figures reads as an instrument.
 *
 * Weights are trimmed to the ones actually in use. Bricolage ships variable, so
 * the width axis costs nothing extra.
 */
const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz", "wdth"],
  display: "swap",
});

const body = Onest({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const data = Spline_Sans_Mono({
  variable: "--font-data",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const title = "Upstream · log the email, the rest is derived";
const description =
  "The origination and outreach system for boutique M&A desks. One book for the firm, follow-ups computed from a fixed anchor, and a log that is never overwritten. You type one word: sent.";

/**
 * The share card, rendered from the page's own world (mist over cold water,
 * the drawn channel, one late mark) rather than dropped in from a template, so
 * a link pasted into a thread already looks like the page it opens.
 *
 * `basePath` is prepended by hand: Next rewrites `next/link` hrefs and
 * `next/image` srcs for a sub-path deployment, but a metadata image URL is
 * passed through untouched, so on GitHub Pages the card 404s without this.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const ogImage = {
  url: `${basePath}/og.jpg`,
  width: 1200,
  height: 630,
  alt: "Upstream. Log the email. The clock, the queue and the record are derived.",
};

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title,
  description,
  applicationName: "Upstream",
  keywords: [
    "M&A deal sourcing",
    "origination CRM",
    "outreach cadence",
    "buyer list management",
    "investment banking CRM",
  ],
  openGraph: { title, description, siteName: "Upstream", type: "website", images: [ogImage] },
  twitter: { card: "summary_large_image", title, description, images: [ogImage] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${data.variable} h-full`}>
      <head>
        {/* One committed direction, no toggle: the page opens at the surface and
            the browser chrome should match the water it is standing on. */}
        <meta name="color-scheme" content="light" />
        <meta name="theme-color" content="#edf2f0" />
      </head>
      <body className="min-h-full">
        {/* Bypass the nav block (WCAG 2.4.1). Without it the first tab stop is
            the wordmark and there are six links before the page itself. */}
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[70] focus:rounded-md focus:bg-accent focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-[color:var(--paper)]"
        >
          Skip to content
        </a>
        <div aria-hidden className="u-grain" />
        {children}
      </body>
    </html>
  );
}
