import { LOGOS, SHOW_LOGO_SECTION } from "@/content/site";
import { Container, Readout, Section } from "./primitives";

/**
 * Customer wordmarks, read from LOGOS, and absent entirely while it is empty.
 *
 * The previous version held its place with five dashed grey rectangles under the
 * label CUSTOMER WORDMARKS, so the page announced the thing it was trying to be
 * discreet about. The band is now the compatibility strip in
 * `integrations.tsx`, which says something factual in the same slot. Add names
 * here (with permission) and this returns above it.
 */
export function LogoCloud() {
  if (!SHOW_LOGO_SECTION) return null;

  return (
    <Section rhythm="tight">
      <Container>
        <Readout className="block text-center">The teams running on it</Readout>
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
      </Container>
    </Section>
  );
}
