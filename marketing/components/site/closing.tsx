"use client";

import { useEffect, useRef, useState } from "react";

import { ASSET_PREFIX, CLOSING, CTA_HREF } from "@/content/site";
import { Fold } from "./fold";
import { CTAGhost, CTAPrimary, Reveal, Stamp } from "./primitives";

/**
 * The closing: the page surfaces again.
 *
 * The two folds above are underwater, so this one coming back to the light is
 * the resolution of the arc rather than just another band. The channel runs off
 * the bottom of it instead of stopping, because the record does not stop when
 * the reader does.
 *
 * The ambient loop behind it is the one video file on the page, and it is
 * loaded on purpose rather than by default:
 *
 *  - it never loads for reduced motion, for a coarse pointer, or on a metered
 *    connection (`saveData`), because a decorative background is the first
 *    thing that should not cost a visitor their data,
 *  - it is `preload="none"` until those checks pass,
 *  - and the poster underneath it is a real frame of the same scene, so the
 *    fold is finished and correct whether the video arrives, fails, or is
 *    never asked for.
 */
export function Closing() {
  const ref = useRef<HTMLVideoElement>(null);
  const [play, setPlay] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (reduced || coarse || conn?.saveData) return;
    setPlay(true);
  }, []);

  // Starts when the fold is actually on screen, not when the page loads: a
  // background clip that has already played before anybody scrolled to it has
  // cost the visitor a megabyte for nothing.
  useEffect(() => {
    if (!play) return;
    const v = ref.current;
    if (!v) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        v.src = `${ASSET_PREFIX}/current-loop.webm`;
        v.load();
        // A rejected autoplay is normal, not an error worth a console line.
        v.play().catch(() => {});
      },
      { rootMargin: "0px 0px -20% 0px" },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [play]);

  return (
    <Fold variant="mouth" stamp="the whole book" bleed className="py-32 lg:py-44">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        style={{ maskImage: "linear-gradient(to bottom, transparent, black 24%, black 76%, transparent)" }}
      >
        <div
          className="absolute inset-0 bg-cover bg-center opacity-70"
          style={{ backgroundImage: `url(${ASSET_PREFIX}/current-still.jpg)` }}
        />
        {/* It plays once and rests. The clip's last frame is exactly the still
            underneath it, so when it finishes there is nothing to see happen,
            and a looping flow field would have shown its seam every 12
            seconds.

            Client-only, on purpose. The element is useless in the server HTML:
            it carries no src until an effect has checked reduced motion, the
            pointer and saveData, so shipping it in the markup buys nothing and
            costs two things. It makes the decorative video the first <video> a
            page-level browser extension finds, and several of them inject a
            speed-control panel next to it before React hydrates, which reads
            as a hydration mismatch in this component and is not one. And it
            puts a media element in the document for every visitor including
            the ones who will never be shown it. */}
        {play ? (
          <video
            ref={ref}
            muted
            playsInline
            preload="none"
            aria-hidden
            tabIndex={-1}
            className="absolute inset-0 h-full w-full object-cover opacity-70"
            onError={() => setPlay(false)}
          />
        ) : null}
      </div>

      {/* The only centred fold on the page. Every other one is left-aligned
          against the channel, so centring here reads as arrival rather than as
          a change of mind. */}
      <Reveal className="mx-auto max-w-[46rem] text-center">
        <Stamp>{CLOSING.eyebrow}</Stamp>
        <h2 className="u-display mt-4 text-[clamp(2rem,4.4vw,3.5rem)] leading-[1.03]">
          {CLOSING.head}
        </h2>
        <p className="mx-auto mt-6 max-w-[50ch] text-[1.0625rem] leading-relaxed text-fg-muted">
          {CLOSING.lede}
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <CTAPrimary href={CTA_HREF}>{CLOSING.primary}</CTAPrimary>
          <CTAGhost href="#mechanism">{CLOSING.secondary}</CTAGhost>
        </div>
      </Reveal>
    </Fold>
  );
}
