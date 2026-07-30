"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";

/** Live subscription to the user's reduced-motion preference. */
export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

/**
 * Eased count-up. Animates from its previous value on change (0 on mount) with an
 * ease-out-cubic curve; snaps instantly when reduced-motion is requested. This is
 * the shared desk motion primitive — the Outreach desk's deadline rail and the
 * Sourcing desk's fit rail both count up through it so the two pages read as one
 * instrument family.
 */
export function AnimatedNumber({
  value,
  delay = 0,
  duration = 460,
  className,
  style,
}: {
  value: number;
  delay?: number;
  duration?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const to = value;
    const from = fromRef.current;
    if (reduced || from === to) {
      setDisplay(to);
      fromRef.current = to;
      return;
    }
    let raf = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now + delay;
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, delay, duration, reduced]);

  return (
    <span className={className} style={style}>
      {display}
    </span>
  );
}
