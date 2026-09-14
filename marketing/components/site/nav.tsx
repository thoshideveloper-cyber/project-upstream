"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { CTA_HREF, NAV } from "@/content/site";
import { cn } from "@/lib/utils";

/**
 * The mark: two streams joining into one and running down.
 *
 * It is the product in a glyph. Every mandate the desk runs is its own current
 * and they all end up in one record, which is the thing this whole page is
 * about, and it is the same shape the channel in the margin makes when it forks
 * at the record fold, read the other way up.
 */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden fill="none">
      <path
        d="M4 2.5C4 7 10 7.5 10 11.5V17.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M16 2.5C16 7 10 7.5 10 11.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * The nav.
 *
 * Transparent over the hero, because a bar with its own background sitting on
 * the film is the first thing that makes a page look assembled from parts. It
 * takes a ground and a hairline once the reader has left the hero, which is
 * also the moment the links start pointing at things above them.
 */
export function SiteNav() {
  const [landed, setLanded] = useState(false);
  const [deep, setDeep] = useState(false);
  const [here, setHere] = useState("");

  useEffect(() => {
    // The page changes ground once, in the middle. A bar painted in the surface
    // colour sitting on top of the deep act is the loudest possible seam, so
    // the bar asks, on every scroll, which act is currently underneath it and
    // takes that act's tokens. Two rects per event, which is nothing.
    const deeps = () => Array.from(document.querySelectorAll<HTMLElement>(".u-deep"));
    let cached = deeps();

    // Which fold the reader is in. Measured against one line two fifths down
    // the viewport rather than against the top edge, so the link changes when
    // the new fold has actually arrived in front of them and not when its first
    // pixel clears the bar. One line crosses exactly one fold, so there is
    // never a tie to break.
    const ids = NAV.map((n) => n.href).filter((h) => h.startsWith("#"));
    let marks = ids.map((h) => document.getElementById(h.slice(1)));

    const onScroll = () => {
      setLanded(window.scrollY > window.innerHeight * 0.6);
      if (cached.length === 0) cached = deeps();
      if (marks.every((m) => m === null)) marks = ids.map((h) => document.getElementById(h.slice(1)));

      const line = window.innerHeight * 0.4;
      let found = "";
      for (let i = 0; i < marks.length; i++) {
        const el = marks[i];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.top <= line && r.bottom > line) {
          found = ids[i];
          break;
        }
      }
      setHere(found);

      setDeep(
        cached.some((el) => {
          const r = el.getBoundingClientRect();
          // The last deep fold fades back to mist over its final 160px, so it
          // stops LOOKING dark before it stops BEING dark. Counting those
          // pixels leaves a dark bar floating over a light page on the way
          // out, which is the one seam the surfacing gradient exists to avoid.
          const tail = el.classList.contains("u-surfacing") ? 170 : 0;
          return r.top <= 64 && r.bottom - tail >= 64;
        }),
      );
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Nothing on the page should keep animating in a tab nobody is looking at.
  // `animation-play-state` is not inherited, so the rule this class triggers
  // has to reach every descendant and pseudo-element itself (see globals.css).
  useEffect(() => {
    const onVisibility = () =>
      document.body.classList.toggle("u-paused", document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      document.body.classList.remove("u-paused");
    };
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 transition-[background-color,border-color,backdrop-filter,color] duration-500",
        deep && "u-deep",
        landed ? "border-b border-hair backdrop-blur-md" : "border-b border-transparent",
      )}
      // Inline, not a utility: `.u-deep` sets its own `background`, and which of
      // the two wins would otherwise come down to stylesheet order.
      //
      // 94%, not 82%. At 82% a heading passing under the bar did not disappear,
      // it smeared: the blur turned dark type into a grey shape that sat there
      // looking like a rendering fault until it cleared. A bar you can almost
      // see through is worse than either an opaque one or a clear one, so this
      // is high enough to hide what goes under it and still low enough to keep
      // the tint of whichever act the bar is currently over.
      style={{
        zIndex: 40,
        background: landed ? "color-mix(in oklab, var(--canvas) 94%, transparent)" : "transparent",
      }}
    >
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 w-full max-w-[84rem] items-center gap-8 px-6 sm:px-8 lg:px-12"
      >
        <Link href="/" className="flex items-center gap-2.5">
          <Mark className="h-5 w-5 text-accent" />
          <span className="u-subhead text-[1.0625rem] tracking-tight">Upstream</span>
        </Link>

        <ul className="ml-auto hidden items-center gap-7 md:flex">
          {NAV.map((item) => {
            const on = here === item.href;
            return (
              <li key={item.href}>
                <a
                  href={item.href}
                  // Announced, not just coloured. The rule under it is the
                  // whole visual treatment: a pill or a filled tab would put a
                  // second piece of chrome on a bar that is trying to stay out
                  // of the film's way.
                  aria-current={on ? "true" : undefined}
                  className={cn(
                    "relative text-[0.875rem] transition-colors hover:text-fg",
                    on ? "text-fg" : "text-fg-muted",
                  )}
                >
                  {item.label}
                  {on ? (
                    <span
                      aria-hidden
                      className="absolute inset-x-0 -bottom-1.5 h-px bg-accent"
                    />
                  ) : null}
                </a>
              </li>
            );
          })}
        </ul>

        <Link
          href={CTA_HREF}
          // See CTAPrimary: the export's prefetch payload path and the router's
          // do not agree, so a prefetch here is a guaranteed 404.
          prefetch={false}
          className="u-target ml-auto rounded-md border border-hair px-3.5 py-2 text-[0.875rem] font-medium transition-colors hover:border-[color:color-mix(in_oklab,var(--accent)_50%,transparent)] hover:text-accent md:ml-0"
        >
          See it running
        </Link>
      </nav>
    </header>
  );
}
