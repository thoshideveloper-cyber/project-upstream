import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import "./globals.css";

import { THEME_INIT_SCRIPT } from "@/components/theme";

/**
 * Three faces, three jobs.
 *
 *   Newsreader   the argument. A serif of record, variable on weight and
 *                optical size, with a real italic. The product app sets its
 *                own page titles in a serif (Cormorant), so this is the
 *                marketing site rejoining the product rather than inventing a
 *                second brand: term sheets, engagement letters and the app's
 *                own headings are all serif, and this page claims to be a
 *                record. It also holds at 5rem, which the previous grotesk
 *                could only do by adding weight, and weight is exactly the
 *                thing that does not survive a theme flip.
 *   Geist        body and UI. Drawn for screens and, unusually, tuned for both
 *                canvases, which is the problem this palette keeps posing.
 *   Geist Mono   the data voice: readouts, counts, stamps, captions. A true
 *                companion to the body face rather than an unrelated mono.
 *
 * The residual light/dark weight difference is handled in globals.css, where
 * the display weight is a per-theme token rather than one number for both.
 */
const newsreader = Newsreader({
  variable: "--font-display",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

const geist = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const title = "Upstream · the record your outreach runs on";
const description =
  "The master list, the follow-up clock and the contact history for a boutique M&A desk, joined into one record the firm owns. Follow-ups computed on the server. A log that is never overwritten.";

/**
 * The share card.
 *
 * Rendered from the page's own tokens (obsidian, ruled columns, the amber
 * beacon, Newsreader over Geist Mono) rather than dropped in from a template,
 * so a link pasted into a thread already looks like the page it opens.
 *
 * `basePath` is prepended by hand. Next rewrites `next/link` hrefs and `next/
 * image` srcs for a sub-path deployment, but a metadata image URL is passed
 * through untouched, so on GitHub Pages the card 404s without this. Set
 * `NEXT_PUBLIC_SITE_URL` for the deployment's real origin; without it the
 * relative path still resolves on any host that serves the site at its root.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const ogImage = {
  url: `${basePath}/og.jpg`,
  width: 1200,
  height: 630,
  alt: "Upstream. Follow-ups on a clock. A record that outlives the analyst.",
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
    "relationship intelligence",
    "investment banking CRM",
  ],
  openGraph: { title, description, siteName: "Upstream", type: "website", images: [ogImage] },
  twitter: { card: "summary_large_image", title, description, images: [ogImage] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${newsreader.variable} ${geist.variable} ${geistMono.variable} h-full`}
    >
      <head>
        {/* Dark first, and dark by default: THEME_INIT_SCRIPT treats anything
            other than a stored "light" as dark. This meta tells the browser the
            same thing one step earlier, so the pre-paint canvas and the
            scrollbars are dark too rather than flashing white for a frame. */}
        <meta name="color-scheme" content="dark light" />
        <meta name="theme-color" content="#0a0a0c" />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full" suppressHydrationWarning>
        {/* Bypass the nav block (WCAG 2.4.1). The first tab stop used to be the
            logo, with six nav links between a keyboard user and the page. */}
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[70] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <div aria-hidden className="mkt-grain" />
        {children}
      </body>
    </html>
  );
}
