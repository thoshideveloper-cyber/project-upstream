import { ArrowRight } from "lucide-react";

import { MotionSection } from "@/components/motion-section";
import { CTA_HREF } from "@/content/site";
import { Container, CTAGhost, CTAPrimary, DisplayHeading, Eyebrow } from "./primitives";

/**
 * An illustration of the product — one team's Tuesday, drawn to scale.
 *
 * The figures are small and internally consistent (the strip sums to the queue,
 * LATE matches the two overdue rows) so the panel reads as a screenshot rather
 * than decoration. Organisation and person names are deliberate placeholders; no
 * number here is a claim about what any customer's pipeline looks like.
 */
const ROWS = [
  { days: "12d", tone: "over", company: "Northwind Materials", meta: "Acme Group · Jane Doe", pill: "Interested", pillTone: "blue", live: true },
  { days: "5d", tone: "over", company: "Contoso Industrial", meta: "Contoso Group · John Roe", pill: "Overdue", pillTone: "over", live: false },
  { days: "Today", tone: "due", company: "Globex Systems", meta: "Acme Group · Alex Doe", pill: "Due today", pillTone: "due", live: false },
  { days: "+9d", tone: "ok", company: "Initech Labs", meta: "Initech Ventures · Sam Roe", pill: "Contacted", pillTone: "slate", live: false },
] as const;

const DAYS = [
  { label: "ALL", n: "38", tone: "muted" },
  { label: "LATE", n: "2", tone: "over" },
  { label: "TODAY", n: "1", tone: "due" },
  { label: "SOON", n: "6", tone: "muted" },
  { label: "AHEAD", n: "29", tone: "new" },
] as const;

const toneText: Record<string, string> = {
  over: "text-destructive",
  due: "text-primary-ink",
  ok: "text-muted-foreground",
  muted: "text-muted-foreground",
  new: "text-[oklch(0.65_0.18_270)]",
  blue: "text-[oklch(0.65_0.18_270)]",
  slate: "text-muted-foreground",
};

const pillClass: Record<string, string> = {
  over: "border-destructive/30 bg-destructive/10 text-destructive",
  due: "border-primary/30 bg-primary/10 text-primary-ink",
  blue: "border-[oklch(0.65_0.18_270/0.3)] bg-[oklch(0.65_0.18_270/0.12)] text-[oklch(0.72_0.16_270)]",
  slate: "border-border bg-foreground/[0.03] text-muted-foreground",
};

export function Hero() {
  return (
    <MotionSection className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-28">
      {/* Ambient spotlight + dotted-ledger backdrop */}
      <div aria-hidden className="mkt-grid pointer-events-none absolute inset-0 opacity-60" />
      <div aria-hidden className="mkt-spot absolute -top-24 left-[52%] size-[42rem]" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background"
      />

      <Container className="relative">
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          {/* Copy */}
          <div>
            <Eyebrow>Sourcing, outreach and relationship memory</Eyebrow>
            <DisplayHeading as="h1" className="mt-5">
              Find them. Reach them.
              <br />
              Never lose what you learned.
            </DisplayHeading>
            <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-muted-foreground text-pretty">
              Upstream runs the whole loop on one record — a shared registry of the organisations
              you&apos;re working, a cadence that keeps the follow-ups honest, and relationship
              memory that stays with the team when the people move on.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <CTAPrimary href={CTA_HREF}>
                Book a demo
                <ArrowRight className="size-4" />
              </CTAPrimary>
              <CTAGhost href={CTA_HREF}>See the live demo</CTAGhost>
            </div>

            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] tracking-[0.15em] text-muted-foreground uppercase">
              <li className="flex items-center gap-1.5">
                <span className="size-1 rounded-full bg-primary" /> Append-only log
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-1 rounded-full bg-primary" /> Server-computed cadence
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-1 rounded-full bg-primary" /> Cross-project memory
              </li>
            </ul>
          </div>

          {/* Signature: the live outreach queue */}
          <div className="mkt-sheen mkt-elev rounded-2xl border border-border bg-card/70 p-1.5 backdrop-blur-sm">
            <div className="rounded-xl border border-border/60 bg-background/60">
              {/* Panel header */}
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="mkt-live size-1.5 rounded-full bg-primary" />
                  <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                    Outreach queue · Today
                  </span>
                </div>
                <span className="font-mono text-[10px] tracking-[0.15em] text-muted-foreground">
                  Your timezone
                </span>
              </div>

              {/* Day strip */}
              <div className="flex items-stretch gap-px border-b border-border/60 bg-border/40">
                {DAYS.map((d) => (
                  <div key={d.label} className="flex-1 bg-background/80 px-2 py-2.5 text-center">
                    <div className="font-mono text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
                      {d.label}
                    </div>
                    <div className={`mt-0.5 font-mono text-base font-semibold ${toneText[d.tone]}`}>{d.n}</div>
                  </div>
                ))}
              </div>

              {/* Cadence rows */}
              <ul className="divide-y divide-border/50">
                {ROWS.map((r) => (
                  <li key={r.company} className="flex items-center gap-3 px-4 py-3">
                    <span className={`w-10 shrink-0 font-mono text-xs font-semibold tabular-nums ${toneText[r.tone]}`}>
                      {r.days}
                    </span>
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      {/* A flag, not a heartbeat: the header dot is the one pulse
                          in the hero — two rhythms above the fold competed. */}
                      {r.live && (
                        <span className="size-1.5 shrink-0 rounded-full bg-destructive ring-2 ring-destructive/20" />
                      )}
                      <span className="min-w-0">
                        <span className="block truncate font-display text-[15px] leading-tight font-medium text-foreground">
                          {r.company}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">{r.meta}</span>
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-medium ${pillClass[r.pillTone]}`}
                    >
                      {r.pill}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Footer stat */}
              <div className="flex items-center justify-between border-t border-border/60 px-4 py-2.5">
                <span className="font-mono text-[10px] tracking-[0.15em] text-muted-foreground">
                  2 overdue · clear the backlog first
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-medium text-primary-ink">
                  Work the queue
                  <ArrowRight className="size-3" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </MotionSection>
  );
}
