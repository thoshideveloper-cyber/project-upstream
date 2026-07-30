import { Gauge, Lock, Network, Search, Send, Users, type LucideIcon } from "lucide-react";

import { CAPABILITY_GROUPS, type CapabilityGroup } from "@/content/site";
import { Container, IconChip, Marker, Panel, Section, SectionHead, Subhead } from "./primitives";

const ICONS: Record<CapabilityGroup["icon"], LucideIcon> = {
  search: Search,
  send: Send,
  users: Users,
  network: Network,
  gauge: Gauge,
  lock: Lock,
};

/**
 * Everything the product does that the three screenshot tabs above don't show.
 *
 * These were six identical cards in a 3×3 — the single most generic layout on
 * the page and, on a section whose whole argument is "we are not one module",
 * the one that most contradicted its own copy: six equal boxes say six equal
 * things. The bento gives the two that actually differentiate the product
 * (finding the names, and remembering them across projects) twice the room, and
 * the supporting four half of it. Size is the argument.
 */
const SPAN: Record<CapabilityGroup["icon"], string> = {
  search: "lg:col-span-4",
  send: "lg:col-span-2",
  users: "lg:col-span-2",
  network: "lg:col-span-4",
  gauge: "lg:col-span-3",
  lock: "lg:col-span-3",
};

/** The two that get the wide treatment: points beside the blurb, not under it. */
const LEAD = new Set<CapabilityGroup["icon"]>(["search", "network"]);

export function Capabilities() {
  return (
    <Section id="capabilities">
      <Container>
        <SectionHead
          variant="statement"
          title="Not a scheduler. The record the whole team works from."
        />
        <p className="mt-6 max-w-[62ch] text-[15px] leading-relaxed text-muted-foreground text-pretty md:text-base">
          Sending is one part of it. The rest is where the names come from, who you know inside
          them, and what the team already learned last time.
        </p>

        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {CAPABILITY_GROUPS.map((g, i) => {
            const lead = LEAD.has(g.icon);
            return (
              <Panel
                key={g.title}
                className={`mkt-stagger ${SPAN[g.icon]} ${lead ? "sm:col-span-2 md:p-7" : ""}`}
                style={{ "--i": i } as React.CSSProperties}
              >
                <div className="flex items-center gap-3">
                  <IconChip icon={ICONS[g.icon]} />
                  <Subhead className={lead ? "text-xl" : undefined}>{g.title}</Subhead>
                </div>

                {/* `my-auto` on the wide panels: a bento row stretches every cell
                    to the tallest, and a two-column body top-aligned in a 310px
                    cell leaves a visible void underneath. Centring it in the
                    leftover space makes the extra height read as air, not as a
                    panel that ran out of things to say. */}
                <div
                  className={
                    lead
                      ? "mt-5 grid gap-x-10 gap-y-5 md:my-auto md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:items-center"
                      : "mt-4"
                  }
                >
                  <p
                    className={`leading-relaxed text-muted-foreground text-pretty ${
                      lead ? "text-[15px]" : "text-sm"
                    }`}
                  >
                    {g.blurb}
                  </p>
                  <ul className={lead ? "space-y-2.5" : "mt-4 space-y-2.5 border-t border-border pt-4"}>
                    {g.points.map((p) => (
                      <Marker key={p}>{p}</Marker>
                    ))}
                  </ul>
                </div>
              </Panel>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}
