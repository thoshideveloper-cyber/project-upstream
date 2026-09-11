"use client";

import Link from "next/link";
import { useCallback, useRef } from "react";
import { motion, useInView, type Variants } from "motion/react";

import { cn } from "@/lib/utils";

/**
 * The page's motion and layout vocabulary, decided once.
 *
 * Rules this file exists to enforce:
 *
 *  1. **One curve for arrival.** Expo-out, everywhere. A page where every
 *     section eases differently reads as several pages stapled together.
 *  2. **Arrival is small.** 14px and an opacity. Anything bigger competes with
 *     the reading, and over nine folds it becomes seasickness.
 *  3. **Once.** Entrances never replay on scroll-up. Replaying is what makes a
 *     page feel like a slideshow rather than a document.
 *  4. **Springs are for input, curves are for arrival.** A human caused it, it
 *     springs. The scroll caused it, it eases.
 *  5. **Reduced motion is handled at the root** by <Choreography>, so nothing
 *     below has to remember to check.
 */

/** Expo-out. Arrival. */
export const EASE = [0.16, 1, 0.3, 1] as const;
/** Pressed controls and anything a pointer is directly moving. */
export const SPRING = { type: "spring", stiffness: 420, damping: 38, mass: 0.9 } as const;

/** Late enough to be deliberate, early enough that nothing arrives mid-read. */
const VIEWPORT = { once: true, amount: 0.18, margin: "0px 0px -6% 0px" } as const;

const rise: Variants = {
  rest: { opacity: 0, y: 14 },
  in: { opacity: 1, y: 0 },
};

/** One item. `delay` is for the rare hand-placed beat; prefer <Stagger>. */
export function Reveal({
  children,
  className,
  delay = 0,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "li" | "section" | "p" | "span";
}) {
  const Cmp = motion[as] as typeof motion.div;
  return (
    <Cmp
      variants={rise}
      initial="rest"
      whileInView="in"
      viewport={VIEWPORT}
      transition={{ duration: 0.62, ease: EASE, delay }}
      className={className}
    >
      {children}
    </Cmp>
  );
}

/**
 * A group that arrives in sequence. Children opt in with <StaggerItem>.
 * The stagger is the whole reason the loss list reads as a list of separate
 * events rather than one block appearing.
 */
export function Stagger({
  children,
  className,
  step = 0.075,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  step?: number;
  as?: "div" | "ul" | "ol" | "dl";
}) {
  const Cmp = motion[as] as typeof motion.div;
  return (
    <Cmp
      initial="rest"
      whileInView="in"
      viewport={VIEWPORT}
      variants={{ in: { transition: { staggerChildren: step } } }}
      className={className}
    >
      {children}
    </Cmp>
  );
}

export function StaggerItem({
  children,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "li" | "dt" | "dd";
}) {
  const Cmp = motion[as] as typeof motion.div;
  return (
    <Cmp variants={rise} transition={{ duration: 0.62, ease: EASE }} className={className}>
      {children}
    </Cmp>
  );
}

/** Is this element on screen yet? For the few places that need the boolean. */
export function useArrived<T extends Element>(ref: React.RefObject<T | null>) {
  return useInView(ref, VIEWPORT);
}

/* ------------------------------------------------------------------ *
 * Layout
 * ------------------------------------------------------------------ */

/**
 * The measure. 1180px of content inside a 1440 window, with the left gutter
 * reserved on wide screens for the channel, which is the page's spine and is
 * not allowed to overlap anything it runs beside.
 */
export function Container({
  children,
  className,
  wide = false,
}: {
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-6 sm:px-8 lg:px-12",
        wide ? "max-w-[92rem]" : "max-w-[74rem]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** The one repeating structural device: a mono label naming a machine fact. */
export function Stamp({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("u-stamp", className)}>{children}</span>;
}

/* ------------------------------------------------------------------ *
 * Controls
 * ------------------------------------------------------------------ */

const btnBase =
  "u-target inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 text-[0.9375rem] font-medium transition-[transform,background-color,border-color,color] duration-200 active:translate-y-px";

/**
 * The one call to action. Solid in the fold's accent, with paper-coloured ink
 * on it, which is the way round that measures 5.2:1 rather than the 3.1:1 that
 * white-on-warm would have given.
 */
export function CTAPrimary({
  children,
  href,
  className,
}: {
  children: React.ReactNode;
  href: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      // Not prefetched. The static export writes this route's prefetch payload
      // to a nested path (`__next.route/__PAGE__.txt`) while the client router
      // asks for a flat one (`__next.route.__PAGE__.txt`), so every one of
      // these buttons entering the viewport fires a 404 on the deployed site.
      // The destination is one small page; prefetching it was never worth a
      // request, let alone a failing one.
      prefetch={false}
      className={cn(
        btnBase,
        "bg-accent text-[color:var(--paper)] hover:bg-[color:color-mix(in_oklab,var(--accent)_86%,black)]",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/** The second action. A hairline, never a second solid button. */
export function CTAGhost({
  children,
  href,
  className,
}: {
  children: React.ReactNode;
  href: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      // Not prefetched. The static export writes this route's prefetch payload
      // to a nested path (`__next.route/__PAGE__.txt`) while the client router
      // asks for a flat one (`__next.route.__PAGE__.txt`), so every one of
      // these buttons entering the viewport fires a 404 on the deployed site.
      // The destination is one small page; prefetching it was never worth a
      // request, let alone a failing one.
      prefetch={false}
      className={cn(
        btnBase,
        "border border-hair text-fg hover:border-[color:color-mix(in_oklab,var(--accent)_50%,transparent)] hover:text-accent",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/**
 * Pointer-tracked edge light. The panel does not move; light crosses its
 * border where the pointer is. Coordinates are written straight to the node as
 * custom properties, so a mousemove never costs a React render.
 */
export function Lit({
  children,
  className,
  as: As = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "li" | "article";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--px", `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty("--py", `${((e.clientY - r.top) / r.height) * 100}%`);
  }, []);
  return (
    <As ref={ref as never} onMouseMove={onMove} className={cn("u-lit", className)}>
      {children}
    </As>
  );
}
