"use client";

import { useEffect, useRef, useState } from "react";
import { useScroll } from "motion/react";

import { ASSET_PREFIX, BANDS, HERO_CTA, STATIC_HERO, CTA_HREF } from "@/content/site";
import { readColors, renderFlow } from "@/lib/flow";
import { Film } from "./film";
import { CTAGhost, CTAPrimary } from "./primitives";
import { Queue } from "./queue";
import { SplitHead } from "./split";

/**
 * The hero: 420vh of pinned scroll driving four stills and four bands of words
 * over them. The height is set in globals.css and it is a measured number, not
 * a guess: across a 2880px scrub span the four beats hold 6.3, 5.9, 5.7 and 5.1
 * full 120px flicks at full opacity, which is what a caption needs to survive a
 * real reader. Band four is the SHORTEST, not the longest — an earlier note
 * here had that backwards, from a harness that fired synthetic wheel events and
 * sampled during the eased loop. Measure dwell by stepping scrollTo directly.
 *
 * ── Two layers, and why both ──────────────────────────────────────────────
 * `film.tsx` holds four stills of one braided glacial delta, cross-faded by
 * the scroll: a confluence, then channels divided by dry bars, then the bars
 * drowning, then one current at rest with a single strand running rust. Unlike
 * the video this replaced, the pictures carry the argument themselves — each
 * one sits under the band of copy that names it.
 *
 * The canvas over them is now a texture rather than a statement. It stays held
 * back until about 0.6 and comes up to a little over half strength, but what
 * it adds across the last third is movement over a still frame, not the
 * register: frame four already IS the register, and drawing rows over a
 * photograph of rows reads as dirt on the lens.
 *
 * ── The drive loop ────────────────────────────────────────────────────────
 * Scroll never writes straight to the render. It sets `target`; a rAF loop
 * eases `shown` toward it and REST when converged and when the hero is off
 * screen. The easing is dt-normalised to a 60fps reference, so a 120Hz machine
 * converges at the same speed as a 60Hz one instead of feeling twice as tight.
 * Every write is delta-gated: the canvas redraws only when the frame actually
 * changed, and a band's opacity and assembly variable are only touched when
 * they differ from what is already on the node.
 *
 * ── The five static-hero gates ────────────────────────────────────────────
 * Phones, portrait tablets, coarse-pointer portrait, landscape phones and
 * reduced motion get a composed still instead. The query strings live in
 * `GATES` below and are repeated character for character in globals.css. They
 * are evaluated live through change listeners, not once at load, because a
 * tablet rotating or a window being maximised past 720px otherwise leaves the
 * CSS showing a scrub stage that the JS never armed.
 */

const GATES = [
  "(max-width: 720px)",
  "(orientation: portrait) and (max-width: 1024px)",
  "(orientation: portrait) and (pointer: coarse)",
  "(orientation: landscape) and (pointer: coarse) and (max-height: 560px)",
  "(prefers-reduced-motion: reduce)",
];

