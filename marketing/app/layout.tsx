import type { Metadata } from "next";
import { Cormorant, Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";

import { THEME_INIT_SCRIPT } from "@/components/theme";

// Only the weights the landing actually renders: display at 500/600, sans at
// 400/500, mono at 400/500/600. Cormorant 700 and Outfit 300/600/700 were declared
// but never used — browsers fetch faces on demand, so this trims the font CSS and
// removes four faces that could only ever be requested by mistake.
const cormorant = Cormorant({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Upstream — Sourcing, outreach and relationship CRM",
  description:
    "Upstream runs the whole loop on one record: find the organisations worth reaching, work the follow-ups on a computed cadence, and keep the relationship memory with the team instead of in someone's inbox.",
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
      className={`${cormorant.variable} ${outfit.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="bg-background text-foreground min-h-full" suppressHydrationWarning>
        {/* Bypass the nav block (WCAG 2.4.1) — the first tab stop used to be the
            logo, with six nav links between a keyboard user and the page. */}
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-primary-foreground"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
