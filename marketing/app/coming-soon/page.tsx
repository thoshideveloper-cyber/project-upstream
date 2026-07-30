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
 * The product app is a separate deployment and isn't part of this release, so
 * "Book a demo" / "Sign in" resolve here rather than 404ing on a domain that has
 * no such route. Deliberately one screen with no form — collecting an address
 * would need a backend this deployment doesn't have.
 */
export default function ComingSoonPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden py-24">
      {/* Same backdrop as the hero, so this reads as the same product. */}
      <div aria-hidden className="mkt-grid pointer-events-none absolute inset-0 opacity-60" />
      <div aria-hidden className="mkt-spot absolute -top-24 left-1/2 size-[42rem] -translate-x-1/2" />

      <Container className="relative text-center">
        <Link
          href="/"
          className="mkt-subhead inline-flex items-center gap-2.5 text-xl font-semibold text-foreground"
        >
          <UpstreamMark size={24} className="text-foreground" />
          Upstream
        </Link>

        <Readout tone="signal" className="mt-12 block">
          Not open yet
        </Readout>

        <Display as="h1" className="mx-auto mt-5 max-w-2xl">
          Coming soon.
        </Display>

        <p className="mx-auto mt-5 max-w-[46ch] text-[15px] leading-relaxed text-muted-foreground text-pretty md:text-base">
          We&apos;re opening access to a small number of teams first. Nothing to sign up for
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