const clamp = (v: number, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
const smoothstep = (p: number, a: number, b: number) => {
  const t = clamp((p - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cueRef = useRef<HTMLDivElement>(null);
  const bandRefs = useRef<(HTMLDivElement | null)[]>([]);
  const frameRef = useRef<HTMLDivElement>(null);
  const layerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [film, setFilm] = useState(false);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  /* Whether the three later frames are worth fetching. They are only ever seen
     by a reader who can actually scrub, so they are asked for exactly where the
     scrub stage runs and never on a metered connection. Everywhere else frame
     one stays on its own, which is a finished hero rather than a degraded one.
     Far cheaper than the video this replaced — 568KB of WebP against 6.3MB —
     but the gate is still right: nobody should pay for what they cannot see. */
  useEffect(() => {
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (conn?.saveData) return;
    // Live, like the gates below it. Asked once at mount, a tablet rotated into
    // landscape or a window dragged past 720px would be shown the scrub stage
    // by CSS with no film behind it. One way only: once the file is in memory,
    // rotating back and forth should not throw it away and fetch it again.
    const mqls = GATES.map((q) => window.matchMedia(q));
    const apply = () => {
      if (!mqls.some((m) => m.matches)) setFilm(true);
    };
    mqls.forEach((m) => m.addEventListener("change", apply));
    apply();
    return () => mqls.forEach((m) => m.removeEventListener("change", apply));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let colors = readColors(stage);
    let w = 0;
    let h = 0;
    let target = 0;
    let shown = 0;
    let drawn = -1;
    let raf: number | null = null;
    let last = 0;
    let armed = false;
    let onScreen = true;

    /* ── Painting ─────────────────────────────────────────────────────── */

    /* The register surfaces late. Before 0.6 the canvas is empty, so the first
       three beats are the footage and nothing else; across the last third it
       rises to a little over half strength, which is enough for the rows and
       the two late ones to read and not enough to look drawn on. */
    const draw = (p: number) => {
      if (Math.abs(p - drawn) < 0.0008) return; // delta gate: the canvas is the expensive one
      drawn = p;
      const alpha = 0.62 * smoothstep(p, 0.6, 0.88);
      if (alpha < 0.004) {
        ctx.clearRect(0, 0, w, h);
        return;
      }
      renderFlow({ ctx, w, h, p, colors, ground: false, alpha });
    };

    // Cached per-band state, so a converged band costs zero DOM writes.
    const cache = BANDS.map(() => ({ op: -1, k: -1 }));

    /* Band one opens settled. The band pattern already skips its opacity
       ease-in, but that alone leaves its `--k` at zero, so at scroll zero the
       hero would show footage with unassembled words until the visitor moved.
       It gets a one-time, time-based ramp on load that hands over to scroll:
       k = max(scrollK, loadK). Once loadK reaches 1 the max holds it settled,
       which is right for the opening beat, since there is nothing above it to
       scroll back to. Every later band stays purely scroll-driven. */
    let loadK = 0;
    let loadT0 = 0;
    let loadRaf: number | null = null;
    let loadRan = false;
    const runLoad = (now: number) => {
      if (!loadT0) loadT0 = now;
      const e = Math.min(1, (now - loadT0) / 820);
      loadK = e * e * (3 - 2 * e);
      paintBands(shown);
      loadRaf = e < 1 ? requestAnimationFrame(runLoad) : null;
    };

    /* ── The four frames ─────────────────────────────────────────────────
       Scroll position picks the frame. Each of the four stills sits under one
       band of copy, and they cross-fade over the GAPS between bands, so the
       picture is only ever changing while the words are too. Fully settled
       under every band, in transition only between them.

       Frame 1 is the base layer and never fades; 2, 3 and 4 ride on top, each
       fully covering the ones beneath at full opacity, so there is no moment
       where the stage shows through a seam.

       The stops are the midpoints of the three band gaps in `content/site.ts`
       ([0,0.22] [0.24,0.47] [0.49,0.72] [0.74,1]). Move the bands and these
       move with them, or a frame will change under a settled headline. */
    const STOPS = [0.23, 0.48, 0.73];
    const FADE = 0.05; // half-width: a 0.10 ramp, about 290px of scroll

    const layerOp = [-1, -1, -1];
    const paintFrames = (p: number) => {
      const els = layerRefs.current;
      if (!els) return;
      for (let i = 0; i < STOPS.length; i++) {
        const el = els[i + 1];
        if (!el) continue;
        const op = Math.round(smoothstep(p, STOPS[i] - FADE, STOPS[i] + FADE) * 1000) / 1000;
        if (op === layerOp[i]) continue; // delta gate, same as the bands
        layerOp[i] = op;
        el.style.opacity = String(op);
      }
    };

    /* The frame itself keeps a slow push over the whole hero, under the
       footage's own motion rather than competing with it. The scale never goes
       below the drift, so an edge can never come into shot. */
    let frameTr = "";
    const paintFrame = (p: number) => {
      const el = frameRef.current;
      if (!el) return;
      const scale = Math.round((1.06 - 0.03 * p) * 1000) / 1000;
      // Down as the scroll goes down: the camera agrees with the current.
      const ty = Math.round((-1.2 + 2.4 * p) * 100) / 100;
      const tr = `scale(${scale}) translate3d(0,${ty}%,0)`;
      if (tr === frameTr) return;
      frameTr = tr;
      el.style.transform = tr;
    };

    const paintFilm = (p: number) => {
      paintFrame(p);
      paintFrames(p);
    };

    const paintBands = (p: number) => {
      BANDS.forEach((band, i) => {
        const el = bandRefs.current[i];
        if (!el) return;
        const [a, b] = band.range;
        const f = Math.min(0.02, (b - a) / 3);
        // The first band skips the ease-in and the last skips the ease-out, so
        // the journey opens and closes on words that are already settled.
        const inEdge = i === 0 ? 1 : smoothstep(p, a, a + f);
        const outEdge = i === BANDS.length - 1 ? 1 : 1 - smoothstep(p, b - f, b);
        const op = Math.round(inEdge * outEdge * 1000) / 1000;
        // Assembly settles about a fifth of the way into the band, leaving the
        // long fully-settled plateau a reader can flick past without losing it.
        const ramp = Math.min(0.03, (b - a) * 0.35);
        const scrollK = clamp((p - a) / ramp);
        const k = Math.round((i === 0 ? Math.max(scrollK, loadK) : scrollK) * 100) / 100;

        const c = cache[i];
        if (op !== c.op) {
          c.op = op;
          el.style.opacity = String(op);
          // A fully faded band must not eat clicks from the one over it.
          el.style.visibility = op < 0.02 ? "hidden" : "visible";
        }
        if (k !== c.k) {
          c.k = k;
          el.style.setProperty("--k", String(k));
        }
      });

      const cue = cueRef.current;
      if (cue) {
        const op = Math.round((1 - smoothstep(p, 0.01, 0.08)) * 100) / 100;
        if (cue.style.opacity !== String(op)) cue.style.opacity = String(op);
      }
    };

    /* ── The loop that rests ──────────────────────────────────────────── */

    const tick = (now: number) => {
      const dt = Math.min(100, now - (last || now));
      last = now;
      const k = 0.18; // smoothing per 60fps frame, tuned by feel while scrubbing
      shown += (target - shown) * (1 - Math.pow(1 - k, dt / 16.667));
      if (Math.abs(target - shown) < 0.0004) {
        shown = target;
        raf = null;
        last = 0;
      } else {
        raf = requestAnimationFrame(tick);
      }
      draw(shown);
      paintFilm(shown);
      paintBands(shown);
    };

    const kick = () => {
      if (raf === null && armed && onScreen) raf = requestAnimationFrame(tick);
    };

    /* ── Sizing. Device pixels capped at 2: a 3x phone would quadruple the
          fill cost for a difference nobody can see on hairlines. ───────── */

    const resize = () => {
      const r = stage.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(1, Math.round(r.width));
      h = Math.max(1, Math.round(r.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      colors = readColors(stage);
      drawn = -1;
      draw(shown);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(stage);

    /* ── Arming, and the gates ────────────────────────────────────────── */

    const progress = () => scrollYProgress.get();

    const arm = () => {
      if (armed) return;
      armed = true;
      resize();
      target = progress();
      shown = target;
      drawn = -1;
      cache.forEach((c) => {
        c.op = -1;
        c.k = -1;
      });
      frameTr = "";
      layerOp[0] = layerOp[1] = layerOp[2] = -1;
      draw(shown);
      paintFilm(shown);
      paintBands(shown);
      if (!loadRan) {
        loadRan = true;
        loadRaf = requestAnimationFrame(runLoad);
      }
    };

    const disarm = () => {
      if (!armed) return;
      armed = false;
      if (raf !== null) {
        cancelAnimationFrame(raf);
        raf = null;
      }
    };

    const mqls = GATES.map((q) => window.matchMedia(q));
    const applyMode = () => (mqls.some((m) => m.matches) ? disarm() : arm());
    mqls.forEach((m) => m.addEventListener("change", applyMode));

    const io = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        if (onScreen) kick();
        else if (raf !== null) {
          cancelAnimationFrame(raf);
          raf = null;
        }
      },
      { rootMargin: "10% 0px" },
    );
    io.observe(stage);

    const unsub = scrollYProgress.on("change", (v) => {
      target = v;
      kick();
    });

    applyMode();

    /* The poster and social-card renderer drives the film through this, so the
       still that ships is a real frame of what the visitor scrolls. */
    (window as unknown as { __flow?: (p: number) => void }).__flow = (p: number) => {
      arm();
      target = p;
      shown = p;
      drawn = -1;
      draw(p);
      paintFilm(p);
      paintBands(p);
    };

    return () => {
      unsub();
      if (loadRaf !== null) cancelAnimationFrame(loadRaf);
      io.disconnect();
      ro.disconnect();
      mqls.forEach((m) => m.removeEventListener("change", applyMode));
      disarm();
    };
  }, [scrollYProgress, film]);

  return (
    <section ref={sectionRef} className="hero relative">
      {/* ── The scrub stage. Hidden by CSS at the five gates. ─────────── */}
      {/* The poster sits under the canvas as a CSS background. The canvas fills
          itself opaquely on its first paint, so this is only ever seen if the
          canvas never paints at all: script disabled, a 2D context refused, an
          old browser. That state is a composed hero rather than a void, which
          is the whole point of testing it. */}
      <div
        className="hero-scrub sticky top-0 h-[100svh] overflow-hidden bg-cover bg-center"
        ref={stageRef}
        style={{ backgroundImage: `url(${ASSET_PREFIX}/scene/hero-river.jpg)` }}
      >
        <Film frameRef={frameRef} layerRefs={layerRefs} loaded={film} />
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />

        {BANDS.map((band, i) => {
          const settle = band.entrance === "settle";
          return (
            <div
              key={band.id}
              ref={(el) => {
                bandRefs.current[i] = el;
              }}
              style={{ opacity: i === 0 ? 1 : 0 }}
              className="absolute inset-0 flex items-center"
            >
              <div className="mx-auto grid w-full max-w-[92rem] grid-cols-1 items-center gap-10 px-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] lg:px-12">
                <div className="u-band relative max-w-[38rem]">
                  {band.eyebrow ? (
                    <p className="u-chip u-mono mb-5 inline-block px-3 py-1.5 text-[0.6875rem] tracking-[0.14em] text-fg-muted uppercase">
                      {band.eyebrow}
                    </p>
                  ) : null}
                  <h1
                    className="u-display text-[clamp(2rem,4.1vw,3.75rem)] leading-[1.04]"
                    style={{ "--wdth": 92 } as React.CSSProperties}
                  >
                    <SplitHead text={band.head} entrance={band.entrance} />
                  </h1>
                  <p
                    className={`${settle ? "sub" : ""} mt-5 max-w-[46ch] text-[1.0625rem] leading-relaxed`}
                    style={{ color: "var(--ink-onfilm)" }}
                  >
                    {band.sub}
                  </p>
                  {settle ? (
                    <div className="row mt-8 flex flex-wrap items-center gap-3">
                      <CTAPrimary href={CTA_HREF} className="u-btn">
                        {HERO_CTA.primary}
                      </CTAPrimary>
                      <CTAGhost href="#mechanism" className="u-btn">
                        {HERO_CTA.secondary}
                      </CTAGhost>
                    </div>
                  ) : null}
                </div>

                {/* The queue only exists in the settle band, where the canvas
                    has already arranged itself into its rows. */}
                {settle ? <Queue className="row hidden lg:block" /> : <div aria-hidden />}
              </div>
            </div>
          );
        })}

        <div
          ref={cueRef}
          aria-hidden
          className="u-mono absolute inset-x-0 bottom-7 flex flex-col items-center gap-2 text-[0.625rem] tracking-[0.2em] text-fg-muted uppercase"
        >
          Scroll
          <span className="block h-8 w-px bg-[color:color-mix(in_oklab,var(--fg)_28%,transparent)]" />
        </div>
      </div>

      {/* ── The composed still. Shown by CSS at the same five gates, and it is
            a designed layout rather than an apology for the other one. ─── */}
      <div className="hero-static relative min-h-[86svh] items-center overflow-hidden">
        {/* The poster is a real frame of the film, rendered by the same code.
            The gradient sits under it as a second layer rather than as a
            fallback rule, so a missing or slow poster is invisible instead of
            leaving the still hero on a flat field. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center opacity-60"
          style={{
            backgroundImage: `url(${ASSET_PREFIX}/scene/hero-river.jpg), radial-gradient(120% 90% at 50% -10%, #ffffff 0%, var(--canvas) 46%, #dfe9e6 100%)`,
          }}
        />
        {/* The still hero gets the same legibility treatment the scrub hero
            gets, and it needs it more: a phone crops the poster to its busiest
            band, so without this the current runs straight through the
            headline. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, color-mix(in oklab, var(--canvas) 88%, transparent) 0%, color-mix(in oklab, var(--canvas) 72%, transparent) 45%, color-mix(in oklab, var(--canvas) 92%, transparent) 100%)",
          }}
        />
        <div className="relative mx-auto w-full max-w-[74rem] px-6 py-24 sm:px-8">
          <p className="u-chip u-mono mb-5 inline-block px-3 py-1.5 text-[0.6875rem] tracking-[0.14em] text-fg-muted uppercase">
            {STATIC_HERO.eyebrow}
          </p>
          <h1
            className="u-display text-[clamp(2.25rem,8vw,3.5rem)]"
            style={{ "--wdth": 92 } as React.CSSProperties}
          >
            {STATIC_HERO.head}
          </h1>
          <p className="mt-5 max-w-[42ch] text-[1.0625rem] leading-relaxed text-fg-muted">
            {STATIC_HERO.sub}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <CTAPrimary href={CTA_HREF}>{STATIC_HERO.cta}</CTAPrimary>
            <CTAGhost href="#mechanism">{HERO_CTA.secondary}</CTAGhost>
          </div>
          <Queue className="mt-10 max-w-[26rem]" />
        </div>
      </div>
    </section>
  );
}
