import type { Metadata } from "next";
import { Cormorant, Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";

import { Providers } from "@/components/providers";
import { THEME_INIT_SCRIPT } from "@/components/theme";

const cormorant = Cormorant({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
      suppressHydrationWarning
      className={`${cormorant.variable} ${outfit.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        {/* Server-rendered so it executes before first paint (client-rendered
            scripts never run and React 19 warns about them). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="bg-background text-foreground min-h-full" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
