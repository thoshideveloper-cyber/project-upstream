import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";

import { APP_URL } from "@/content/site";
import { Mark } from "@/components/site/nav";
import { CTAGhost, Stamp } from "@/components/site/primitives";

export const metadata: Metadata = {
  title: "Coming soon · Upstream",
  description: "Upstream is opening access shortly.",
};

/**
 * Where every call to action lands.
 *
 * The product app is a separate deployment on its own domain, so "See it
 * running" resolves here rather than 404ing on a domain that has no such
 * route. Deliberately one screen with no form: collecting an address needs a
 * backend this deployment does not have, and a form that silently discards
 * what you typed is worse than no form.
 *
 * It does carry the real link, in second place and told plainly. The app is
 * live and there is no reason to pretend otherwise, but it opens on a login
 * screen, so it is offered to people who already have an account rather than
 * dressed up as a demo anyone can walk into.
 */
export default function ComingSoonPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden py-24">
      {/* The same water the landing page stands on, so this reads as one
          product rather than as a page somebody bolted on. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 30%, color-mix(in oklab, var(--accent) 12%, transparent), transparent 70%)",
        }}
      />

      <div className="relative mx-auto w-full max-w-[40rem] px-6 text-center">
        <Link href="/" className="u-subhead inline-flex items-center gap-2.5 text-[1.125rem]">
          <Mark className="h-5 w-5 text-accent" />
          Upstream
        </Link>

        <Stamp className="mt-14 block">Not open yet</Stamp>

        <h1 className="u-display mt-5 text-[clamp(2rem,6vw,3.25rem)]">Coming soon.</h1>

        <p className="mx-auto mt-6 max-w-[46ch] leading-relaxed text-fg-muted">
          We are opening access to a small number of desks first. There is nothing to sign up for
          yet. Check back shortly.
        </p>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <CTAGhost href="/">
            <ArrowLeft className="size-4" />
            Back to the overview
          </CTAGhost>
        </div>

        {/* Below the fold of the sentence above, on purpose. This is the door
            for people who were given a key, not a second call to action. */}
        <div className="mx-auto mt-14 max-w-[34rem] border-t border-hair pt-8">
          <p className="u-mono text-[0.8125rem] text-fg-muted">
            Already have an account?{" "}
            <a
              href={APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="u-target inline-flex items-center gap-1 text-accent underline decoration-[color:color-mix(in_oklab,var(--accent)_40%,transparent)] underline-offset-4 hover:decoration-current"
            >
              Open the app
              <ArrowUpRight className="size-3.5" aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
