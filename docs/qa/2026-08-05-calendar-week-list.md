# Calendar Week-List QA

## Scope

- Library/function slice: TikZ `calendar` library `week list` layout, multi-month labels, calendar text shorthands, and simple date conditions.
- Driver: `test/fixtures/examples/calendar/week-list-multimonth.tex`.
- Boundary: this verifies the documented Monday-first `week list` behavior. `day list`, `month list`, localized names, arbitrary executable hooks, and all other label positions remain outside this slice.

## Local TeX Live Review

Reviewed locally from MacTeX / TeX Live 2025:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarycalendar.code.tex`
  - Default offsets are `day xshift=3.5ex`, `day yshift=3ex`, and `month yshift=9ex`.
  - `week list` uses Monday as column 0 and moves down after Sunday; each later month receives `month yshift` before its first date.
  - `month label above centered` is based on the left edge of the seven-column row, not the weekday of the first date.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/utilities/pgfcalendar.code.tex`
  - Weekdays are Monday=0 through Sunday=6.
  - `\%mt` expands to the full English month name; `\%m.` is abbreviated; `\%y-`, `\%y=`, and `\%y0` expand to the year.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-calendar.tex`
  - Confirms `week list`, `week list sunday`, month-label placement, and date predicates such as `Sunday`, `weekend`, `workday`, `equals`, `between`, and `day of month`.

## Parameter Audit

The fixture uses and now exercises:

| Source command/key | Status | Notes |
| --- | --- | --- |
| `\usetikzlibrary{calendar}` | supported | Registered as `partial`; actual evaluator is `createCalendar/calendarLayout`. |
| `\calendar (cal) at (0,0)` | supported | Named date anchors such as `cal-2000-02-29` are created. |
| `dates=2000-01-01 to 2000-02-last` | supported | Inclusive ISO range plus `last` month-day resolution. |
| `week list` | supported | Monday-first columns, Sunday-last row advance. |
| `week list sunday` | supported | Sunday-first compatibility variant. |
| `day xshift`, `day yshift`, `month yshift` | supported | Dimensions drive the native-style row and inter-month offsets. |
| `month label above centered` | supported | One title is emitted for each month, aligned to the seven-column row. |
| `month text=\textcolor{blue}{\%mt} \%y-` | supported | `\%mt`/`\%m.` and year forms are expanded; inline color is preserved by the text renderer. |
| `every day/.style={draw,minimum size=8mm}` | supported | Calendar-local style definitions now reach generated day nodes. |
| `if (Sunday) [red]` | supported | Weekday condition changes all Sunday text and borders. |
| `weekend`, `workday`, comma alternatives, `equals`, `between`, `day of month` | supported | Covered by unit tests; predicates compose in calendar option order. |
| `day list`, `month list`, left/right/vertical month labels, localization, execute hooks | deferred | Not implemented in this focused slice. |

## Artifacts And Visual Review

Artifacts are intentionally kept together at `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-calendar-week-list/`:

- MacTeX native PNG: `mactex-png/calendar-week-list-multimonth.png`.
- TikZKit JS SVG/PNG: `tikzkit-svg/` and `tikzkit-png/`.
- Local `tikztosvg` (`/Library/TeX/texbin/tikztosvg`) SVG/PNG: `tikztosvg-svg/` and `tikztosvg-png/`.
- One-centimetre-grid variants: `tikzkit-grid-png/` and `tikztosvg-grid-png/`.
- Pairwise diff and sheet: `diff-png/` and `diff/calendar-week-list-multimonth-sheet.png`.

Observed before the fix:

- JavaScript treated Sunday as column zero, so January 2 appeared at the left edge rather than in the seventh column.
- February continued immediately after January instead of receiving the `month yshift` gap.
- Only one malformed `Jan \%y-` title was created; the second month had no title.
- `every day/.style` was not applied to generated dates, so the day boxes were missing.

Observed after the fix:

- MacTeX, `tikztosvg`, and TikZKit all show Saturday 1 / Sunday 2 in columns six and seven, Monday 3 at the next row's first column, and a separately centered February 2000 title after the configured gap.
- The JS SVG now emits explicit `rect` day boxes with `stroke=black` or `stroke=red`, plus text nodes centered at the same grid locations.
- `tikztosvg` emits a `193.15pt x 397.25pt` glyph-outline SVG with transformed stroked rectangles, while TikZKit emits an equivalent `viewBox` with SVG `<rect>`/`<text>` primitives. Its CSS font rasterization and antialiasing still make the pixel diff non-zero, but no date, month title, condition color, or layout element is missing.

## Verification

```sh
node --test test/calendar.test.js test/walmes-compat.test.js test/library-modules.test.js
node scripts/render-example-fixtures.js --only calendar-week-list-multimonth --output outputs/qa-calendar-week-list --strict-tikztosvg
node scripts/diff-example-pngs.js --output outputs/qa-calendar-week-list
/Library/TeX/texbin/pdflatex -interaction=nonstopmode -halt-on-error -output-directory=outputs/qa-calendar-week-list/mactex-pdf test/fixtures/examples/calendar/week-list-multimonth.tex
/opt/homebrew/bin/pdftoppm -png -r 144 -singlefile outputs/qa-calendar-week-list/mactex-pdf/week-list-multimonth.pdf outputs/qa-calendar-week-list/mactex-png/calendar-week-list-multimonth
```

All focused tests pass with no diagnostics. The comparison has equal content geometry; raw PNG equality is not expected because `tikztosvg` outlines TeX glyphs while the browser renderer uses embedded text fonts.

## Next Slice

Add `day list` / `month list` placement only after another real corpus case requires it, then cover month-label left/right/vertical variants and localized `pgfcalendar` naming as a separate QA slice.
