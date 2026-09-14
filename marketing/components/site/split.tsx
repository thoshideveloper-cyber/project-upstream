/**
 * Splitting a headline into words and characters, once, deterministically.
 *
 * Every "random" offset comes from a seeded generator, so the scatter is
 * identical on every load and on every machine. A hero whose entrance is
 * different each time cannot be tuned, and cannot be screenshotted for review.
 *
 * Accessibility: the real sentence ships once in a visually hidden span, and
 * the visual copy, which is a pile of empty-looking spans to a screen reader,
 * is `aria-hidden`. Splitting text without doing this is how a headline
 * becomes "T w o a n a l y s t s" in a screen reader.
 */

function rng(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

type Entrance = "drift" | "part" | "scatter" | "settle";

/** Deterministic per-headline seed, so two bands never scatter identically. */
function seedOf(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function SplitHead({ text, entrance }: { text: string; entrance: Entrance }) {
  const words = text.split(" ");
  const r = rng(seedOf(text));

  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden className={`u-${entrance} block`}>
        {words.map((word, w) => {
          // Reading-order stagger for the entrances that arrive as a line, a
          // random threshold for the one that arrives as a cloud.
          const th =
            entrance === "scatter" ? r() * 0.5 : (w / Math.max(1, words.length - 1)) * 0.42;

          if (entrance === "scatter") {
            return (
              <span key={w} className="w" style={{ marginRight: "0.26em" }}>
                {[...word].map((ch, c) => (
                  <span
                    key={c}
                    className="c"
                    style={
                      {
                        "--th": r() * 0.5,
                        "--jx": `${(r() - 0.5) * 44}px`,
                        "--jy": `${(r() - 0.5) * 34}px`,
                        "--jr": `${(r() - 0.5) * 16}deg`,
                      } as React.CSSProperties
                    }
                  >
                    {ch}
                  </span>
                ))}
              </span>
            );
          }

          // Halves parting: the first half of the line comes in from the left
          // of centre, the second half from the right, so the words divide the
          // way the current does underneath them.
          // Small on purpose. An earlier pass moved the halves 26 to 44px and
          // mid-entrance the two halves of the line overlapped each other,
          // which reads as a rendering fault if a reader stops on that flick.
          const jx =
            entrance === "part" ? `${(w < words.length / 2 ? 1 : -1) * (12 + r() * 10)}px` : "0px";

          return (
            <span
              key={w}
              className="w"
              style={{ "--th": th, "--jx": jx, marginRight: "0.26em" } as React.CSSProperties}
            >
              {word}
            </span>
          );
        })}
      </span>
    </>
  );
}
