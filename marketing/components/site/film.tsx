import { ASSET_PREFIX } from "@/content/site";

/**
 * The hero's four frames: one place, photographed at four moments, cross-faded
 * by the scroll.
 *
 * This replaced a scroll-scrubbed video (2026-08-26). The video was one locked
 * shot with no narrative — only the current moved — so it carried atmosphere
 * and nothing else, and it cost 6.3MB, a blob fetch, a seek gate and an
 * all-intra encode to do it. Four stills carry the argument the copy is
 * actually making, and cost 568KB and four `<img>` tags.
 *
 *   frame 1   two channels meet at one confluence,   "Two analysts. One CFO.
 *             turbulent, a sediment plume            Same Tuesday."
 *   frame 2   channels divided by dry bars,          "One sheet per mandate is
 *             none of them touching                   one memory per mandate."
 *   frame 3   the bars drowning, the channels        "Upstream keeps the whole
 *             coalescing, caught mid-transition       current."
 *   frame 4   one current at rest, ruled into        "Log the email. The rest
 *             even lines, one strand running rust     is derived."
 *
 * Scrolling back up runs it backwards, so a reader who went too fast can wind
 * the river back and watch the four channels return.
 *
 * ── Why stacked opacity and not a single swapped src ──────────────────────
 * Four layers, each fully covering the ones beneath when opaque, so there is
 * never a frame where the canvas shows through a gap. Layer 1 is the base and
 * is always opaque; 2, 3 and 4 fade in over the gaps BETWEEN the bands of copy
 * (see `hero.tsx`), so a frame is only ever changing while the words are too.
 *
 * ── The layout law it obeys ───────────────────────────────────────────────
 * The words live in the left of the frame the whole way down, so the mist over
 * the picture is heaviest on the left and every frame was composed with its
 * left third deliberately empty. The reading lane never has to fight the water.
 */

/** Frame 1 is the base layer and never fades; the rest ride on top of it. */
export const FRAMES = [1, 2, 3, 4] as const;

export function Film({
  frameRef,
  layerRefs,
  loaded,
}: {
  frameRef: React.RefObject<HTMLDivElement | null>;
  layerRefs: React.RefObject<(HTMLDivElement | null)[]>;
  loaded: boolean;
}) {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      {/* Every layer rides one transform, so they can never disagree about
          where the frame is while the later ones are still decoding. */}
      <div ref={frameRef} className="absolute inset-0 will-change-transform">
        {FRAMES.map((n, i) => (
          <div
            key={n}
            ref={el => {
              if (layerRefs.current) layerRefs.current[i] = el;
            }}
            className="absolute inset-0 bg-cover"
            style={{
              backgroundImage:
                // The base frame is in the markup from the start; the other
                // three wait for the gates, exactly as the video used to.
                i === 0 || loaded ? `url(${ASSET_PREFIX}/hero/${n}.webp)` : undefined,
              backgroundPosition: "62% 50%",
              opacity: i === 0 ? 1 : 0,
            }}
          />
        ))}
      </div>

      {/* The mist, and the stops are measured rather than judged. These four
          frames are high-key — pale sand across the whole left third, by
          composition — so the same measurement pays for a thin veil. It is set
          where the sublines still read comfortably over the darkest of the
          four, and re-measured whenever it moves. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to right, var(--mist) 0%, color-mix(in oklab, var(--mist) 96%, transparent) 22%, color-mix(in oklab, var(--mist) 84%, transparent) 40%, color-mix(in oklab, var(--mist) 26%, transparent) 60%, color-mix(in oklab, var(--mist) 4%, transparent) 100%)",
        }}
      />
      {/* And a vertical breath, so the frame meets the header and the fold
          below it without an edge. The stops are long on purpose: a short fade
          over a dark frame lands as a visible horizontal seam under the nav. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, var(--mist) 0%, color-mix(in oklab, var(--mist) 70%, transparent) 9%, transparent 34%, transparent 72%, color-mix(in oklab, var(--mist) 72%, transparent) 92%, var(--mist) 100%)",
        }}
      />
    </div>
  );
}
