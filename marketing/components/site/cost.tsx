import { COST_HEAD, LOSSES, TURN } from "@/content/site";
import { Fold } from "./fold";
import { Plate } from "./plate";
import { Reveal, Stagger, StaggerItem, Stamp } from "./primitives";

/**
 * What it costs.
 *
 * Deliberately not cards. Four cards in a grid would say these are four
 * features of a problem; four ruled entries say these are four things that
 * happened, which is what they are. The right-hand pair is the argument: every
 * one of these is already expensive by the time the desk hears about it, and
 * the lateness is worse than the mistake. No row explains the fix, because the
 * fix has its own fold and saying it twice is how a page starts to sound like
 * it is selling.
 */
export function Cost() {
  return (
    <Fold id="cost" stamp="12 Mar · initial" className="py-28 lg:py-36">
      <Reveal className="max-w-[34rem]">
        <Stamp>The reckoning</Stamp>
        <h2 className="u-display mt-4 text-[clamp(1.75rem,3.4vw,3rem)] leading-[1.06]">
          {COST_HEAD}
        </h2>
      </Reveal>

      <Stagger as="ol" className="mt-14 border-t border-hair" step={0.09}>
        {LOSSES.map((loss) => (
          <StaggerItem
            key={loss.n}
            as="li"
            className="grid grid-cols-1 items-baseline gap-x-8 gap-y-3 border-b border-hair py-7 lg:grid-cols-[3rem_minmax(0,1fr)_18rem]"
          >
            <span className="u-mono text-[0.8125rem] text-fg-muted">{loss.n}</span>
            <p className="u-subhead text-[clamp(1.125rem,2vw,1.5rem)]">{loss.event}</p>
            <div className="lg:text-right">
              <p className="u-mono text-[0.8125rem]">
                <span className="text-fg-muted">Found out: </span>
                <span className="text-fg">{loss.found}</span>
              </p>
              <p className="u-mono mt-1 text-[0.8125rem] text-[color:var(--late-ink)]">
                {loss.cost}
              </p>
            </div>
          </StaggerItem>
        ))}
      </Stagger>
    </Fold>
  );
}

/**
 * The breath. One line on a mostly empty band, between the two densest folds
 * on the page. A page that is uniformly dense is exhausting and a page that is
 * uniformly airy says nothing, so the rhythm has to earn its quiet somewhere,
 * and this is where.
 */
export function Turn() {
  return (
    <Fold
      className="py-28 lg:py-44"
      // The eddy where filaments leave the current, slow, and dissolve into
      // the silt until nothing is left of them. It is the line, in water: the
      // work was done and it had nowhere to live. This is the only photograph
      // that shows itself above the waterline, which is why the fold that was
      // the page's quietest is now the one it remembers.
      plate={<Plate name="cost" opacity={0.5} mask="right" wash={0.34} position="60% center" />}
    >
      <Reveal className="max-w-[46rem]">
        <p className="u-display text-[clamp(1.5rem,3.2vw,2.5rem)] leading-[1.14]">
          {TURN.line}{" "}
          <span className="u-narrow text-fg-muted italic">{TURN.turn}</span>
        </p>
      </Reveal>
    </Fold>
  );
}
