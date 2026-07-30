import { INTEGRATIONS } from "@/content/site";
import { Container, Readout, Section } from "./primitives";

/**
 * What Upstream plugs into, in the band that used to hold five dashed grey
 * rectangles under the label CUSTOMER WORDMARKS.
 *
 * That band was trying to be honest about having no logos yet, and instead
 * announced it. This says something true and useful in the same space: the
 * question a reader has at this point is "does this fit the way we already
 * work", and every cell here answers it with a fact from the build.
 *
 * Deliberately typographic. Vendor logos here would be borrowed credibility of a
 * different kind, and half of them are trademarked besides.
 */
export function Integrations() {
  return (
    <Section rhythm="tight" aria-label="What Upstream works with">
      <Container>
        <Readout className="block text-center">Works with what you already use</Readout>

        <ul className="mt-8 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-5">
          {INTEGRATIONS.map((it) => (
            <li key={it.name} className="bg-background px-4 py-5 text-center">
              <p className="mkt-subhead text-[15px] text-foreground">{it.name}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground text-pretty">
                {it.detail}
              </p>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          No relay, no shared sending domain. Mail leaves from your address, on your reputation.
        </p>
      </Container>
    </Section>
  );
}
