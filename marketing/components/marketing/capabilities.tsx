import { Gauge, Lock, Network, Search, Send, Users, type LucideIcon } from "lucide-react";

import { CAPABILITY_GROUPS, type CapabilityGroup } from "@/content/site";
import {
  Card,
  CardTitle,
  CheckItem,
  Container,
  IconChip,
  Section,
  SectionIntro,
} from "./primitives";

/**
 * Everything the product does that the three screenshot tabs above don't show:
 * sourcing, send-and-log, contact memory, cross-project memory, oversight and
 * governance.
 *
 * Deliberately screenshot-free — a tab without a real product shot would have to
 * invent one. Three points per card, hard limit: this is the section most likely
 * to turn into a wall of text.
 */
const ICONS: Record<CapabilityGroup["icon"], LucideIcon> = {
  search: Search,
  send: Send,
  users: Users,
  network: Network,
  gauge: Gauge,
  lock: Lock,
};

export function Capabilities() {
  return (
    <Section id="capabilities">
      <Container>
        <SectionIntro eyebrow="The whole surface" title="Not a scheduler. The record the team works from.">
          Sending is one part of it. The rest is where the names come from, who you know inside
          them, and what the team already learned last time.
        </SectionIntro>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITY_GROUPS.map((g) => (
            <Card key={g.title}>
              <IconChip icon={ICONS[g.icon]} />
              <CardTitle className="mt-5">{g.title}</CardTitle>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground text-pretty">
                {g.blurb}
              </p>
              <ul className="mt-5 space-y-3 border-t border-border/60 pt-5">
                {g.points.map((p) => (
                  <CheckItem key={p}>{p}</CheckItem>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  );
}
