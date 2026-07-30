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
 * These were six identical cards in a 3×3, which on a section arguing "we are
 * not one module" said the opposite: six equal boxes, six equal things. The
 * bento gives the two that actually differentiate the product (finding the
 * names, and remembering them across projects) twice the room.
 *
 * Every panel is internally identical, and that part matters as much as the
 * sizing. The first attempt let the wide panels run their blurb and their list
 * side by side and vertically centred, so the six panels started their text at
 * six different heights and the grid read as broken rather than as composed.
 * Now all six run the same stack in the same order, top-aligned:
 *
 *     icon + title  →  blurb  →  rule  →  points
 *
 * The wide ones simply set their points in two columns, which uses the extra
 * width without moving anything off the shared baseline.
 */
const SPAN: Record<CapabilityGroup["icon"], string> = {
  search: "lg:col-span-4",
  send: "lg:col-span-2",
  users: "lg:col-span-2",
  network: "lg:col-span-4",
  gauge: "lg:col-span-3",
  lock: "lg:col-span-3",
};

/** The two that get the wide treatment. Same stack, points in two columns. */
const WIDE = new Set<CapabilityGroup["icon"]>(["search", "network"]);

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
          them, and what somebody here already found out last time.
        </p>

        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {CAPABILITY_GROUPS.map((g, i) => {
            const wide = WIDE.has(g.icon);
            return (
              <Panel
                key={g.title}
                className={`mkt-stagger ${SPAN[g.icon]} ${wide ? "sm:col-span-2" : ""}`}
                style={{ "--i": i } as React.CSSProperties}
              >
                <div className="flex items-center gap-3">
                  <IconChip icon={ICONS[g.icon]} />
                  <Subhead>{g.title}</Subhead>
                </div>

                <p className="mt-4 max-w-[46ch] text-sm leading-relaxed text-muted-foreground text-pretty">
                  {g.blurb}
                </p>

                <ul
                  className={`mt-5 space-y-2.5 border-t border-border pt-5 ${
                    wide ? "md:columns-2 md:gap-x-10 md:space-y-0 [&>li]:md:mb-2.5" : ""
                  }`}
                >
                  {g.points.map((p) => (
                    <Marker key={p}>{p}</Marker>
                  ))}
                </ul>
              </Panel>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}
