# Design rationale — graphical design objectives

This is the committed home for the dashboard's **graphical design objectives**:
_why_ the interface looks and behaves the way it does. It is the source of truth
that `CLAUDE.MD` links to and that every UI change should be checked against.

The objectives come from the project's design board (`newGuidelinesPic/`,
2026-07-28). Each is a design goal backed by evidence, followed by **how this
repo fulfils it today** and **where the responsibility lives in the code** so a
regression is easy to spot in review.

> Scope note: the three **content** categories — _Problem Fit_, _Impact_,
> _Adoption Requirements_ — and the widget/data/analysis layers are a **later
> phase** and deliberately out of scope here. This document is about the
> _graphical_ objectives only. See `../../NEW_GUIDELINES_ANALYSIS.md` for the
> full roadmap.

---

## The five objectives

### 1. Comprehensibility

**Goal.** The dashboard must be quick to read and low-effort to understand.

**Evidence.** Dashboards meeting WCAG-AA contrast show ~28% fewer comprehension
problems and ~35% faster task completion. Cognitive Load Theory (Sweller): reduce
_extraneous_ load so attention goes to the content, not the chrome.

**How the repo fulfils it.**

- **WCAG-AA contrast is now a hard rule, not deferred debt.** Every text/
  background pair clears 4.5:1 on the `#0d1117` canvas. The three colours that
  previously failed (ported as-is from Ripples) were lightened in
  `src/styles/tokens.css`:
  | Token                | Old (ratio)         | New (ratio)          |
  | -------------------- | ------------------- | -------------------- |
  | `--color-danger`     | `#b23a3a` (3.2:1 ✗) | `#e06a63` (5.78:1 ✓) |
  | `--color-success`    | `#2f7a3a` (3.6:1 ✗) | `#4caf57` (6.83:1 ✓) |
  | `--color-text-faint` | `#5a5a56` (2.7:1 ✗) | `#8a8a83` (5.45:1 ✓) |
- **Reduced cognitive load:** few consistent colours, a fixed spacing/type scale,
  and a clear information hierarchy (all in `tokens.css`); components do one thing.
- Numbers are formatted for the locale (`src/lib/format.js`, `Intl.NumberFormat`).

**Where it lives.** `src/styles/tokens.css` (palette + scales), every component
sheet in `src/styles/components/`. **Any new colour must clear 4.5:1 for text /
3:1 for large text or graphical marks** — verify before merging.

### 2. Neutrality

**Goal.** Present the data without distorting it. "Wrong depiction of data is
unethical and leads to biased decisions."

**How the repo fulfils it.**

- **Comparability:** cross-city figures are normalised (per capita) with the
  normalisation _named on the axis_; if normalisation isn't possible the footnote
  says "absolute values, not normalised". Never imply comparability the data
  can't support.
- **Honesty:** estimates are marked as estimates; when sources disagree, both are
  shown; `source_accessed` dates are visible.
- A muted, few-colour palette avoids emphasis that the data doesn't warrant.

**Where it lives.** `CLAUDE.MD` non-negotiables (Comparability, Honesty),
`src/lib/format.js`, chart components.

### 3. Credibility

**Goal.** The interface must be trustworthy — a prerequisite for knowledge
transfer, and for a recommendation being acted upon rather than dismissed.

**How the repo fulfils it.**

- **Every number carries its source.** A metric row with no `source_url` **does
  not render** (`data/*.csv` rule). The source is shown _at the number_, not in a
  footnote elsewhere — design decision "2.1 sources directly on the widget →
  trust".
- `src/components/sourceChip.js` exposes the citation, an outbound link, and the
  access date on every figure.

**Where it lives.** `src/components/sourceChip.js`, `src/data/validate.js`
(rejects sourceless numeric claims), `data/*.csv`.

### 4. Engagement / curiosity

**Goal.** Keep the user exploring — interactivity raises curiosity _and_
understanding, and a familiar map + zoom fits progressive exploration.

**How the repo fulfils it.**

- A **map with familiar zoom/pan** navigation (`d3.zoom`), ripple markers, and
  **in-place city focus** invite exploration; spatial context is communicated
  almost for free.
- Motion is purposeful and always respects `prefers-reduced-motion`
  (`src/lib/a11y.js`) — engagement never overrides accessibility.

**Where it lives.** `src/components/europeMap.js`, `src/views/mapView.js`,
`src/lib/a11y.js`.

### 5. An evoked feeling of cohesion

**Goal.** The interface should feel like one coherent system and strengthen the
sense of connection between the PIONEER cities (a positive, collective feeling).

**How the repo fulfils it.**

- **Repeated, consistent design:** one design-token system (`tokens.css`) and one
  component contract (`render(container, props) -> { update, destroy }`) mean
  every widget, card, and chart shares the same visual language — "wiederholende
  Gestaltung führt zu einfacherem Verständnis" (repeated design → easier
  understanding).
- The four cities are shown on **one shared map with one shared timeline and one
  legend**, framing them as peers of a common effort rather than isolated cases.

**Where it lives.** `src/styles/tokens.css`, the component contract (see
`CLAUDE.MD` → Conventions), `src/views/mapView.js` (shared map/legend/year row).

---

## Checklist for any UI change

Before merging anything that touches the interface, confirm it does not regress
an objective:

- [ ] **Comprehensibility** — new text clears 4.5:1 (3:1 for large text/marks);
      no new colour outside `tokens.css`; hierarchy stays legible.
- [ ] **Neutrality** — no visual emphasis the data doesn't support; comparisons
      normalised and labelled.
- [ ] **Credibility** — every displayed number still has a reachable source.
- [ ] **Engagement** — interactive, and `prefers-reduced-motion` respected.
- [ ] **Cohesion** — reuses existing tokens + the component contract; no one-off
      visual language.

---

## Deferred to a later phase (not covered here)

These come from the same design board but are **content**, not graphical, and are
tracked separately:

- **Content categories / widgets:** Problem Fit, Impact, Adoption Requirements.
- **Content-selection criteria:** goal conformity with SDG 11 (_Zielkonformität_),
  empirical evidence of impact, efficiency/effectiveness at fulfilling SDG 11.
- **Interaction layers:** Orientation → Exploration → Analysis, and wiring the
  real researched city data (population, density, area, green-space share).

See `../../NEW_GUIDELINES_ANALYSIS.md` §5–§8 for the phased plan.
