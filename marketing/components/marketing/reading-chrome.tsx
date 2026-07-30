"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { CTA_HREF } from "@/content/site";
import { cn } from "@/lib/utils";

/**
 * Two pieces of persistent chrome for a page that is twelve thousand pixels long.
 *
 * **The progress rail.** A 2px amber line under the floating nav. On a page this
 * long the reader has no idea whether they are a third of the way in or nearly
 * out, and "how much more of this is there" is the question that closes tabs.
 * Driven by scroll position in a rAF against a transform, so it costs one
 * composited paint and never a layout.
 *
 * **The CTA that catches up.** The hero's "Book a demo" is thousands of pixels
 * behind by the time anyone has read enough to want it, and on a phone the nav
 * collapses to a hamburger so there is no persistent one at all. This surfaces
 * past the fold and retires inside the closing panel, where a duplicate CTA
 * floating over the real one would just be in the way.
 *
 * Both hide under `prefers-reduced-motion`? No: a progress indicator is
 * information, not decoration, so it stays. Only its transition is dropped, in
 * globals.css with everything else.
 */
export function ReadingChrome() {
  const railRef = useRef<HTMLSpanElement>(null);
  const raf = useRef(0);
  const [showCta, setShowCta] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      if (raf.current) return;
      raf.current = requestAnimationFrame(() => {
        raf.current = 0;
        const doc = document.documentElement;
        const max = doc.scrollHeight - window.innerHeight;
        const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
        if (railRef.current) railRef.current.style.transform = `scaleX(${p})`;

        // Show once past the fold; retire before the closing panel so the
        // floating button never sits on top of the real one.
        const closing = document.getElementById("closing");
        const closingTop = closing
          ? closing.getBoundingClientRect().top + window.scrollY
          : Number.POSITIVE_INFINITY;
        setShowCta(
          window.scrollY > window.innerHeight * 0.9 &&
            window.scrollY + window.innerHeight < closingTop + 200,
        );
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf.current);
    };
  }, []);

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-40 h-0.5 bg-transparent"
      >
        <span
          ref={railRef}
          className="block h-full origin-left scale-x-0 bg-primary/70 will-change-transform"
        />
      </div>

      {/* Bottom-*right*, not bottom-centre. Centred, it parks itself on top of
          the reading column and covers a table row or a paragraph on every
          section it floats over, which is a worse offence than being missed. */}
      <div
        className={cn(
          "pointer-events-none fixed right-0 bottom-0 z-40 flex justify-end px-4 pb-4 transition-all duration-300 sm:px-6 sm:pb-6",
          showCta ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
        )}
      >
        <Link
          href={CTA_HREF}
          prefetch={false}
          tabIndex={showCta ? 0 : -1}
          aria-hidden={!showCta}
          className={cn(
            "group inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground",
            "shadow-[0_10px_30px_-10px_oklch(0.55_0.03_265/0.5)] transition-transform duration-200 active:scale-[0.985]",
            showCta && "pointer-events-auto",
          )}
        >
          Book a demo
          <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </div>
    </>
  );
}
