"use client";

import { useCallback, useRef } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";

import { CTA_HREF } from "@/content/site";
import { cn } from "@/lib/utils";
import { EASE, MaskedLines } from "@/components/motion/primitives";
import { Container, CTAGhost, CTALink, Dot, Readout, Section } from "./primitives";

/**
 * The ask.
 *
 * Deliberately small. The brief's adoption plan is design partners, not
 * self-serve, and the way that starts is with an ask a partner can say yes to
 * in a meeting without asking anyone else: one mandate, run beside the
 * spreadsheet it came from, with an explicit condition for failure. Naming the
 * condition is the risk reversal. "If the analyst still opens the sheet after a
 * week, we have not earned the rest" is a harder promise to make than a free
 * trial, and a far easier one to believe.
 *
 * No durations are promised anywhere here, because how long a rollout takes
 * depends on the team, and a number invented for a landing page is the first
 * thing a rollout disproves.
 *
 * This is also the page's one centred fold. Everything above it is left-aligned
 * on the stamp rail, so centring here is a change of posture at exactly the
 * moment the page stops explaining and starts asking. Doing it twice would just
 * be a page that cannot decide.
 */
export function Closing() {
  return (
    <Section id="closing" rhythm="loose" className="relative overflow-clip">
      <div
        aria-hidden
        className="mkt-rules pointer-events-none absolute inset-0 [mask-image:radial-gradient(60%_60%_at_50%_40%,black,transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 size-[40rem] -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, oklch(0.72 0.16 58 / 0.16), transparent 65%)" }}
      />

      <Container className="relative text-center">
        <Readout tone="signal" className="block">
          The first step is deliberately small
        </Readout>

        <MaskedLines
          as="h2"
          text="Bring one mandate. Keep the spreadsheet open."
          className="mkt-display mx-auto mt-7 max-w-[16ch] text-[clamp(2.3rem,5.4vw,4.25rem)] text-foreground"
          lineClassName="mx-auto"
          lines={[
            "Bring one mandate.",
            <span key="turn" className="mkt-turn">
              Keep the spreadsheet open.
            </span>,
          ]}
        />

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.2 }}
          className="mx-auto mt-7 max-w-[52ch] text-[15px] leading-relaxed text-muted-foreground text-pretty md:text-base"
        >
          We migrate one live mandate and run it beside the sheet it came from. If the analyst on
          it still opens the sheet after a week, we have not earned the rest.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.32 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          <MagneticCTA href={CTA_HREF}>
            Book a demo
            <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
          </MagneticCTA>
          <CTAGhost href={CTA_HREF}>See the live demo</CTAGhost>
        </motion.div>

        {/* The quiet third option. Not everyone who reaches the bottom is ready
            to talk to a person, and the alternative to a demo is an answer. */}
        <CTALink href="#faq" className="mt-7 justify-center text-muted-foreground">
          Read the objections first
        </CTALink>

        <ul className="mx-auto mt-12 flex max-w-3xl flex-wrap items-center justify-center gap-x-8 gap-y-3 border-t border-border pt-8">
          {["A live walkthrough", "We migrate your sheets", "One mandate first"].map((r) => (
            <li key={r} className="flex items-center gap-2">
              <Dot />
              <Readout>{r}</Readout>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}

/**
 * The page's one magnetic control.
 *
 * It leans toward the pointer by at most six pixels. That is enough for a hand
 * to notice and not enough for anyone to name, which is the whole point: it
 * makes the final button feel like an object rather than a rectangle. It is
 * used exactly once, on the last ask. A page where every button chases the
 * cursor is a page where nothing is emphasised.
 *
 * Skipped entirely for reduced motion and for coarse pointers, where there is
 * no hover to respond to and the transform would only fire on tap.
 */
function MagneticCTA({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const reduced = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, { stiffness: 260, damping: 22, mass: 0.4 });
  const y = useSpring(my, { stiffness: 260, damping: 22, mass: 0.4 });

  const onMove = useCallback(
    (e: React.PointerEvent) => {
      if (reduced || e.pointerType !== "mouse" || !ref.current) return;
      const r = ref.current.getBoundingClientRect();
      mx.set(((e.clientX - (r.left + r.width / 2)) / r.width) * 12);
      my.set(((e.clientY - (r.top + r.height / 2)) / r.height) * 8);
    },
    [mx, my, reduced],
  );

  const reset = useCallback(() => {
    mx.set(0);
    my.set(0);
  }, [mx, my]);

  return (
    <motion.div style={{ x, y }} className="inline-flex">
      <Link
        ref={ref}
        href={href}
        prefetch={false}
        onPointerMove={onMove}
        onPointerLeave={reset}
        onBlur={reset}
        className={cn(
          "group inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground",
          "shadow-[0_1px_0_0_oklch(1_0_0/0.25)_inset,0_14px_34px_-16px_oklch(0.72_0.16_58/1)]",
          "transition-colors duration-200 hover:bg-primary/90",
          className,
        )}
      >
        {children}
      </Link>
    </motion.div>
  );
}
