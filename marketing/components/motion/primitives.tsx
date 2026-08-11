"use client";

import { useEffect, useRef, useState } from "react";
import {
  MotionConfig,
  animate,
  motion,
  useInView,
  useReducedMotion,
  type Variants,
} from "motion/react";

import { cn } from "@/lib/utils";

/**
 * The page's motion vocabulary, decided once.
 *
 * The previous version ran entrances through CSS scroll timelines
 * (`animation-timeline: view()`). That was a defensible bet, but it meant the
 * choreography silently did nothing in every browser without scroll timelines,
 * and it put a second animation system beside the JS one, so "how does a
 * section arrive" had two answers. Motion owns arrival now. CSS keeps only the
 * things it is genuinely better at: the grain plate, the ruled ground, the
 * pointer beacon and the one looping dot.
 *
 * Rules this file exists to enforce:
 *
 *  1. **One curve for arrival.** Expo-out. A page where every section eases
 *     differently reads as several pages.
 *  2. **Arrival is small.** 16px and an opacity. Anything larger competes with
 *     the reading, and on a long page it becomes seasickness.
 *  3. **Once.** Entrances do not replay on scroll-up. Re-running an entrance is
 *     how a page starts to feel like a slideshow.
 *  4. **Springs are for input, curves are for arrival.** If a human caused it,
 *     it springs. If the scroll caused it, it eases.
 *  5. **Reduced motion is handled at the root** by <Choreography>, so no
 *     component below has to remember. Only count-ups check for themselves,
 *     because a number counting is content, not transform.
 */

/** Expo-out. Arrival, everywhere. */
export const EASE = [0.16, 1, 0.3, 1] as const;
/** Interactive feel: pressed controls, the nav capsule, the tab indicator. */
export const SPRING = { type: "spring", stiffness: 420, damping: 38, mass: 0.9 } as const;
/** A softer spring for anything large enough that 420 would look nervous. */
export const SOFT_SPRING = { type: "spring", stiffness: 180, damping: 28, mass: 1 } as const;

/** When a section counts as "arrived". Late enough to be deliberate. */
const VIEWPORT = { once: true, amount: 0.15, margin: "0px 0px -8% 0px" } as const;

/**
 * Root wrapper. `reducedMotion="user"` makes Motion drop transform and layout
 * animations for anyone who asked, while keeping opacity, which is the correct
 * reading of the preference: they want less movement, not less information.
 */
export function Choreography({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.6, ease: EASE }}>
      {children}
    </MotionConfig>
  );
}

/* ------------------------------------------------------------------ *
 * Arrival
 * ------------------------------------------------------------------ */

const riseVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  shown: { opacity: 1, y: 0 },
};

/** A block arriving. The default entrance, and deliberately unremarkable. */
export function Rise({
  children,
  className,
  delay = 0,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "li" | "figure" | "aside";
}) {
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      variants={riseVariants}
      initial="hidden"
      whileInView="shown"
      viewport={VIEWPORT}
      transition={{ duration: 0.7, ease: EASE, delay }}
    >
      {children}
    </Tag>
  );
}

/**
 * A list whose items cascade. The stagger is small on purpose: 60ms reads as
 * one gesture arriving, 150ms reads as items being dealt out one at a time,
 * which is charming exactly once and irritating on the fourth section.
 */
export function Cascade({
  children,
  className,
  gap = 0.06,
  delay = 0,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  gap?: number;
  delay?: number;
  as?: "div" | "ul" | "ol" | "dl";
}) {
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial="hidden"
      whileInView="shown"
      viewport={VIEWPORT}
      variants={{ shown: { transition: { staggerChildren: gap, delayChildren: delay } } }}
    >
      {children}
    </Tag>
  );
}

/** One item inside a <Cascade>. */
export function CascadeItem({
  children,
  className,
  as = "div",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "li" | "article" | "tr";
  style?: React.CSSProperties;
}) {
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      style={style}
      variants={riseVariants}
      transition={{ duration: 0.65, ease: EASE }}
    >
      {children}
    </Tag>
  );
}

/**
 * A heading revealed line by line from behind its own baseline.
 *
 * Each line sits in a clipping box and slides up into it, which is the one
 * entrance on the page that is allowed to be theatrical, because it happens
 * once and it is the first thing anyone sees. Lines are passed in explicitly
 * rather than measured: automatic line-splitting breaks the moment the text
 * wraps differently at another breakpoint, and it destroys the text node that
 * screen readers and search engines want.
 *
 * `text` is required and is not optional politeness. The visible lines are
 * `aria-hidden`, so without a real string *inside* the heading element the
 * heading is empty to assistive technology, which axe reports as `empty-heading`
 * and a screen-reader user experiences as a page whose h1 says nothing. It has
 * to be a child of the tag, not a sibling: an sr-only span next to the heading
 * leaves the heading itself just as empty.
 */
export function MaskedLines({
  lines,
  text,
  className,
  lineClassName,
  delay = 0,
  as: Tag = "h1",
}: {
  lines: React.ReactNode[];
  /** The heading's real text, for assistive tech and for search. */
  text: string;
  className?: string;
  lineClassName?: string;
  delay?: number;
  as?: "h1" | "h2" | "p";
}) {
  const reduced = useReducedMotion();
  return (
    <Tag className={className}>
      <span className="sr-only">{text}</span>
      {lines.map((line, i) => (
        <span key={i} aria-hidden className={cn("block overflow-hidden", lineClassName)}>
          <motion.span
            className="block"
            initial={reduced ? { opacity: 0 } : { y: "108%" }}
            animate={reduced ? { opacity: 1 } : { y: "0%" }}
            transition={{
              duration: reduced ? 0.4 : 1,
              ease: EASE,
              delay: delay + i * 0.09,
            }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}

/* ------------------------------------------------------------------ *
 * Instruments
 * ------------------------------------------------------------------ */

/**
 * A number that counts to itself when it arrives.
 *
 * Only used on the hero's triage strip, where the figures are a queue draining
 * and the counting *is* the claim. Counting a number that is not about elapsed
 * work is decoration, so nothing else on the page does it. Under reduced motion
 * the final value renders immediately, because the number is information.
 */
export function Counter({
  to,
  className,
  duration = 1.1,
  delay = 0,
}: {
  to: number;
  className?: string;
  duration?: number;
  delay?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduced = useReducedMotion();
  const [value, setValue] = useState(reduced ? to : 0);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setValue(to);
      return;
    }
    const controls = animate(0, to, {
      duration,
      delay,
      ease: EASE,
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, reduced, to, duration, delay]);

  return (
    <span ref={ref} className={className}>
      {value}
    </span>
  );
}

/**
 * A hairline that draws itself across as its section arrives.
 *
 * The page is built out of rules, so the rules are what announce a section
 * rather than a card sliding in. Origin is the left edge, the way a line is
 * ruled onto a page.
 */
export function DrawnRule({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <motion.span
      aria-hidden
      className={cn("block h-px w-full origin-left bg-border", className)}
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 0.9, ease: EASE, delay }}
    />
  );
}

export { motion, useReducedMotion };
