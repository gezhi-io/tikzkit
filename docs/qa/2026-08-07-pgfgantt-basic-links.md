# `pgfgantt` Basic Links QA (2026-08-07)

## Scope

This pass implements one bounded `pgfgantt` slice: `\ganttlink` between
named bars, groups, and milestones. It covers the package defaults, `auto`,
`r`, `rdr`, `rdldr`, `dr`, `s-s`, `s-f`, `f-s`, and `f-f` routing, together
with `link label` and `link/.append style`. Calendar/date slots, progress,
`\ganttlinkedbar`, custom `\newganttlinktype` definitions, and arbitrary link
anchor styles are intentionally outside this change.

The driver is `test/fixtures/examples/pgfgantt/basic-links.tex`, adapted from
the local `pgfgantt` manual. It links three named tasks, uses the package's
default `auto` path for Research to Prototype, and explicitly uses `f-s` plus
the visible `F--S` label for Prototype to Release.

## Local MacTeX Study

Read locally:

- `/usr/local/texlive/2025/texmf-dist/tex/latex/pgfgantt/pgfgantt.sty`;
- `/usr/local/texlive/2025/texmf-dist/doc/latex/pgfgantt/pgfgantt-doc.pdf`.

The implementation follows concrete package rules:

- lines 1425-1451 define the default `-latex, rounded corners=1pt` link
  style, label font, and `link mid`, `link bulge`, and `link tolerance`;
- lines 1452-1488 define the direct, RDR, and RDLDR polylines;
- lines 1490-1505 select direct links only when start/end anchors differ by
  at most one TeX point, otherwise choose RDR or RDLDR from horizontal
  tolerance;
- lines 1506-1554 choose the documented source and target anchors for
  `dr`, start/start, start/finish, finish/start, and finish/finish links;
- lines 1595-1619 show that `\ganttlink` resolves named elements through the
  normal east/west anchors before dispatching the selected link type.

## Three-Renderer Evidence

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`.

Before implementation, all three artifact families existed in
`outputs/qa-pgfgantt-basic-links-before-2026-08-07/`, but the TikZKit panel
contained the title, grid, and task bars without either blue dependency link.

After implementation, the verified artifacts are in
`outputs/qa-pgfgantt-basic-links-after-2026-08-07/`:

- MacTeX PNG: `mactex-png/pgfgantt-basic-links.png`;
- TikZKit SVG/PNG: `tikzkit-svg/pgfgantt-basic-links.svg` and
  `tikzkit-png/pgfgantt-basic-links.png`;
- tikztosvg SVG/PNG: `tikztosvg-svg/pgfgantt-basic-links.svg` and
  `tikztosvg-png/pgfgantt-basic-links.png`;
- comparison sheets: `diff/pgfgantt-basic-links-native-sheet.png` and
  `diff/pgfgantt-basic-links-sheet.png`.

The inspected after panels show both blue links in the same grid regions as
MacTeX and tikztosvg: the default link leaves the Research bar's east side,
turns right/down/right with rounded corners, and ends at Prototype's west
side; the finish-to-start link runs diagonally from Prototype's south-east
corner to Release's north-west corner with a filled Latex tip and `F--S`
beside it. The chart still has a small canvas and font-rasterization
difference, but it no longer drops dependency semantics.

The tikztosvg SVG at
`outputs/qa-pgfgantt-basic-links-after-2026-08-07/tikztosvg-svg/pgfgantt-basic-links.svg`
contains a blue multi-segment rounded path and a separate filled blue Latex
tip path for the automatic link, followed by a blue diagonal path and filled
tip for `f-s`. The `F--S` label is separate text/glyph output. TikZKit's SVG
now produces two corresponding stroked paths with inline Latex tips; its
renderer, rather than the parser, owns the final tip geometry.

## Changes And Verification

- `src/frontend/latex-shell.js` retains named Gantt element bounds while
  lowering chart rows, parses two-argument `\ganttlink` commands, and lowers
  the reviewed anchor/routing subset into shared `\draw` commands.
- `test/walmes-compat.test.js` asserts the blue Latex-tipped auto and `f-s`
  links plus the explicit label.
- `test/fixtures/examples/pgfgantt/basic-links.tex` and its manifest entry
  provide the real visual regression fixture.
- `src/packages/pgfgantt.js`, generated registry files, and `README.md`
  document the reviewed partial boundary.

```bash
node --test --test-name-pattern='pgfgantt' test/walmes-compat.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-pgfgantt-basic-links-after-2026-08-07 \
  --only pgfgantt-basic-links --native-reference \
  --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-pgfgantt-basic-links-after-2026-08-07 \
  --register --alignment-radius 3
npm run extension-registry
```

The focused test passes and MacTeX, tikztosvg, and TikZKit each produced the
fixture without TikZKit diagnostics. Acceptance is based on the visibly
restored links and their anchors, tip direction, and label, not on the
aggregate pixel number alone.

## Remaining Work

`pgfgantt` remains partial. The next self-contained slices are date/calendar
time slots, progress rendering, `gantttitlelist`, custom bar/group shapes, or
user-declared link types. Each needs its own native geometry study and real
three-renderer visual fixture.
