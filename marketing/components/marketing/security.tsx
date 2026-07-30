"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";

import { Container, Marker, Readout, Section, SectionHead } from "./primitives";

const PROOF = [
  "httpOnly, Secure cookies. No token is ever readable from the browser",
  "Refresh tokens rotate, and revoke server-side. Log out everywhere at once",
  "Firm-scoped at the query, so an analyst cannot address a mandate they are not on",
  "Nothing is deleted. Records are archived, which is also why history survives",
  "Password hashes never leave the server",
];

const CHARS = "0123456789ABCDEF·/\\<>{}[]=+*";
const randomString = (len: number) =>
  Array.from({ length: len }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join("");

// Deterministic seed so server and client first-render match (the layer is hidden
// until it's asked for, at which point the glyphs start churning).
const SEED = Array.from({ length: 1400 }, (_, i) => CHARS[(i * 31) % CHARS.length]).join("");

/**
 * Evervault-style encrypted card: hex glyphs surface through an amber mask.
 *
 * The cursor drives the mask through CSS custom properties written straight to the
 * node inside a rAF, and the glyphs churn on their own 110 ms timer — the previous
 * version re-rendered React and rebuilt a 1,400-character random string on *every*
 * mousemove event.
 *
 * It is also a button, because "hover to decrypt" was unreachable by keyboard or
 * touch: Enter/Space/tap pins the reveal open, and focus alone previews it.
 */
function EncryptedCard() {
  const ref = useRef<HTMLButtonElement>(null);
  const glyphRef = useRef<HTMLParagraphElement>(null);
  const raf = useRef(0);
  const [pinned, setPinned] = useState(false);
  const [active, setActive] = useState(false);

  const onMove = useCallback((e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || raf.current) return;
    const { clientX, clientY } = e;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${((clientX - r.left) / r.width) * 100}%`);
      el.style.setProperty("--my", `${((clientY - r.top) / r.height) * 100}%`);
    });
  }, []);

  // Churn the ciphertext only while the layer is actually visible.
  useEffect(() => {
    if (!active && !pinned) return;
    const id = setInterval(() => {
      if (glyphRef.current) glyphRef.current.textContent = randomString(1400);
    }, 110);
    return () => clearInterval(id);
  }, [active, pinned]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={pinned}
      aria-label={pinned ? "Hide the encrypted layer" : "Reveal the encrypted layer"}
      onClick={() => setPinned((v) => !v)}
      onPointerMove={onMove}
      onPointerEnter={() => setActive(true)}
      onPointerLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
      data-open={active || pinned ? "" : undefined}
      className="mkt-decrypt group relative aspect-square w-full max-w-md overflow-hidden rounded-xl border border-border bg-background text-left"
    >
      {/* dotted-ledger base */}
      <span aria-hidden className="mkt-grid absolute inset-0 opacity-40" />

      {/* encrypted reveal layer */}
      <span aria-hidden className="mkt-decrypt-layer absolute inset-0">
        <span className="absolute inset-0 bg-gradient-to-br from-primary via-[oklch(0.62_0.2_35)] to-[oklch(0.55_0.18_310)]" />
        <p
          ref={glyphRef}
          className="absolute inset-0 h-full break-words p-3 font-mono text-[10px] leading-[1.05] font-medium tracking-wider text-black/60 mix-blend-overlay"
        >
          {SEED}
        </p>
      </span>

      {/* center lockup */}
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <span className="inline-flex size-16 items-center justify-center rounded-xl border border-border bg-card/80 backdrop-blur-sm transition-transform duration-300 group-hover:scale-95">
          <ShieldCheck aria-hidden strokeWidth={1.5} className="size-7 text-primary" />
        </span>
        <Readout tone="ink">Secure by default</Readout>
        <span className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground">
          {pinned ? "tap to re-encrypt" : "hover or tap to decrypt"}
        </span>
      </span>
    </button>
  );
}

export function Security() {
  return (
    <Section id="security" className="relative overflow-clip">
      {/* The spectrum. A wide amber field that travels and bends its hue as the
          section scrolls, so the light behind the ciphertext resolves the same
          way the ciphertext does. Scroll-driven in CSS (see globals.css); on a
          browser without scroll timelines it renders as a static amber wash,
          which is what it was before. */}
      <div
        aria-hidden
        /* No negative z-index. The section is `relative` with `z-index: auto`,
           so it establishes no stacking context, and `-z-10` sent this behind
           the opaque <body> background where it was invisible. Plain positioned
           + DOM order puts it under the Container below, which is what was
           wanted. */
        className="mkt-spectrum pointer-events-none absolute -inset-x-32 -top-40 -bottom-40"
      />

      <Container className="relative">
        <div className="grid items-center gap-12 md:grid-cols-2 lg:gap-16">
          <div>
            {/* The second of the page's two kickers, and it earns it: this
                section names a category the reader is scanning for. */}
            <SectionHead title="Who you are talking to is the whole secret.">
              A live buyer list is the most commercially sensitive thing a desk holds. It was
              locked down at the data model, not bolted on before a security review.
            </SectionHead>
            {/* One list marker on the page — the per-item icons here were a third
                chip size and a second bullet language. */}
            <ul className="mt-8 space-y-3">
              {PROOF.map((text) => (
                <Marker key={text}>{text}</Marker>
              ))}
            </ul>
          </div>

          <div className="flex justify-center md:justify-end">
            <EncryptedCard />
          </div>
        </div>
      </Container>
    </Section>
  );
}
