"use client";

import { useEffect, useRef } from "react";

import { readColors, renderFlow } from "@/lib/flow";

/**
 * One frame of the hero's film, painted at a fixed size.
 *
 * This exists so the poster, the social card and the ambient loop are the SAME
 * scene as the hero rather than separate artwork that drifts out of step with
 * it the first time the palette moves. The render harness in
 * `scripts/render-assets.mjs` drives this through `window.__still`, which is
 * also how the loop is recorded straight off the canvas.
 */
export function FlowStill({
  p,
  width,
  height,
  className,
}: {
  p: number;
  width: number;
  height: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const colors = readColors(canvas.parentElement ?? document.body);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const paint = (at: number) =>
      renderFlow({ ctx, w: width, h: height, p: at, colors, fadeOut: false });
    paint(p);

    // The harness drives the same canvas to record the loop.
    (window as unknown as { __still?: (at: number) => void }).__still = paint;
  }, [p, width, height]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={className}
      style={{ width: `${width}px`, height: `${height}px` }}
    />
  );
}
