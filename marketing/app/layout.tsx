import type { Metadata } from "next";
import { Archivo, Azeret_Mono } from "next/font/google";
import "./globals.css";

import { THEME_INIT_SCRIPT } from "@/components/theme";

/**
 * Two voices, contrasted on the width axis rather than serif-vs-sans.
 *
 * The page used to run Cormorant display over Outfit body — a display serif with
 * mono labels and hairline rules, which is the saturated editorial-magazine lane
 * and reads as a magazine *about* an instrument rather than the instrument. Upstream
 * is a working console: a shared registry, a computed clock, an append-only log.
 *
 * Archivo is a grotesque with a real `wdth` axis, so headings run wide (signage,
 * a faceplate, a manifest header) and body runs normal from the same family — one
 * voice, committed contrast. Azeret Mono is the data voice: squared terminals and
 * mechanical rhythm, for readouts and counts, never for prose.
 */
const archivo = Archivo({
  variable: "--font-sans",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});

const azeret = Azeret_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const title = "Upstream — the record your outreach runs on";
const description =
  "Upstream runs the whole loop on one record: find the organisations worth reaching, work the follow-ups on a computed cadence, and keep the relationship memory with the team instead of in someone's inbox.";

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
      className={`${archivo.variable} ${azeret.variable} h-full antialiased`}
    >
      <head>
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
