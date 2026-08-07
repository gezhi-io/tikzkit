# pgfgantt Title-List QA (2026-08-07)

## Scope

This pass implements one bounded pgfgantt feature family: \gantttitlelist
with the ordinary numeric foreach forms a,...,b and a,step,...,b, plus a
literal comma list. Each item becomes a normal adjacent \gantttitle and
therefore reuses the already-reviewed title geometry and title options.

It deliberately excludes title list options={evaluate=...}, arbitrary TeX
expansion in list values, calendar/date title generation, and custom title
list callbacks.

The real driver is test/fixtures/examples/pgfgantt/title-list.tex, adapted
from the local pgfgantt manual. It uses \gantttitlelist{1,...,12}{1} above
two real bars, so a missing expansion is immediately visible as an empty title
row.

## Local MacTeX Study

Read locally:

- /usr/local/texlive/2025/texmf-dist/tex/latex/pgfgantt/pgfgantt.sty;
- /usr/local/texlive/2025/texmf-dist/doc/latex/pgfgantt/pgfgantt-doc.pdf.

At source lines 570-575, \gantttitlelist applies its optional local keys, then
delegates the list to TeX \foreach, and invokes \gantttitle{\x}{span} once
for each value. The manual title-list section shows the ordinary 1,...,12
form. TikZKit mirrors that semantic boundary by expanding supported lists
before its shared Gantt command parser: it does not invent a second title
layout path.

## Three-Renderer Evidence

tikztosvg was found at /Library/TeX/texbin/tikztosvg; PNG conversion used
/opt/homebrew/bin/rsvg-convert.

The detached baseline from commit a9047f6 is in
outputs/qa-pgfgantt-title-list-before-2026-08-07/. Its TikZKit panel displays
only the top Weeks title and the two bars. The entire 1 through 12 cell row is
missing, while the MacTeX and tikztosvg panels both show 12 bordered cells
directly beneath Weeks.

After implementation, the artifacts are in
outputs/qa-pgfgantt-title-list-after-2026-08-07/:

- MacTeX PNG: mactex-png/pgfgantt-title-list.png;
- TikZKit SVG/PNG: tikzkit-svg/pgfgantt-title-list.svg and
  tikzkit-png/pgfgantt-title-list.png;
- tikztosvg SVG/PNG: tikztosvg-svg/pgfgantt-title-list.svg and
  tikztosvg-png/pgfgantt-title-list.png;
- comparison sheets: diff/pgfgantt-title-list-native-sheet.png and
  diff/pgfgantt-title-list-sheet.png.

The inspected after panels all show the twelve values in the same second title
row, one value per time slot, followed by Planning across slots 1--4 and
Delivery across slots 6--11. TikZKit still differs in a few pixels of font
rasterization and crop padding, but no longer omits content or shifts the
title-list row into chart rows.

The tikztosvg SVG uses a 200.37pt × 72.78pt viewBox, individual title-cell
paths with stroke-width=0.3985, butt caps and miter joins, and DVI glyph paths
rather than browser text nodes. Its cells advance by roughly 12.756pt, which
confirms that a list item is a regular one-slot title cell. TikZKit uses its
renderer-neutral title rectangles and ordinary text nodes; the common Gantt
geometry is why list and explicit title cells now align.

## Changes And Verification

- src/frontend/latex-shell.js expands supported \gantttitlelist calls before
  parsing chart commands, including ascending/descending and explicit numeric
  steps.
- test/walmes-compat.test.js covers stepped numeric lists and literal lists.
- test/fixtures/examples/pgfgantt/title-list.tex and its manifest entry add a
  permanent three-renderer visual regression.
- src/packages/pgfgantt.js, generated registry files, and README document the
  precise supported boundary.

~~~bash
node --test --test-name-pattern='pgfgantt' test/walmes-compat.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-pgfgantt-title-list-after-2026-08-07 \
  --only pgfgantt-title-list --native-reference \
  --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-pgfgantt-title-list-after-2026-08-07 \
  --register --alignment-radius 3
npm run extension-registry
~~~

The focused regression passes and the real case has a visible improvement:
the previously absent twelve-cell title row is now restored. Acceptance is
based on that visual restoration across the three rendered references, not the
aggregate image-difference number alone.

## Remaining Work

The next title-list slice should implement the manual title list options
evaluation path and then separately decide whether calendar/date titles belong
in pgfgantt or reuse a shared PGF calendar evaluator.
