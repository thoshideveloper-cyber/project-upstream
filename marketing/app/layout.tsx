import type { Metadata } from "next";
import { Funnel_Display, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { THEME_INIT_SCRIPT } from "@/components/theme";

/**
 * Three faces, three jobs.
 *
 * The previous pass ran Archivo across everything, with headings pushed to the
 * wide end of its `wdth` axis at semibold. That works on obsidian, where light
 * type on a dark ground optically *thins*, and fails in Daylight, where the same
 * wide semibold lands on warm paper as a heavy slab. Presence was coming from
 * weight, and weight is exactly the thing that doesn't survive a theme flip.
 *
 * So presence now comes from shape instead:
 *   Funnel Display  headings. Slightly condensed with real character, so it
 *                   carries a fold at 500-600 rather than needing 700.
 *   Geist           body and UI. Drawn for screens and, unusually, tuned for
 *                   both canvases — which is the problem being solved here.
 *   Geist Mono      the data voice: readouts, counts, captions. A true companion
 *                   to the body face rather than an unrelated mono bolted on.
 *
 * The residual light/dark weight difference is handled in globals.css, where the
 * display weight is a per-theme token rather than one number for both.
 */
const funnel = Funnel_Display({
  variable: "--font-display",
  subsets: ["latin"],
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
  "Find the organisations worth reaching, work the follow-ups on a clock the server keeps, and hold on to what your team learned. One record, not three spreadsheets.";

export const metadata: Metadata = {
  title,
  description,
  applicationName: "Upstream",
  keywords: [
    "outreach CRM",
    "relationship intelligence",
    "deal sourcing",
    "follow-up cadence",
    "pipeline memory",
  ],
  openGraph: { title, description, siteName: "Upstream", type: "website" },
  twitter: { card: "summary_large_image", title, description },
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
      className={`${funnel.variable} ${geist.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Dark first, and dark by default: THEME_INIT_SCRIPT treats anything
            other than a stored "light" as dark. This meta tells the browser the
            same thing one step earlier, so the pre-paint canvas and the
            scrollbars are dark too rather than flashing white for a frame. */}
        <meta name="color-scheme" content="dark light" />
        <meta name="theme-color" content="#0b0b0d" />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="bg-background text-foreground min-h-full" suppressHydrationWarning>
        {/* Bypass the nav block (WCAG 2.4.1) — the first tab stop used to be the
            logo, with six nav links between a keyboard user and the page. */}
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[70] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-primary-foreground"
        >
          Skip to content
        </a>
        {/* Film grain over the whole page. Obsidian at this size is a very large
            flat field; a fixed 4% noise plate keeps it from reading as vector
            emptiness without adding a request (it's an inline SVG data URI). */}
        <div aria-hidden className="mkt-grain" />
        {children}
      </body>
    </html>
  );
}
