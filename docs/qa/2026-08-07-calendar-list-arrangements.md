# Calendar List Arrangements QA (2026-08-07)

## Scope

This verified slice is limited to the `calendar` library's documented layout
families: `day list downward`, `day list upward`, `day list right`, `day list
left`, `month list`, and `month label left`. It deliberately does not claim
the full calendar hook or label API.

Driver: `test/fixtures/examples/calendar/list-arrangements.tex`.

## Local MacTeX Review

Reviewed TeX Live 2025 sources:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarycalendar.code.tex`, especially the predefined arrangement styles. The four day-list styles insert a month gap before the first non-initial month and then advance after each day. `month list` stores the weekday of the month start and computes each day as `(month-start-weekday + day-of-month - 1) * day xshift`.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-calendar.tex`, sections “Arrangements” and “Month Labels”. It specifies Monday as the first column and says `month label left` aligns as though a month began on Monday.

The implementation follows those rules in `calendarLayout`: arrangement is
selected once from the resolved options; day lists advance one cursor; month
lists use the first calendar date of each actual month, including partial
first-month ranges. The left label uses the PGF `base east` convention and a
`3.5ex` left offset. The fixture also uses the documented two-character
calendar templates `\%m0` and `\%d0`; bare `\%m`/`\%d` are not valid PGF
shorthands.

## Reference Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`; the native reference used local `pdflatex`.

Ignored artifacts are under
`/private/tmp/tikzkit-qa-calendar-lists-2026-08-07-v2/`:

- `mactex-png/calendar-list-arrangements.png`
- `tikzkit-svg/calendar-list-arrangements.svg`
- `tikzkit-grid-png/calendar-list-arrangements.png`
- `tikztosvg-svg/calendar-list-arrangements.svg`
- `tikztosvg-grid-png/calendar-list-arrangements.png`
- `diff/calendar-list-arrangements-native-sheet.png`
- matching `calendar-week-list-multimonth` artifacts for the regression check.

The tikztosvg result has a `0 0 358.21 218.55` viewBox. TeX text is converted
to outline paths, with repeated rectangle paths and shared `matrix(1,0,0,-1,
53.084,70.913)` coordinate transforms; it contains no browser `<text>` nodes.
TikZKit keeps semantic SVG text. The structural difference explains the
antialiasing and crop residual while retaining the same day-origin geometry.

## Visual Review

Before this change, every unrecognized `day list ...` and `month list` style
fell through to week-list placement: vertical and horizontal lists used a
seven-column weekday grid, and month rows did not start at each month's true
weekday column. `month label left` was absent.

After the change, MacTeX, tikztosvg, and TikZKit show all four short lists in
the expected directions with the added cross-month gap. The `month list` puts
January 1, 2000 in the Saturday column and February 1 in the Tuesday column;
both month names sit on the left edge of their own rows. The 1cm-grid panels
show the same origins and directions. The intentionally tight 5mm horizontal
day lists overlap their `01/30` labels in all three renderers, so that is
source behavior, not a renderer defect.

The registered TikZKit-to-tikztosvg comparison for the new driver reports a
three-pixel horizontal and one-pixel vertical registration, then 5.68% changed
pixels (mean absolute RGBA 0.0134). Inspection attributes the residual to TeX
glyph outlines, line antialiasing, and a 477x294 versus 478x292 crop, not to
missing days or displaced month rows. The existing week-list driver remained
visually intact; its remaining text/crop residual pre-existed this slice.

## Changes And Verification

- `src/engine/evaluate.js`: dispatches calendar arrangements and applies the
  PGF month-start weekday offset and left month-label anchor.
- `src/tikz/libraries/calendar.js`: records the narrowed supported boundary.
- `test/calendar.test.js`: protects all directions, spacing, partial-month
  weekday offsets, label placement, and `\%m0`/`\%d0` expansion.
- `test/fixtures/examples/calendar/list-arrangements.tex`: real manual-driven
  three-way visual driver.

```bash
node --test test/calendar.test.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-calendar-lists-2026-08-07-v2 \
  --only calendar-list-arrangements,calendar-week-list-multimonth \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg \
  --continue-on-external-failure --external-timeout-ms 120000
npm run examples:diff -- --output /private/tmp/tikzkit-qa-calendar-lists-2026-08-07-v2 \
  --register --alignment-radius 3
```

Both focused tests and all six external reference renders passed with zero
TikZKit diagnostics. Remaining work: localized names, `month label right` and
vertical variants, arbitrary `day code`/`month code`, and executable calendar
hooks.
