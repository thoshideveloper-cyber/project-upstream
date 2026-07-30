"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A <section> that says whether it is on screen, so the looping animation it owns
 * can stop when nobody is looking at it (`[data-motion="off"]` in globals.css).
 *
 * Unlike <Reveal> this is *not* reveal-once — it toggles both ways for the life of
 * the page. Under prefers-reduced-motion it never observes and never claims to be
 * on, because those loops are switched off entirely anyway.
 */
export function MotionSection({
  children,
  className,
  id,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
  "aria-label"?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setOn(entry.isIntersecting);
      },
      // A margin either side so a loop is already running by the time it's read.
      { rootMargin: "200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={ref} id={id} aria-label={ariaLabel} data-motion={on ? "on" : "off"} className={className}>
      {children}
    </section>
  );
}
