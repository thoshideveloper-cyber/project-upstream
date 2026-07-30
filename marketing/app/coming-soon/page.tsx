import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { UpstreamMark } from "@/components/brand/logo";
import { Container, DisplayHeading, Eyebrow } from "@/components/marketing/primitives";

export const metadata: Metadata = {
  title: "Coming soon — Upstream",
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
          className="inline-flex items-center gap-2 font-display text-xl font-medium tracking-tight text-foreground"
          style={{ letterSpacing: "-0.01em" }}
        >
          <UpstreamMark size={24} className="text-foreground" />
          Upstream
        </Link>

        <div className="mt-12 flex justify-center">
          <Eyebrow>Not open yet</Eyebrow>
        </div>

        <DisplayHeading as="h1" className="mx-auto mt-5 max-w-2xl">
          Coming soon.
        </DisplayHeading>

        <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground text-pretty">
          We&apos;re opening access to a small number of teams first. Nothing to sign up for
          yet — check back shortly.
        </p>

        <Link
          href="/"
          className="mt-10 inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-border bg-foreground/[0.02] px-5 text-sm font-medium tracking-tight text-foreground transition-all duration-200 hover:border-primary/40 hover:bg-foreground/[0.05]"
        >
          <ArrowLeft className="size-4" />
          Back to the overview
        </Link>
      </Container>
    </main>
  );
}
