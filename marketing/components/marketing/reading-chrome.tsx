"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { CTA_HREF } from "@/content/site";
import { EASE } from "@/components/motion/primitives";

/**
 * The CTA that catches up.
 *
 * The hero's "Book a demo" is thousands of pixels behind by the time anyone has
 * read enough to want it, and on a phone the nav collapses to a hamburger, so
 * there is no persistent one at all. This surfaces once the fold is gone and
 * retires inside the closing panel, where a floating duplicate sitting on top
 * of the real button is worse than not being there.
 *
 * Below `lg` only. Above it the header keeps a permanent "Book a demo", so a
 * second floating copy of the same button is both redundant and a thing that
 * parks itself on top of the ledger's right-hand column.
 *
 * Bottom right, not bottom centre. Centred, it parks itself over the reading
 * column and covers a table row or a paragraph on every section it floats past,
 * which is a worse offence than being missed.
 *
 * The progress rail this file used to own moved onto the header's bottom edge,
 * where it belongs: two pieces of fixed chrome stacked at the top of a page is
 * one more than a page needs.
 */
export function ReadingChrome() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const closing = document.getElementById("closing");
        const closingTop = closing
          ? closing.getBoundingClientRect().top + window.scrollY
          : Number.POSITIVE_INFINITY;
        setShow(
          window.scrollY > window.innerHeight * 0.95 &&
            window.scrollY + window.innerHeight < closingTop + 240,
        );
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="fixed right-0 bottom-0 z-40 px-4 pb-4 sm:px-6 sm:pb-6 lg:hidden"
        >
          <Link
            href={CTA_HREF}
            prefetch={false}
            className="group inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground shadow-[0_12px_34px_-14px_oklch(0.55_0.03_265/0.6)] transition-colors duration-200 hover:bg-primary/90"
          >
            Book a demo
            <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
