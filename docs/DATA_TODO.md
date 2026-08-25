# Data TODO

Running list of data gaps opened by the Ripples design/interaction port (see
`PORTING_GUIDE.md`, not committed). Each entry should name the field, which
widget needs it, and what source/shape would satisfy it. Remove an entry once
the real field lands in `data/*.csv` and the widget is wired to it.

## `koeln-todo-2026` (Cologne) — placeholder project row

Added to `data/projects.csv` so Cologne can be plotted on the 4-city map
(Cologne, Paris, Lisbon, Helsinki — see `PORTING_GUIDE.md` §3.8). Coordinates
(50.9375, 6.9603) are real. Everything else is a structural placeholder and
needs real, sourced research before it's authoritative:

- `project_title`, `sdg11_target` (currently `11.2`/transport as a stand-in),
  `category`, `summary`, `description`
- `budget_eur`, `budget_year`, `funding_source`, `start_year`, `end_year`,
  `status` (currently `planned`), `transferability_score`
- `source_url`, `source_label`, `source_accessed`
- No rows in `metrics.csv` or `peer_cities.csv` reference this project yet —
  add them once there's a real project to report on.
- The `id` may need to change once real content replaces this placeholder
  (normally ids are never renamed — an exception because this one was never
  real to begin with).

## Exploration widgets (Problem Fit, Impact, Adoption Requirements) — no backing content yet

The three Exploration-layer widgets shown around a focused city were re-concepted
from the old Data Quality / Transparency / Inequality set (Phase 1). They now
render **intentional placeholder shells** — a label, a "Placeholder" chip and a
dashed stub — because none of their headline content is researched yet.
`src/data/selectors.js#widgetMetricsForProject` returns
`{ problemFit: null, impact: null, adoption: null }`; the nulls keep any
fabricated figure from rendering (Neutrality/Honesty — see `DESIGN_RATIONALE.md`).

To wire real content (Phase 2), decide per city what each widget's headline
figure is and where it is sourced:

- **Problem Fit:** the researched indicator(s) establishing that the project
  addresses a real local need (e.g. population density → pressure on space). No
  committed field maps to this yet.
- **Impact:** the single most important outcome figure (e.g. green-space GA %,
  CO₂ avoided). Each figure needs its own `source_url`.
- **Adoption Requirements:** what another city needs to replicate it. The closest
  existing field is `transferability_score`, but confirm it fits before reusing.
  **Its L2 landed on 2026-08-23** from `newDes/ubernahmeVoraussetzung.png`
  (`selectors.js#adoptionModules`): the city's own figures, the two departments
  that own the project, the organisations that were at the table, the planners'
  recommendation, and the funding routes by level of government. **Cost landed
  on 2026-08-23** (see the section below). One thing from that design is still
  missing, and it is data rather than build:
  - **Step-by-step implementation.** The design has a card for it carrying only
    the word "source". The stages are documented — the Verkehrsausschuss decided
    them in 2017, 2019 and 2021, and Stadt Köln describes three of them (lifting
    the Radwegbenutzungspflicht → Tempo 30 and the first lanes → continuous
    2.50 m lanes) at
    <https://www.stadt-koeln.de/artikel/67217/index.html> — but the six cards
    are full, so landing it means deciding which one it replaces.
- District-level green-space bars (the Analysis-layer / Phase 5 drill-in detail)
  are not built yet — separate from the three top-level widget headlines above.

### The cost card — what the city published, and what it does not

