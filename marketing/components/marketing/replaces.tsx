import { REPLACES } from "@/content/site";
import { Container, Readout, Section, SectionHead } from "./primitives";

/**
 * The comparison the reader is already running in their head.
 *
 * This section replaces eleven placeholder testimonials reading "To be reviewed"
 * from "Jane Doe at Organisation A". A page with no customers yet cannot borrow
 * credibility, but it can do the more useful thing and answer the question the
 * buyer actually has: what changes on Monday.
 *
 * Six questions, each with the status quo and what the product does instead. The
 * "before" column is the three-spreadsheet reality the product was specced
 * against, not a named competitor, because most teams evaluating this are moving
 * off their own files. Every "after" cell is a mechanic in the build.
 *
 * Rendered as a real <table> so it is announced as one: the questions are row
 * headers, the two approaches are column headers, and a screen reader can move
 * through it cell by cell with the headings intact. A pair of divs could not do
 * that, and this is the densest comparison on the page.
 */
export function Replaces() {
  return (
    <Section id="compare" rhythm="loose">
      <Container>
        <SectionHead variant="split" title="What actually changes on Monday.">
          Nobody switches systems for a feature list. This is the same six questions, asked of
          the way you work now and the way it works here.
        </SectionHead>

        <div className="mt-12 overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-left">
            <caption className="sr-only">
              Six common outreach questions, answered by spreadsheets and inboxes today, and by
              Upstream.
            </caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="w-[30%] py-4 pr-6 align-bottom">
                  <Readout>The question</Readout>
                </th>
                <th scope="col" className="w-[35%] py-4 pr-6 align-bottom">
                  <Readout>Spreadsheets and inboxes</Readout>
                </th>
                <th scope="col" className="w-[35%] py-4 align-bottom">
                  {/* The only amber column header on the page. It is the answer
                      column, and the eye should go there without being told. */}
                  <Readout tone="signal">With Upstream</Readout>
                </th>
              </tr>
            </thead>
            <tbody>
              {REPLACES.map((r) => (
                <tr key={r.question} className="border-b border-border align-top">
                  <th
                    scope="row"
                    className="mkt-subhead py-6 pr-6 text-[15px] leading-snug text-foreground"
                  >
                    {r.question}
                  </th>
                  <td className="py-6 pr-6 text-sm leading-relaxed text-muted-foreground text-pretty">
                    {r.before}
                  </td>
                  <td className="py-6 text-sm leading-relaxed font-medium text-foreground/90 text-pretty">
                    {r.after}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Container>
    </Section>
  );
}
