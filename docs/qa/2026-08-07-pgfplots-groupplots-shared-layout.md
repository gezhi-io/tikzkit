# PGFPlots `groupplots` Shared Layout QA

## Scope

This accepted slice implements and verifies a two-dimensional `groupplot`
layout with `\\nextgroupplot`. The boundary is deliberately narrow:
`group size`, `horizontal sep`, `vertical sep`, `group name` anchors,
`group/every plot`, per-cell `group/plot c<column>r<row>/.style`,
`group/empty plot`, and edge filtering for x/y labels and tick labels.

The driver is
`test/fixtures/examples/pgfplots/groupplots-shared-descriptions.tex`, adapted
from TeX Live's PGFPlots manual section 5.8. It has a 2 by 2 group with
`width=4cm`, `height=3.5cm`, ranges `0:2`, `0.5cm` horizontal/vertical gaps,
major grids, and shared `time $t$ / h` and `$c$ / mol/L` descriptions.

## Local MacTeX Study

Read locally:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/libs/tikzlibrarypgfplots.groupplots.code.tex`;
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`;
- `/usr/local/texlive/2025/texmf-dist/tex/latex/pgfplots/pgfplots.sty`;
- `/usr/local/texlive/2025/texmf-dist/doc/latex/pgfplots/pgfplots.pdf`, section 5.8;
- `/usr/local/texlive/2025/texmf-dist/tex/latex/base/latex.ltx` for the
  document shell.

The installed groupplots source sets the default gaps to `1cm`. More
importantly, a later column is anchored at the preceding axis `east` plus
`horizontal sep`; a later row is anchored at the axis above `south` minus
`vertical sep`. It does **not** translate by the user-requested outer
`width`/`height`. The `x/y descriptions at=edge ...` shortcuts set both the
corresponding label and tick-label edge policies. The base PGFPlots source
sets `try min ticks=4`; TikZKit applies that default only inside this newly
lowered groupplot path.

## Input Inventory

The strict semantic audit accepts every item in the fixture through
`groupplots-shared-descriptions.review.json`:

- packages/libraries: `pgfplots`, `groupplots`;
- commands: `\\documentclass`, `\\usepackage`,
  `\\usepgfplotslibrary`, `\\begin`, `\\end`, `\\nextgroupplot`, and
  four `\\addplot` coordinate streams;
- environments: `document`, `tikzpicture`, `groupplot`;
- group parameters: `group name=measurements`, `group size=2 by 2`, edge
  description modes, and both `0.5cm` separations;
- axis parameters: `width=4cm`, `height=3.5cm`, `xmin/xmax/ymin/ymax=0/2`,
  labels, `grid=major`, the four named colors, and `thick`;
- numeric coordinates: all `0`, `1`, and `2` points in the four plots.

## Three-Way Visual QA

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. MacTeX native PNG, TikZKit JS SVG/PNG,
tikztosvg SVG/PNG, grids, and comparison sheets were generated under:

`/private/tmp/tikzkit-qa-groupplots-final-2026-08-07/`

- MacTeX: `mactex-png/pgfplots-groupplots-shared-descriptions.png`;
- TikZKit: `tikzkit-svg/pgfplots-groupplots-shared-descriptions.svg` and
  `tikzkit-grid-png/pgfplots-groupplots-shared-descriptions.png`;
- tikztosvg: `tikztosvg-svg/pgfplots-groupplots-shared-descriptions.svg` and
  `tikztosvg-grid-png/pgfplots-groupplots-shared-descriptions.png`;
- inspected sheet:
  `diff/pgfplots-groupplots-shared-descriptions-native-sheet.png`.

The tikztosvg SVG uses its native PGFPlots-generated path/glyph form and has
the same four plot frames and 0.5cm physical gutters as the MacTeX PNG;
TikZKit emits independent SVG paths/text but now resolves the same plot-box
geometry. Neither reference uses `foreignObject`; text position follows their
resolved PGF node placement.

### Visible Change

Before this pass TikZKit placed group cells from the requested `4cm` by
`3.5cm` dimensions. Its lower-left panel was roughly `328x278px`, while the
native/tikztosvg panel was about `268x215px`: the two rows and columns had
visibly excessive gaps, and compact axes only showed endpoint ticks.

After the change the TikZKit panel is `268x218px`; all four plot frames share
the native/tikztosvg width and the `0.5cm` gutters. The top-right and
bottom-right cells no longer repeat the y description/tick labels, the top
row no longer repeats the x description/tick labels, and the visible
`0, 0.5, 1, 1.5, 2` major grid cadence matches the reference. The curves,
colors, stroke roles, and paint order remain intact. The remaining three-pixel
height difference and browser glyph rasterization are observable but no group
cell, label, or grid line is missing.

The raw TikZKit-versus-tikztosvg diff is `22.77%` changed pixels with mean
absolute RGBA `0.04907`; after bounded registration it is `14.37%` and
`0.02093`. These figures are only supporting evidence; the inspected panel is
the acceptance basis.

## Implementation And Verification

- `src/frontend/latex-shell.js`: lowers group cells from measured axis boxes,
  applies edge-description suppression, styles, empty cells, capacity
  diagnostics, and the group-local tick default.
- `src/pgfplots/axisTikzLowering.js`: emits resolved `group cCrR` cardinal and
  corner anchors after each lowered axis.
- `test/pgfplots-groupplots.test.js`: verifies edge-label counts, exact
  `0.5cm` anchor gap, usable named anchors, and an addressable empty cell.
- `test/fixtures/examples/pgfplots/groupplots-shared-descriptions.tex`: is the
  reusable real visual fixture; its manifest and strict audit review record
  every observed command, option, and number.
- `src/pgfplots/libraries/groupplots.js`, generated extension registry, and
  `README.md`: record the reviewed partial boundary and usage.

Commands run:

```bash
node --test test/pgfplots-groupplots.test.js
node --test --test-name-pattern='expands PGFPlots groupplots' test/walmes-compat.test.js
node --test test/pgfplots-library-modules.test.js
npm run case:audit -- test/fixtures/examples/pgfplots/groupplots-shared-descriptions.tex \
  --review test/fixtures/examples/pgfplots/groupplots-shared-descriptions.review.json \
  --strict --output /private/tmp/tikzkit-qa-groupplots-final-2026-08-07/case-audit-final.md
npm run examples:render -- --fixtures test/fixtures/examples \
  --only pgfplots-groupplots-shared-descriptions \
  --output /private/tmp/tikzkit-qa-groupplots-final-2026-08-07 \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output /private/tmp/tikzkit-qa-groupplots-final-2026-08-07 \
  --register --alignment-radius 3
```

The focused tests and strict case audit pass with no diagnostics. The current
broader `test/pgfplots-seams.test.js` run still reports 29 unrelated
calibration assertions across ordinary tick labels, 3D surface coordinates,
and legacy canvas dimensions. This change does not alter the common tick
planner or non-groupplot lowering, so it does not claim that broad suite is
green; those failures need their own source-backed reconciliation.

## Remaining Work

This is not the complete `groupplots` library. `trim axis group`, arbitrary
key-handler nesting, every shared-label mode, arbitrary `at`/anchor overrides,
and general cross-group coordinate transformations still need their own
source-backed tests and visual drivers. The wider PGFPlots axis/tick/text
system remains partial as well.
