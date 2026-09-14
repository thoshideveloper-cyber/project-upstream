# Product

## Register

product

## Users

Analysts and partners at investment-banking and M&A advisory firms. An analyst spends a
full working day inside Upstream on a desktop monitor, in a bright office, alternating
with Excel and email: working an outreach queue of hundreds of companies, logging every
touch, chasing follow-ups before they go stale. A partner opens it to read the state of
the desk — which projects are slipping, who is carrying what, where replies come from.

The job is deal sourcing: build a book of targets, buyers or investors per engagement,
reach every one of them on a disciplined cadence, and never lose track of who answered.

## Product Purpose

Upstream replaces three spreadsheets (Master List, Email Schedule, Contact List) with one
connected, firm-scoped system. Outreach is an append-only log; the follow-up cadence is
computed server-side from the first email. Success is an analyst who opens the app, sees
exactly what is late and what to do next, clears it without hunting, and trusts every
number on screen because each one links to the rows behind it.

## Brand Personality

Serious, exact, quiet. It should feel like software a bank would buy: calm under density,
confident without decoration, precise in its language. Emotional goal: control — the
sense that nothing is falling through the cracks.

Reference products, and the specific thing each gets right:
- **Linear** — keyboard-first flow, status as a small consistent glyph, no chrome.
- **Stripe Dashboard** — surgical typography, tables that read like financial statements.
- **Attio / Affinity** — record-centric CRM: a list, a record, and the relationships between.
- **Ramp** — black-and-white restraint with semantic colour used only for state.

## Anti-references

- The AI dashboard: floating rounded cards everywhere, hero metrics, gradients, glass.
- A generic shadcn/Tailwind admin template: default grey everything, pill soup.
- The previous Upstream look: all-grey, zero colour, where "overdue" and "replied" were
  both shades of grey and status needed a legend to read.
- Consumer-app playfulness: bouncy motion, emoji, celebratory confetti, illustrations.

## Design Principles

1. **State gets colour; nothing else does.** Black, white and neutrals carry the
   interface. Red, amber, green and blue appear only where they mean late, due,
   done/replied and in-progress — so a colour on screen is always a fact.
2. **The table is the product.** Most screens are a register of records. Invest in column
   hierarchy, alignment, density, sticky headers, selection and row actions before
   anything decorative.
3. **Every number is a door.** A figure links to the filtered rows that produce it.
4. **Say what to do next.** Each screen answers where am I, what matters, and what the
   primary action is — one filled button per surface.
5. **Earned familiarity.** Standard navigation, standard controls, standard keyboard
   shortcuts. Novelty only where it removes work.

## Accessibility & Inclusion

WCAG 2.2 AA. Body text ≥ 4.5:1, never alpha-diluted grey. Colour is never the only
signal: every state colour is paired with a glyph shape or a word. Visible focus rings on
every control; full keyboard paths for lists (↑/↓/j/k, Enter) and the ⌘K palette.
`prefers-reduced-motion` honoured everywhere.
