"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * A thin amber rail pinned to the top of the page that tracks how far the reader
 * has scrolled. Finds its own scroll container (the route template is the
 * scroller here, not the window), so it drops in on any page without wiring.
 */
export function ScrollProgress({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    let scroller: HTMLElement | null = node.parentElement;
    while (scroller) {
      const overflowY = getComputedStyle(scroller).overflowY;
      if ((overflowY === "auto" || overflowY === "scroll") && scroller.scrollHeight > scroller.clientHeight) {
        break;
      }
      scroller = scroller.parentElement;
    }
    if (!scroller) return;

    const target = scroller;
    const update = () => {
      const max = target.scrollHeight - target.clientHeight;
      setProgress(max > 0 ? Math.min(1, Math.max(0, target.scrollTop / max)) : 0);
    };
    update();
    target.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      target.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div ref={ref} className={cn("pointer-events-none sticky top-0 z-20 h-0.5", className)} aria-hidden>
      <div
        className="h-full origin-left rounded-full bg-gradient-to-r from-primary/30 via-primary to-primary/30 transition-transform duration-150 ease-out"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
}
