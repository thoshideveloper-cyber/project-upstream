import type { Metadata } from "next";
import { IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import "./globals.css";

import { Providers } from "@/components/providers";

/*
 * One working face for the whole product.
 *
 * Instrument Sans is a compact neo-grotesque: tight enough to hold 13px table cells,
 * with real tabular figures (`tnum`), so every number in a column aligns without
 * switching to a monospace. Figures stay in the same family as the words beside them,
 * which is how financial statements are set — a mono face for numbers reads as a
 * terminal, not a ledger.
 *
 * Plex Mono is kept only for the things that are genuinely code-like: keyboard hints,
 * identifiers, file names.
 */
const instrumentSans = Instrument_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Upstream",
  description: "M&A deal-sourcing CRM",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${instrumentSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground min-h-full" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
