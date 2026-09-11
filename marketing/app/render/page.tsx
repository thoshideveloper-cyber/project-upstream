import type { Metadata } from "next";

import { FlowStill } from "@/components/site/flow-still";
import { Mark } from "@/components/site/nav";
import { ASSET_PREFIX, QUEUE, STATIC_HERO } from "@/content/site";

/**
 * The asset bench.
 *
 * Not a page anyone visits: it is the surface the render harness
 * (`scripts/render-assets.mjs`) photographs to produce the four static assets
 * the site ships, so every one of them is made of the site's own tokens, type
 * and scene code rather than drawn separately and left to drift.
 *
 *   #og      1200x630  the share card
 *   #still   1600x900  the frame under the closing fold's ambient loop
 *   #loop    1280x720  the canvas the loop is recorded from
 *
 * There is no hero poster here any more. The still hero shows a frame of the
 * hero's own fourth frame (`scene/hero-river.jpg`, the same still the
 * static hero uses), so a
 * canvas rendering of the same moment would be a second, slightly different
 * answer to a question the footage already answers.
 *
 * Deliberately `noindex`. It ships in the export because leaving it out would
 * mean the assets could only be regenerated from a dev server, and the point of
 * a bench is that it is still there the next time the palette changes.
 */
export const metadata: Metadata = {
  title: "Asset bench · Upstream",
  robots: { index: false, follow: false },
};

export default function RenderPage() {
  return (
    <main className="bg-[color:var(--canvas)] p-10">
      {/* ── The share card ──────────────────────────────────────────────── */}
      <section
        id="og"
        className="relative overflow-hidden"
        style={{ width: 1200, height: 630, background: "var(--canvas)" }}
      >
        {/* The generated river, not a canvas frame: a link pasted into a thread
            should open on the same water the page opens on. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${ASSET_PREFIX}/scene/hero-river.jpg)` }}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(130% 110% at 18% 55%, color-mix(in oklab, var(--mist) 94%, transparent) 34%, color-mix(in oklab, var(--mist) 40%, transparent) 72%, transparent 100%)",
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-16">
          <div className="flex items-center gap-3">
            <Mark className="h-7 w-7 text-accent" />
            <span className="u-subhead text-[1.75rem]">Upstream</span>
          </div>
          <div>
            <h1
              className="u-display max-w-[16ch] text-[4rem] leading-[0.98]"
              style={{ ["--wdth" as string]: 92 }}
            >
              {STATIC_HERO.head}
            </h1>
            <p className="u-mono mt-6 text-[1.0625rem] text-fg-muted">
              Origination and outreach for boutique M&amp;A desks
            </p>
          </div>
        </div>
      </section>

      {/* ── The still under the closing loop ────────────────────────────── */}
      <section
        id="still"
        className="relative mt-10 overflow-hidden"
        style={{ width: 1600, height: 900, background: "var(--canvas)" }}
      >
        <FlowStill p={0.42} width={1600} height={900} className="absolute inset-0" />
      </section>

      {/* ── The canvas the ambient loop is recorded from ────────────────── */}
      <section
        id="loop"
        className="relative mt-10 overflow-hidden"
        style={{ width: 1280, height: 720, background: "var(--canvas)" }}
      >
        <FlowStill p={0.3} width={1280} height={720} className="absolute inset-0" />
      </section>

      {/* Present so the bench renders the same row styling the site ships,
          which is what keeps the card honest about what the product looks
          like. Never photographed on its own. */}
      <p className="u-mono mt-6 text-[0.75rem] text-fg-muted">{QUEUE.length} rows in the demo book</p>
    </main>
  );
}
