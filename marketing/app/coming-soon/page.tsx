import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { UpstreamMark } from "@/components/brand/logo";
import { Container, CTAGhost, Display, Readout } from "@/components/marketing/primitives";

export const metadata: Metadata = {
  title: "Coming soon · Upstream",
  description: "Upstream is opening access shortly.",
};

/**
 * Where every CTA lands for now.
 *
 * The product app is a separate deployment and is not part of this release, so
 * "Book a demo" / "Sign in" resolve here rather than 404ing on a domain that
 * has no such route. Deliberately one screen with no form: collecting an
 * address would need a backend this deployment does not have, and a form that
 * silently discards what you typed is worse than no form.
 */
export default function ComingSoonPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden py-24">
      {/* The same ruled ground as the fold, so this reads as the same product
          rather than as an error page someone bolted on. */}
      <div
        aria-hidden
        className="mkt-rules pointer-events-none absolute inset-0 [mask-image:radial-gradient(55%_55%_at_50%_45%,black,transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 size-[38rem] -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, oklch(0.72 0.16 58 / 0.16), transparent 66%)" }}
      />

      <Container className="relative text-center">
        <Link
          href="/"
          className="mkt-subhead inline-flex items-center gap-2.5 text-xl text-foreground"
        >
          <UpstreamMark size={24} className="text-foreground" />
          Upstream
        </Link>

        <Readout tone="signal" className="mt-14 block">
          Not open yet
        </Readout>

        <Display as="h1" size="statement" className="mx-auto mt-6 max-w-2xl">
          Coming soon.
        </Display>

        <p className="mx-auto mt-6 max-w-[46ch] text-[15px] leading-relaxed text-muted-foreground text-pretty md:text-base">
          We are opening access to a small number of desks first. There is nothing to sign up for
          yet. Check back shortly.
        </p>

        <CTAGhost href="/" className="mt-10">
          <ArrowLeft className="size-4" />
          Back to the overview
        </CTAGhost>
      </Container>
    </main>
  );
}
