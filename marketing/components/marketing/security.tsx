"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";

import { CheckItem, Container, Section, SectionIntro } from "./primitives";

const PROOF = [
  "httpOnly, Secure cookies — no tokens ever touch the browser",
  "Rotating refresh tokens, revocable server-side — log out everywhere",
  "Organisation-scoped — people see only the projects they're on",
  "Soft-delete only — records are archived, never destroyed",
  "Password hashes never leave the server",
];

const CHARS = "0123456789ABCDEF·—/\\<>{}[]=+*";
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
      className="mkt-decrypt group relative aspect-square w-full max-w-md overflow-hidden rounded-2xl border border-border bg-background text-left"
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
        <span className="inline-flex size-16 items-center justify-center rounded-2xl border border-border bg-card/80 backdrop-blur-sm transition-transform duration-300 group-hover:scale-95">
          <ShieldCheck aria-hidden className="size-7 text-primary" />
        </span>
        <span className="font-mono text-[11px] tracking-[0.2em] text-foreground/80 uppercase">
          Secure by default
        </span>
        <span className="font-mono text-[10px] tracking-[0.15em] text-muted-foreground">
          {pinned ? "tap to re-encrypt" : "hover or tap to decrypt"}
        </span>
      </span>
    </button>
  );
}

export function Security() {
  return (
    <Section id="security">
      <Container>
        <div className="grid items-center gap-12 md:grid-cols-2 lg:gap-16">
          <div>
            <SectionIntro
              eyebrow="Security"
              title={<>Built for data you can&apos;t afford to leak.</>}
            >
              Who you&apos;re talking to is commercially sensitive. That record is locked down by
              default, not bolted down later.
            </SectionIntro>
            {/* One list marker on the page — the per-item icons here were a third
                chip size and a second bullet language. */}
            <ul className="mt-8 space-y-3">
              {PROOF.map((text) => (
                <CheckItem key={text}>{text}</CheckItem>
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
