"use client";

import { useCallback, useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

/**
 * A surface whose edge lights where the pointer is.
 *
 * This replaces the old `hover-lift`: a 1px border paired with a 30px-blur drop
 * shadow, translating the panel 3px up on hover. That treatment was applied to
 * every card in every grid, so three consecutive sections read as one repeated
 * rectangle — and border-plus-wide-soft-shadow is the ghost-card tell besides.
 *
 * Nothing moves here. The pointer position is written to the node as custom
 * properties inside a rAF, so a mousemove never costs a React render; the paint
 * itself is a masked radial gradient in `.mkt-lit` (globals.css). Keyboard users
 * get the same light via `:focus-within`, centred on the default 50%/0%.
 */
export function Lit({
  children,
  className,
  style,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  as?: "div" | "article" | "li" | "figure" | "section";
}) {
  const ref = useRef<HTMLElement>(null);
  const raf = useRef(0);

  const onMove = useCallback((e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || raf.current) return;
    const { clientX, clientY } = e;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--px", `${((clientX - r.left) / r.width) * 100}%`);
      el.style.setProperty("--py", `${((clientY - r.top) / r.height) * 100}%`);
    });
  }, []);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  return (
    // @ts-expect-error — one ref type across the union of tags we render.
    <Tag ref={ref} onPointerMove={onMove} style={style} className={cn("mkt-lit", className)}>
      {children}
    </Tag>
  );
}
