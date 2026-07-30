import { HAS_LOGOS, LOGOS, SHOW_LOGO_SECTION } from "@/content/site";
import { BandLabel, Container, Section } from "./primitives";

/**
 * Customer wordmarks, read from LOGOS.
 *
 * The band keeps its place while LOGOS is empty: it renders slots rather than
 * names, so the structure is visibly waiting for real content instead of
 * asserting customers we don't have. SHOW_TEMPLATE_SLOTS = false drops it.
 *
 * Same band rhythm as the loop strip below it — the two read as a pair.
 */
export function LogoCloud() {
  if (!SHOW_LOGO_SECTION) return null;

  return (
    <Section band>
      <Container>
        <BandLabel>{HAS_LOGOS ? "The teams running on it" : "Customer wordmarks"}</BandLabel>

        {HAS_LOGOS ? (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 md:gap-x-12">
            {LOGOS.map((logo) => (
              <span
                key={logo.name}
                className="font-display text-lg font-medium tracking-tight whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground/80"
                style={{ letterSpacing: "-0.01em" }}
              >
                {logo.name}
              </span>
            ))}
          </div>
        ) : (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {/* Empty slots, not placeholder names — nothing here should be
                mistakable for a customer we have. */}
            {Array.from({ length: 5 }).map((_, i) => (
              <span
                key={i}
                aria-hidden
                className="h-9 w-32 rounded-lg border border-dashed border-border bg-foreground/[0.015]"
              />
            ))}
            <span className="sr-only">No customer wordmarks published yet.</span>
          </div>
        )}
      </Container>
    </Section>
  );
}
