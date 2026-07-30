import { HAS_LOGOS, LOGOS, SHOW_LOGO_SECTION } from "@/content/site";
import { Container, Readout, Section } from "./primitives";

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
    <Section rhythm="tight">
      <Container>
        <Readout className="block text-center">
          {HAS_LOGOS ? "The teams running on it" : "Customer wordmarks"}
        </Readout>

        {HAS_LOGOS ? (
          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-10 gap-y-5 md:gap-x-14">
            {LOGOS.map((logo) => (
              <span
                key={logo.name}
                className="mkt-subhead text-lg whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground"
              >
                {logo.name}
              </span>
            ))}
          </div>
        ) : (
          <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
            {/* Empty slots, not placeholder names — nothing here should be
                mistakable for a customer we have. */}
            {Array.from({ length: 5 }).map((_, i) => (
              <span
                key={i}
                aria-hidden
                className="h-9 w-28 rounded-md border border-dashed border-border sm:w-32"
              />
            ))}
            <span className="sr-only">No customer wordmarks published yet.</span>
          </div>
        )}
      </Container>
    </Section>
  );
}