`selectors.js#costModule`, added 2026-08-23 from `newDes/costs.png`. Everything
on the card comes from **one** document, Stadt Köln's press release of
**15 May 2023**, ["Neun Kilometer Fahrradinfrastruktur auf den Kölner
Ringen"](https://www.stadt-koeln.de/politik-und-verwaltung/presseservice/neun-kilometer-fahrradinfrastruktur-auf-den-koelner-ringen),
read in full rather than summarised. Three new `cities.csv` rows, all `koeln`,
all citing it:

| key | value | what the release says |
| --- | --- | --- |
| `ringe_cost_build` | 2 900 000 EUR (2023) | „Die Gesamtausgaben der umgesetzten und laufenden Maßnahmen … belaufen sich auf etwa 2,9 Millionen Euro einschließlich der Maßnahmen der Markierung, Beschilderung, punktuellen Fahrbahndeckensanierung und des Rückbaus der ehemaligen baulichen Radwege." |
| `ringe_cost_signals` | 1 500 000 EUR (2023) | „Darüber hinaus wurden im Vorfeld weitere rund 1,5 Millionen Euro für die **ohnehin anstehende** Erneuerung der Lichtsignalanlagen zwischen Ritterstraße und Schaevenstraße ausgegeben." |
| `ringe_converted_km` | 9 km (2023) | „Insgesamt hat die Stadt Köln in den letzten Jahren neun Kilometer Fahrradinfrastruktur durch Umwandlung von Auto- in Radspuren geschaffen." |

`ringe_converted_km` (9 km, May 2023, converted car lane) is **not** a duplicate
of `ring_cycle_lanes_km` (10 km, Dec 2024, cycle lane in both directions
Hansaring–Ubierring). Different date, different definition, different source
page. The cost card divides the spend by the first, never the second — they are
not the same denominator.

The **≈ €322,000/km** on the card is derived (`2 900 000 ÷ 9`), the same way the
context card's density is, and quoted to the nearest thousand because both its
inputs are rounded in the source („etwa 2,9 Millionen", „neun Kilometer").

#### One correction to the board, and two figures left off it

`newDes/costs.png` is the board this card was written from. Checked line by line
against the release:

- **The signal renewal is Ritterstraße–Schaevenstraße, not
  Hansaring–Barbarossaplatz.** The board writes the €1.5 M row as „Sanierung der
  Lichtsignalanlagen (Hansaring–Barbarossaplatz)"; the release says „zwischen
  Ritterstraße und Schaevenstraße", a far shorter stretch around
  Rudolfplatz/Hohenzollernring. The card carries the street pair the city
  actually names. **This is the error the board has in it.**
- **€35 M for the Ebertplatz redesign („Prognose 2020") is not on the card.**
  No source for it could be found — not on Stadt Köln's own Ebertplatz pages,
  not in the press coverage. As of the city's [June 2025
  release](https://www.stadt-koeln.de/politik-und-verwaltung/presseservice/weiterfuehrung-der-planungen-am-ebertplatz)
  a preferred variant had only just been chosen and „Entwicklung eines
  nachhaltigen Finanzierungs- und Betriebskonzepts" is still a *next* step, so
  there is no settled estimate to quote. It stays a named line with no figure.
  If a sourced estimate turns up, it is one `cities.csv` row and an
  `indicatorKey` on the item.
- **€1.138 M for the Hohenzollernring/Kaiser-Wilhelm-Ring/Hansaring section is
  not on the card either** — the board itself strikes it through, and it appears
  in none of the four Stadt Köln releases about those sections.
- **„Planungs- und Gutachtenkosten: nicht enthalten"** is softened to *not
  published*. The release lists what the €2.9 M includes and never says what it
  excludes; "the source names no figure" is what can be shown honestly, and
  "excluded" is an inference on top of it.
- The **December 2024 gap closures** genuinely have no separate cost: neither
  the [Dec 2024
  release](https://www.stadt-koeln.de/politik-und-verwaltung/presse/mitteilungen/27581/index.html)
  nor the [project
  page](https://www.stadt-koeln.de/artikel/67217/index.html) states one. The
  board's „k. A." is right.

The €2.9 M and the €1.5 M are deliberately **not** added together. The release
keeps them apart, and €4.4 M is a total no source states.

### Adoption context — the figure that deviates from the design

`newDes/ubernahmeVoraussetzung.png` writes the context card as Population
1 100 076 (2025) · Länge der Ringe 5,8 km · Area 105 km² · Dichte 2 539/km².
Three of those four are not what shipped, and each for a reason:

- **Population and density** come from the rows already in `cities.csv`
  (1 028 273 / 2 539 per km²). The board's 1 100 076 is the pending correction in
  `research.md` §7.1.4, which is explicitly *unverified* — and note the board's
  own density, 2 539, is 1 028 273 ÷ 405, so it contradicts its own population.
  Changing the population row is that task, not this one; it moves every
  per-1000 figure on the Impact cards too.
- **Area 105 km²** is Paris's figure. Cologne is 405 km², which is what the
  board's own density divides by. Shipped as 405.
- **Länge der Ringe 5,8 km** has no city-official source behind it that could be
  found (it appears in press coverage). Shipped instead as the figure Stadt Köln
  does publish and the one another city actually needs — **10 km of cycle lane,
  five per direction between Hansaring and Ubierring** — as the new
  `ring_cycle_lanes_km` row. If 5,8 km is wanted, it needs a source first.

## `data/cities.csv` — researched indicators, provenance to confirm

New city-level indicator table (population, area, green-space share) keyed by
`city_slug`, added for the real-data layer. The figures were **transcribed from
the "City Research" screenshots** in `newGuidelinesPic/`, so before treating any
number as authoritative:

- **Verify the values against the underlying research spreadsheet** — they were
  read off images (population, area in km², green-space GA %).
- **`source_url` is the general research-source page**, not a per-city permalink
  (`worldpopulationreview.com/cities`, `citypopulation.de/en/`). Tighten to the
  exact per-city page where possible. Green-space uses per-city IS-Global-Ranking
  URLs already.
- **`source_accessed` is blank** for every row — the access date wasn't captured
  in the research tables. Fill in the real dates (Honesty non-negotiable wants
  them shown).
- **Density is intentionally NOT a row** — it is derived (`population / area`) in
  `selectors.js#populationDensityForCity`, matching how the source computes it.
  Don't add a `density` row; add its inputs.
- The `paris-marne-la-vallee` / `helsinki-region` rows carry **core-city**
  figures (Paris, Helsinki), consistent with the `city_display` relabeling below
  — not figures for the Marne-la-Vallée / Espoo suburbs the project rows describe.
- Cologne (`koeln`) has real city indicators even though `koeln-todo-2026` is a
  placeholder project — city data joins on `city_slug`, independent of the project.

## `car_density` (Cologne, Paris) — sourced and wired, partial history only

Added 5 rows for `koeln` (2021–2025, "per 1000 residents"), citing Stadt Köln's
["Kraftfahrzeuge in Köln im Überblick"](https://www.stadt-koeln.de/artikel/73904/index.html)
— unlike the rows above, `source_accessed` is filled in and `source_url` is the
exact per-city page, not a generic research-source link. Feeds
`selectors.js#carDensitySeriesForCity` → `impactSubMetrics()`'s `carDensity`
slot, which `widgetStack.js` now renders as a real sparkline + source chip for
Cologne (the first of the three Impact sub-metrics — modal split, car density,
cycle network — to move past its placeholder stub; see `TRACKER_30_07.md`).

Added 3 rows for `paris-marne-la-vallee` (2012/2017/2023), citing Insee's
["Comparateur de territoire — Département de Paris"](https://www.insee.fr/en/statistiques/6457611?geo=DEP-75#chiffre-cle-2),
table LOG T12 "Household automotive equipment" (also saved as a screenshot,
`pkwDichteParis`, at the repo root). **This is a different metric from
Cologne's**, not a like-for-like number: Insee reports the **share of
households owning at least one car** (`% of households`), not registered
vehicles per 1000 residents — that per-capita motorisation figure isn't in
this Insee table. Kept as its own honestly-labelled `unit` rather than forced
into "per 1000 residents" (Neutrality/Comparability — see `CLAUDE.MD`);
`carDensitySeriesForCity` already carries `unit` per series, so this needed no
code change, only new CSV rows.

- **Only 2021–2025 are sourced** for Cologne. A candidate longer series
  (2010/2015/2020, 355/356/374) was proposed alongside this one but isn't
  backed by the cited page's "last 5 years" table — dropped rather than
  attached to a citation that doesn't actually support it. If a source for the
  earlier years turns up, those years can be added the same way.
- **Lisbon, Helsinki have no `car_density` rows yet** — same partial-coverage
  pattern as the infrastructure (cycle-route) layer below.
- `impactSubMetrics()`'s `modalSplit` and `cycleNetwork` keys are still `null`
  for every city except Cologne and Paris (see the `cycle_network` and
  `modal_split_*` entries below).

## `cycle_network` (Cologne, Paris) — sourced and wired, single figure each

Cologne: **`2.48 km per 1000 residents` (2025)**, from the city's own network
geodata — [Offene Daten Köln, Radverkehrsnetz](https://www.offenedaten-koeln.de/dataset/radverkehrsnetz)
(Stand 27.11.2025): 780.31 km mixed traffic on side streets (*gelbes Netz*) +
1,248.67 km separated lanes along main roads (*grünes Netz*) + 699.80 km away
from the street altogether = 2,728.78 km, ÷ population × 1000.

- **This replaced the earlier `1.75` press figure** (Stadt Köln,
  ["Radverkehrshauptnetz für alle Stadtbezirke"](https://www.stadt-koeln.de/politik-und-verwaltung/presseservice/radverkehrshauptnetz-fuer-alle-stadtbezirke)),
  which is struck through as superseded in `newDes/txtModel.odt` — the row was
  rewritten rather than added to, since the two are the same claim measured
  twice.
- **It also answers the comparability objection recorded against 1.75** (that
  the *Radverkehrshauptnetz* is a Zielkonzept — a planned target network — and
  so is not the same kind of thing as Paris's built km): the geodata is the
  built network, and the 198.59 km still in planning is a separate row
  (`cycle_network_planned`) that never enters the headline. The remaining
  caveat is unchanged and now *visible* rather than buried: 780.31 km of the
  total is mixed traffic on ordinary side streets, which the L2 module shows
  as its own segment and legend row instead of folding it into one number.

Paris: `0.48 km per 1000 residents` (2021), **calculated** as 1000 km of
`aménagements cyclables` ÷ the `paris-marne-la-vallee` population row
(2,074,370) × 1000 — the same per-1000-residents method as Cologne's figure.
Cited to Ville de Paris,
["Comment se sont déplacés les Parisien·ne·s en 2025"](https://www.paris.fr/pages/comment-se-sont-deplaces-les-parisiens-en-2025-35425)
(given as the source for the "1000 km (2021)" figure).

- **Verify before treating as final.** As accessed 2026-07-31, that page's
  visible text reports **1,607 km in 2025** (+2% vs. 2024) rather than the
  cited 1000 km/2021 figure — plausible as the same series a few years on
  (Paris's post-2020 "coronapistes" build-out is well documented), but the
  1000 km/2021 number itself wasn't found in the page's fetched text, only
  supplied as given. Confirm against the page's own chart/graphic (likely
  image-rendered, like the `pkwDichteParis` car-density table) or find a more
  specific citation before calling this settled — same spirit as the dropped
  Cologne 2010/2015/2020 series above.
- Lisbon, Helsinki have no `cycle_network` row yet.

## `modal_split_*` (Cologne, Paris) — sourced and wired, two rings each

Cologne has four rings (1982/2006/2017/2022, Stadt Köln VLR 2023, see above).

Paris has two rings (2015 and 2022 — the RP2022 census covers survey period
2019–2024), citing Ville de Paris,
["Comment se sont déplacés les Parisien·ne·s en 2025"](https://www.paris.fr/pages/comment-se-sont-deplaces-les-parisiens-en-2025-35425),
which cites Insee's RP for "domicile-travail" (home-to-work) trips of Paris
residents 15+, all destinations — the general table, not the "stayed within
Paris" subset the page also reports (56.8/15.7/11.5/5.6/3.5/6.9), which is a
different, narrower population.

- **A fifth mode, `moto` (deux-roues motorisé — motorized two-wheelers), was
  added** to `MODAL_SPLIT_MODES` in `selectors.js` (was `transit`/`bike`/
  `walk`/`car`). Paris's source reports it as its own ~3.5–4.5% slice; folding
  it into `car` would have inflated Paris's car share by roughly a third
  (9%→12.5% in 2022) — a real Neutrality violation, so it gets its own segment
  instead. Cologne has no `modal_split_moto` rows, so its rings render `0` for
  that slot (the existing "missing mode defaults to 0" behaviour) — Cologne's
  own four-mode split is unaffected. New token `--color-mode-moto` (`#8a63d2`)
  in `tokens.css`, validated against the other four with the dataviz skill's
  `validate_palette.js` for CVD/normal-vision separation (passes all pairs;
  the pre-existing lightness-band/chroma-floor FAILs on `car`/`transit` are
  inherited from the existing palette, not from this addition — out of scope
  here). New `impact.mode.moto` string in both i18n bundles.
- **The source's sixth category, "pas de déplacements" (no travel/remote
  work), is deliberately excluded** — it isn't a transport mode, so it doesn't
  belong in a mode-share donut. Each ring's percentages are left as raw
  source values (not rescaled), and `modalSplitChart.js` normalises by each
  ring's own total anyway (`total = sum(ring.values)`), so leaving "no travel"
  out means the five real modes' wedges are sized as a share of trips actually
  made (95.3% in 2015, 95.0% in 2022) — the same convention Cologne's own
  source already uses (its four modes sum to exactly 100 with no equivalent
  "did not travel" bucket).
- Lisbon, Helsinki have no `modal_split_*` rows yet.

## `modal_split_*` target — Cologne and Paris, a sourced "how it should look"

Added a second, smaller donut beside the modal-split one:
`selectors.js#modalSplitTargetForCity`, wired through `mapView.js` →
`widgetStack.js` (`modalSplitTarget` prop). Only renders for a city with an
entry in `MODAL_SPLIT_TARGETS`; every other city's panel looks the same as
before this existed (see the layout comment in `widgets.css`).

- **Cologne**: Stadt Köln's own **3. Nahverkehrsplan** (Dec 2017; PDF text-
  extracted and read directly, not taken from the earlier tracker note that
  first flagged it) states, citing the city's 2014 **"Köln mobil 2025"**
  strategy paper: « eine Reduzierung des Anteils des motorisierten
  Individualverkehrs von derzeit 40 % auf 33 % … bis 2025/2030 » and
  elsewhere « den Anteil des Umweltverbundes bis 2025 auf 2/3 des gesamten
  Verkehrsaufkommens zu erhöhen ». Recorded as `{ year: 2025, umweltverbund:
  67, car: 33 }` — 2/3 rounds to 67, matching the MIV-side 33 the same
  document states directly.
  Source: https://www.stadt-koeln.de/mediaasset/content/pdf66/dritter-nahverkehrsplan-12-2017.pdf
  **The target is aggregate-only** (Umweltverbund vs car), not a per-mode
  breakdown — the source never splits transit/bike/walk shares individually,
  so the target donut shows two segments, not the actual donut's five. Don't
  add per-mode target values without a source that actually states them.
  Cologne's own latest (2022) ring already clears this target — transit 17 +
  bike 25 + walk 33 = 75% vs. the 67% goal — which the panel now says
  directly (`impact.modalSplitProgress.met`), computed from the two sourced
  figures rather than asserted.
- **Paris**: the regional (Île-de-France, not city-of-Paris) target from
  *Plan des mobilités en Île-de-France 2030* is still not used — it's
  expressed as relative change (bike triples, transit +15%, car −15%), not
  an absolute split, so it still isn't like-for-like with this donut.
  Instead, Paris's **own** city-level **Plan Local de Mobilité**
  ("Scénario prospectif 2030", Ville de Paris, formally approved by the
  Conseil de Paris 2024 — deliberation 2024 DVD 18) states one absolute,
  sourced target: « une part modale vélo de 13% » by 2030. Recorded as
  `{ year: 2030, bike: 13, other: 87 }` — 87 is the ring's own complement
  (a donut always sums to 100; it is not a second number the source states).
  Source: https://cdn.paris.fr/paris/2024/03/29/partie-3-scenario-prospectif-2030-vf-7ukO.pdf
  **Two things stop this from being Cologne's twin:**
  1. **No full split exists for Paris**, unlike Cologne's two independently
     stated numbers — car/transit are only ever described as *relative*
     shifts ("50% less road traffic", "40% of car users move to bike"),
     never as target shares. Recording a car/transit target share for Paris
     would mean inventing a number the source doesn't give, so the target
     ring shows bike vs. "other modes" (unnamed), not five modes.
  2. **The 13% target's own baseline doesn't match this app's actual
     data.** The Plan Local de Mobilité benchmarks 13% against the EGT 2020
     survey of *all trips* (bike was 2.5% there). The app's actual Paris
     donut is Insee RP2022 *home-to-work commute* trips (bike 10.1% in
     2022) — a different population; commuters cycle far more than the
     general population, so the two bike figures are not measuring the same
     thing. `comparable: false` on this entry (`selectors.js`) makes the
     panel say so explicitly (`impact.modalSplitProgress.notComparable`)
     instead of showing a percentage-point gap that would look like a valid
     comparison and isn't. Decided with the user 2026-08-18 rather than
     silently picking a framing, given the stakes for this app's
     Neutrality/Honesty rule.
- **The target is now a sentence, not a second donut** (2026-08-23). It used
  to render as its own two-segment ring beside the actual one, with
  `--color-target-umweltverbund` (`#159895`) and `--color-target-other`
  (`#6c7684`); both tokens and that ring are gone. An L2 module is ~310px
  wide, which fits one ring stack — and "already at 75%, above the 67% target
  for 2025" is a comparison, which reads better stated than as two shapes to
  eyeball against each other. The data (`MODAL_SPLIT_TARGETS`), the
  `comparable: false` handling and the `impact.modalSplitProgress.*` strings
  are all unchanged; only the rendering changed.

## Paris / Helsinki — display name is narrower than the underlying project

Per decision (use rows as-is, relabel only): `paris-marne-la-vallee-ecoquartier-2022`
now displays as "Paris" and `helsinki-region-kera-2023` as "Helsinki", but the
actual project content (Cité Descartes eco-district; Kera positive-energy
district) is about Marne-la-Vallée and Espoo, not the city centre. This is an
accepted, intentional approximation, not a bug — noted here so it isn't
"fixed" by accident later.

**`lat`/`lon` follows the display name, not the project site** (decision
2026-07-29). Those two rows used to carry the project's own coordinates, which
put their marker outside the silhouette the map draws for them — Helsinki's dot
landed just west of the city, Paris's ~380px off the viewport at L1. `lat`/`lon`
is the **city's** coordinate, the same way Cologne and Lisbon always used it, so
the dot sits on the city it labels. Where the project really is stays in
`summary`, `description`, `funding_source` and `source_url` (Espoo,
Marne-la-Vallée). `src/data/markerPlacement.test.js` holds this contract for any
city added later. Revisit if the map ever needs to pin the true project site —
that wants its own columns, not these.

## The L2 modules' data (Cologne) — added 2026-08-23

The six L2 modules are filled from `newDes/txtModel.odt` + `newDes/picModel.png`,
whose six columns map one-to-one onto the six cards: modal split, car density,
air quality, cycle network, cyclists counted, road safety. New `cities.csv`
indicator families, all `koeln`:

| key | what | source |
| --- | --- | --- |
| `air_pm25` / `air_pm10` / `air_no2` | annual means, µg/m³, 2015–2025 | [LANUV NRW Luftqualität](https://luftqualitaet.nrw.de/bilanzkarten.php), station VKTU Köln Turiner Straße |
| `cyclists_daily` | bikes per permanent counting site per day, 2015–2026 | [Stadt Köln Eco-Counter](https://stadtkoeln.eco-counter.com/) |
| `cycle_network_mixed` / `_separated` / `_offstreet` / `_planned` | km, 2025 | [Offene Daten Köln – Radverkehrsnetz](https://www.offenedaten-koeln.de/dataset/radverkehrsnetz) |
| `traffic_casualties` | people injured or killed per 1000 residents, 2015 + 2020 | [Stadt Köln VLR 2023](https://www.stadt-koeln.de/mediaasset/content/pdf15/vlr_koeln_de_2023.pdf) |

- **`car_density` now runs 2015–2025** rather than 2021–2025, and each year
  carries the document it is actually printed in: 2015–2023 from the
  [Statistisches Jahrbuch 2025, Kapitel 4](https://www.stadt-koeln.de/mediaasset/content/pdf15/statistik-jahrbuch/statistisches_jahrbuch_koeln__2025_kap_4_verkehr_.pdf),
  2024–2025 from ["Kraftfahrzeuge in Köln im Überblick"](https://www.stadt-koeln.de/artikel/73904/index.html).
  It is the *Privat-Pkw* series throughout (the odt's second list), not the
  all-registered-vehicles one — mixing the two would have put a ~75-vehicle
  step in the middle of the line.
- **Every series is cut at 2015** (`SERIES_START_YEAR` in `selectors.js`). Not
  a deletion: `cities.csv` keeps Cologne's 1982/2006 modal-split rows and they
  are simply outside the window, so widening it again is a one-line change.

### Still missing a source — not added

`newDes/txtModel.odt` also lists four absolute road-safety series for
2010–2023 (Verkehrsunfälle, Verunglückte Personen, Getötete, Schwerverletzte).
**None of them carries a link in the odt**, and only the per-1000 indicator
does, so none was added — a row without a source does not render (CLAUDE.md).
They are almost certainly from the Statistisches Jahrbuch's Verkehr chapter,
but "almost certainly" is not a citation. With a source they would give the
road-safety module a real series instead of the two points it states today.

### Note copy that quotes figures no source line links

`impact.note.koeln.airQuality` and `impact.info.airQuality` now carry **nine**
threshold figures between them — the EU limits in force (NO₂ 40, PM10 40,
PM2,5 25 µg/m³), the WHO recommendations (10 / 15 / 5) and the 2030 EU values
(20 / 20 / 10) — and the card links only the LANUV measurement page the *series*
comes from. None of those thresholds is a row in `cities.csv`, so none carries a
`source_url`, and the chip beside them stands for the measurements rather than
for the limits they are compared against.

That is the widest gap between this project's own rule ("every numeric claim
carries its own source") and what is on screen. The card previously cited
[LANUV's Bilanz zur Luftqualität](https://www.lanuk.nrw.de/article/bilanz-zur-luftqualitaet-2025-in-nordrhein-westfalen)
beside the note, which is at least the document the research odt named for the
2030 values; that chip was dropped when the card was reworked to the one link it
was specified with. **Either the thresholds need a source of their own — ideally
rows, so the comparison could be drawn rather than asserted — or that chip needs
to come back.**

### A benchmark, at last

`impact.note.koeln.roadSafety` carries Cologne's 4.8 against the NRW average of
3.7 (2020) — both from the VLR 2023. That is the first real answer to the open
`benchmarkForIndicator()` question above ("is this a lot or a little?"), even
though it arrives as copy rather than as a sourced benchmark row. The stub is
still the right long-term shape; this is one indicator getting its yardstick
early.

## The L3 in-depth block — placeholder, no content yet

Every module opened into the L3 focus slot carries an **In depth** block under
its existing content (`detailContent.js#inDepthHtml`). It is a placeholder: the
extended text has not been written for any of the eighteen modules, and the
block says so (`module.inDepth.pending` — "Extended detail for this card has not
been published yet.").

The slot is the layer's whole reason for existing, so this is the one thing it
is still missing. Until the copy arrives the block must stay an empty shell:
padding the slot with a longer restatement of what the small card already says
would be a fabricated depth, which is the same failure as a fabricated figure
(CLAUDE.md, Neutrality/Honesty).

When the content does arrive it needs deciding **per module kind**, not once —
what "in depth" means for the cost card (the lines with no published figure) is
not what it means for the modal-split donut (the years outside the two-ring
display window, which `cities.csv` still holds). Every figure it introduces
carries its own `source_url` like every other, and anything unresearched stays
marked `TODO(data)` rather than being written as prose.

## The info point copy — placeholder, no text yet

Every L2/L3 card with content carries an ⓘ beside its title, opened on hover or
keyboard focus, and every opened card ends on a block of its own
(`impact.detail.<key>`, with its heading at `impact.detailTitle.<key>`). Both
are keyed off the card, and almost none of it is written: a key with nothing behind it shows `module.info.pending`
("An explanation of this card has not been written yet.") rather than the raw
key, and gains its real text the moment the entry is added to
`strings.{en,de}.json` — no code change needed.

**Written so far:** Impact `modalSplit`, `car`, `cycleNetwork`, `airQuality` and
`cyclists` — their info points, and their closing blocks, all titled "Sources"
(`impact.detailTitle.*`) because what they hold is the survey, the register, the
geodata set, the measuring station and the counting network behind the figures
rather than a second reading of them. Only `roadSafety` is still empty.

`cyclists` is the one card whose two blocks hold the same text, because the
counting method is both what the figure means and where it comes from. If they
should diverge later, they are already separate keys.

The keys that want copy, one per card that has content today:

- **Impact** — `modalSplit`, `car`, `airQuality`, `cycleNetwork`, `cyclists`,
  `roadSafety`
- **Adoption** — all five cards now carry an info point, and `cost` is the only
  one with a closing block: its "Quellen" names the press conference the €2.9M
  was announced at and the three costs nobody published a figure for. `context`
  opts out of that block (`detail: false`) — its four figures already carry three
  chips between them, and one heading above those would name a document where
  the chips already name three. The `departments`, `partners` and
  `recommendation` cards were removed along with their copy and their links —
  git has them if that turns out to be the wrong call.

  `timeline` is filled, from `data/timeline.csv`: thirteen events in three
  phases, evenly spaced on a serpentine track because "Ab 2018" and
  "Mai–Aug. 2022" are not points in time. **Those rows carry no source of their
  own** — they are narrative rather than measurement, so the no-source-no-render
  rule that guards a figure does not drop them, and where the account came from
  is still an open question for the card. Its `phase` values map to
  `adoption.timeline.phase.*`, which are the only translated strings on it: the
  dates, titles and details live in the CSV and are German only. Translating
  them means either a second column per language or moving the copy into the
  bundles — worth deciding before another city gets a timeline.

  `funding` follows the schema in `Project Make I _ SS2026.csv`: each route opens
  into its Details, Förderquote and Zugang. Eight of the thirteen routes have
  those terms; **Junge Generation Fahrrad, and the whole Bürgerfinanzierung and
  Private Partner groups, do not** — they are named with their links and no
  disclosure, because that CSV has no row for them. A route gains its disclosure
  the moment `adoption.funding.<key>.details` is added, with no code change. The
  card has no source of its own yet: the schema's "[siehe hier]" was left out
  until there is a URL for it. Like `politics`, it carries **no closing block**
  (`detail: false`) — each route already opens into its own terms, and one
  "Sources" heading under thirteen of them would promise a single document
  behind all of them.

  `politics` is written and is the one card with **no closing block at all**
  (`detail: false` in `policyModule`): its five recommendations already are what
  such a block would hold, and a "Sources" heading under them would promise a
  document none of it comes from. Its recommendations, its two name lists and
  its info point are all copy (`adoption.koeln.politics.*`); three of the seven
  organisations carry a link, and the other four are named without one rather
  than given one that points nowhere in particular.
- **Problem Fit** — the four cards are `problemFit`, `sdgs`, `plan` and
  `milestones`. Two have content: `sdgs` holds the two SDG 11 targets
  (`problemFit.<slug>.target.<code>`), and `problemFit` holds Cologne's
  four-paragraph project summary (`problemFit.koeln.summary.{intro,completion,counts,ebertplatz}`,
  listed in `PROBLEM_FIT.koeln.summary`). `plan` (the 10-Punkte-Plan) and
  `milestones` are still placeholders waiting on copy.

  The `sdgs` card carries **no info point of its own** (`info: false`) — its two
  boxes each carry one instead, holding the official wording of that target
  (`problemFit.targetDefinition.<code>`, keyed globally rather than per city
  because the targets are the UN's). It cites the JRC knowledge base on SDG 11 as
  a chip and carries **no closing block** (`detail: false`), the same call the
  plan card makes. That dropped a sentence worth getting back somewhere: the
  block used to say that the wording is the JRC's while *which* two targets the
  project addresses, and what it does about them, is this dashboard's own
  reading. The card now cites a source that backs only half of what it shows.
  **Three things to check there:** the German wording is the official Agenda 2030 translation of targets
  11.2 and 11.6 and should be read against the published German text, and
  `source_accessed` is 2026-08-25 — the day the link was added to the app, not a
  verified retrieval. `problemFit.info.problemFit` and `.milestones` are still
  unwritten.

  The `plan` card is the #RingFrei ten-point plan, keyed
  `problemFit.koeln.plan.<1-10>.{short,text}` — the short line the card shows in
  a column, and the full demand it shows opened, one or the other and never both
  (the short line is a shortening of the long one) — with `planPoints: 10` in
  `PROBLEM_FIT.koeln` saying how many there are. It carries the ADFC Köln
  project overview as its one source and **no closing block** (`detail: false`):
  one document stands behind all ten points, and a "Quellen" heading over a
  single chip would say nothing the chip does not. Its `source_accessed` is
  2026-08-25 on the same terms as the JRC link above.

  **The open question there is delivery status.** The card's info text says the
  points were carried out "bis auf wenige Ausnahmen", and the card cannot show
  which few — all ten read as demands, and a reader has no way to tell a
  delivered one from an outstanding one. The points are objects (`number`,
  `shortKey`, `textKey`), so a `status` field can be added to each without the
  layout changing; what is missing is the per-point research and a source for
  it. Until then the claim stands in the info text only.

  The summary card carries **no closing block** (`detail: false`) — it is
  already the overview such a block would summarise. That leaves three figures
  in it with no source line anywhere on the card: the ~10 km of continuous
  route, the December 2024 Barbarossaplatz completion, and the 11,256 : 10,585
  count on Hohenzollernring on 12 May 2025. The count is sourced on Impact's
  `cyclists` card, so it is traceable elsewhere in the app but not from here;
  the other two are not sourced anywhere. **Decide whether this card gets its
  own chips.** Paris has no summary written and falls back to the placeholder.

  The English bundle carries a translation of all four paragraphs; the German is
  the copy as supplied, with one spelling fix (`seperates` → `separates`).

What belongs there is what the card *is* and how to read it — which survey the
modal split comes from and who it counts, what "car density" registers, which
measuring station the air figures are from. It is not a second place to state a
figure: anything numeric written here needs its own `source_url` like every
other claim, and the card's own chips are the place for provenance.
