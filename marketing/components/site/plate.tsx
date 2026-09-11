import { ASSET_PREFIX } from "@/content/site";

/**
 * A photographic ground for a fold.
 *
 * The generated stills are atmosphere, not evidence, so none of them is ever
 * a picture in a box. Each one is the ground the fold is printed on, and the
 * treatment differs by act, because the two acts have opposite problems:
 *
 *   surface  Dark ink on pale mist. A photograph behind it competes directly
 *            with the reading, so it comes in at whisper strength under a mist
 *            wash, and every plate is measured against the text over it.
 *   deep     Light ink on black-green water. Here a photograph is doing what
 *            the flat canvas colour was doing anyway, so it can come in at
 *            real strength and the fold becomes genuinely underwater.
 *
 * `mask` keeps the image from touching the edges of the fold, which is what
 * separates a ground from a banner: it has no hard edge anywhere, so the eye
 * never reads it as a rectangle that was placed.
 */
export type PlateName = "cost" | "mechanism" | "record" | "access";

/**
 * Every mask fades on BOTH axes, because a fold is a band in a scrolling page
 * and a plate that fades sideways still lands as a rectangle with a hard lid
 * and a hard floor. The two layers are intersected, so a plate touches no edge
 * of its fold anywhere and the eye never reads it as something placed.
 */
const EDGE = "linear-gradient(to bottom, transparent 0%, black 12%, black 86%, transparent 100%)";

const MASKS = {
  /** Fades from the right, where the fold's copy is thinnest. */
  right: "linear-gradient(to left, black 0%, black 42%, transparent 88%)",
  /** Centred and soft on every edge. The default ground. */
  centre: "radial-gradient(120% 90% at 50% 50%, black 25%, transparent 82%)",
  /** Holds the top, releases the bottom into the next fold. */
  top: "linear-gradient(to bottom, black 0%, black 52%, transparent 96%)",
  /** Full bleed with only the edges softened. The deep act. */
  full: "linear-gradient(to bottom, transparent 0%, black 14%, black 82%, transparent 100%)",
  /**
   * A band across the top of the fold, gone before the copy starts. Used where
   * the image is bright and the copy is pale: no scrim can save pale body text
   * sitting on surface caustics, so the image simply does not sit there.
   */
  band: "linear-gradient(to bottom, black 0%, black 14%, transparent 32%)",
} as const;

export function Plate({
  name,
  opacity,
  mask = "centre",
  wash = 0,
  scrim = false,
  position = "center",
}: {
  name: PlateName;
  /** Measured against the text over it, never chosen by eye alone. */
  opacity: number;
  mask?: keyof typeof MASKS;
  /** A veil of the fold's own canvas colour over the image, 0 to 1. */
  wash?: number;
  /**
   * A local scrim under the reading column, on the left, where every fold in
   * the deep act puts its unpanelled text.
   *
   * This exists because the honest measurement failed. Photographic grounds in
   * the deep act put bright surface caustics behind pale body text: the
   * worst-pixel audit read 1.90:1 under the access fold's copy against a 4.5
   * floor. Dimming the whole image to fix that would have cost the image. A
   * scrim costs only the part of the frame nobody was looking at, and the
   * water stays at full strength everywhere the eye actually goes.
   */
  scrim?: boolean;
  position?: string;
}) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0 bg-cover"
        style={{
          backgroundImage: `url(${ASSET_PREFIX}/scene/${name}.jpg)`,
          backgroundPosition: position,
          opacity,
          // Two layers, intersected: the plate's own shape and the fold's
          // top-and-bottom release. `mask` is the modern property and
          // `WebkitMask` is what Safari still reads.
          maskImage: `${MASKS[mask]}, ${EDGE}`,
          maskComposite: "intersect",
          WebkitMaskImage: `${MASKS[mask]}, ${EDGE}`,
          WebkitMaskComposite: "source-in",
        }}
      />
      {wash > 0 ? (
        <div className="absolute inset-0" style={{ background: `var(--canvas)`, opacity: wash }} />
      ) : null}
      {scrim ? (
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, var(--canvas) 0%, var(--canvas) 34%, transparent 76%)",
            opacity: 0.88,
          }}
        />
      ) : null}
    </div>
  );
}
