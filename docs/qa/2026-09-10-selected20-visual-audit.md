# Twenty-Case Visual Audit

## Scope And Result

Selected 20 fixtures across PGFPlots, circuitikz, trees, multipart shapes,
graphs, plot marks, markings, and data visualization. Selection favors the
registry's frequently used partial implementations and visibly different
geometry, labels, and symbols, rather than twenty variations of one graph.
The exact selection is [stored here](2026-09-10-selected20.json).

All 20 cases were rendered with JavaScript, local tikztosvg, and native MacTeX.
All before sheets were visually inspected. Four shared semantic defects were
fixed, with visible improvements in four selected cases. The other 15
deterministic JS SVGs are byte-identical; the unseeded scatter case changes
random points and is not counted as an improvement. Diagnostics remain empty
for all 20. **This is not a 20/20 visual-parity acceptance.**

The earlier path-decoration structural refactor remains in the worktree. It
is not counted as a rendering improvement in this audit. No release, push, or
npm publication was performed for this request.

## Fixes And Local Sources

Installed source root: `/usr/local/texlive/2025/texmf-dist/`.

1. **Colorbar cardinal anchors.** Read
   `tex/generic/pgfplots/pgfplots.code.tex`, lines 1124-1187, 7443-7500,
   and 7605-7664. A colorbar is a child axis: north/south are horizontal
   edge midpoints, east/west are vertical edge midpoints. `colorbarBox()` in
   `src/pgfplots/axis3d.js` now places all nine compass anchors consistently.
   In `pgfplots-colorbar-top-math`, `anchor=south` no longer shifts the bar
   half a width to the right. Parent-description spacing is still imperfect.
2. **Logarithmic tick templates.** Read
   `tex/generic/pgfplots/pgfplotsticks.code.tex`, lines 300-350, 552-602,
   and the logarithmic label helper near 1915. Custom `\tick` templates see
   logarithmic coordinates, unlike linear tick labels after inverse scaling.
   `axisRenderedTickLabels()` in `src/pgfplots/ticks.js` now uses the selected
   log base for templates. Extra ticks at 5 and 50 with zero decimal precision
   show `1*` and `2*`, not `5*` and `50*`. Literal labels and default power
   notation are preserved. Tick-distance planning was also inspected near
   1860-2068 and 2323-2550, but was not changed in this round.
3. **Math angle delimiters.** Read `tex/latex/base/fontmath.ltx`, lines
   485-488: `\langle` and `\rangle` are opening/closing math delimiters,
   with symbol-font slots and extensible variants. `mathFallbackText()` in
   `src/tikz/text.js` now retains the fixed-size Unicode angle glyphs instead
   of printing the command names. The missing-child physics tree displays
   proper ket labels. Existing packaged MacTeX fonts are reused; no external
   font or new font asset was introduced. General stretchy delimiters remain
   outside this fix.
4. **Default node corner radius.** Read
   `tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`, lines 282-283:
   bare `rounded corners` defaults to 4pt and sharp corners reset the radius.
   `nodeCornerRadius()` in `src/engine/evaluate.js` no longer converts boolean
   `true` to 1cm. Explicit `0pt` now remains zero, rather than falling back to
   an arbitrary radius. Graph nodes return from capsules to rounded boxes.
   The separate `rounded rectangle` shape and explicit dimensions are retained.

Package feature descriptions and the two corresponding CSV registry entries
were updated without promoting their support statuses.

## Twenty Cases

Every row below was checked against a native/tikztosvg/JS/diff sheet. The four
changed deterministic cases were checked again after implementation. Unchanged
cases retain the findings from their byte-identical pre-fix render.

| Case | Observed result and remaining work |
| --- | --- |
| `circuitikz-waveform-dimensions-algorithm` | Source body dimensions and wiring match broadly; clock/enable/reset label weight, italic style, and vertical spacing differ. Unchanged. |
| `circuitikz-waveform-dimensions-physics` | Waveform bodies and connections are present; formula weight and label/bounding-box spacing differ. Unchanged. |
| `datavisualization-scatter-south-east-outside` | Function, pin, and outside legend are present; summation layout and axis placement remain different. Random points are unseeded, so their differences are not a fix or acceptance metric. |
| `decorations-markings-position-actions-flowchart` | Marking positions and arrows are present; node outlines and label spacing still differ. Unchanged. |
| `decorations-markings-position-actions-math` | Sample positions and terminal arrow are present; gamma/length label weight and spacing differ. Unchanged. |
| `graphs-node-text-physics` | **Improved:** rounded boxes replace erroneous capsules. Edge formulas still appear heavier than native. |
| `pgfplots-3d-extra-ticks-algorithm` | Handoff/budget annotations are present; automatic y-tick count and label bounds differ. Unchanged. |
| `pgfplots-3d-extra-ticks-math` | **Improved:** custom logarithmic labels read `1*`, `2*`. Missing logarithmic minor ticks and text placement remain. |
| `pgfplots-3d-extra-ticks-physics` | Alarm plane and logarithmic z grid are present; box/tick geometry and formula placement differ. Unchanged. |
| `pgfplots-colorbar-top-algorithm` | Bar/title vertical gap is too large; automatic z ticks differ from native. Unchanged. |
| `pgfplots-colorbar-top-math` | **Improved:** horizontal bar is centered over the parent instead of shifted right. JS still shows only z=0 where native has five ticks; corner tick labels and vertical spacing need work. |
| `pgfplots-colorbar-top-physics` | Gradient and bar dimensions broadly agree; scale-marker placement, vertical gap, and corner tick labels differ. Unchanged. |
| `pgfplots-log-axis-physics` | Data and power labels are present; grid shade and axis/label margins differ. Unchanged. |
| `plotmarks-mark-options-math` | Plot mark transforms are present, but legend samples are gray lines instead of the intended colored diamond/triangle symbols. Unchanged; high-priority follow-up. |
| `shapes-rectangle-split-empty-rules-flowchart` | Part counts, colors, and connectors are present; text metrics and box extents differ slightly. Unchanged. |
| `shapes-rectangle-split-empty-rules-physics` | Parts and connectors are present; formula weight, positioning, and detector baseline differ. Unchanged. |
| `shapes-trapezium-rotation-math` | Rotation and arrows are present; height labels overlap or differ in size/placement. Unchanged. |
| `trees-child-foreach-math` | Child expansion and colors are correct; bottom derivative labels overlap. Unchanged. |
| `trees-edge-path-math` | Orthogonal edge routing is present; circle sizing and formula metrics differ. Unchanged. |
| `trees-missing-physics` | **Improved:** literal `rangle` text is replaced by ket delimiters. Missing-child placement is preserved; glyph weight still differs. |

## Commands And Parameters

Generated one semantic inventory per selected source in the local directory
`outputs/qa/2026-09-10-selected20-audits/`. Each Markdown file lists detected
packages, libraries, commands, environments, declarations, numeric values,
expressions, and options with implementation owners and source locations.
These inventories deliberately remain **incomplete/unbound**; automatic
extraction is not proof that every parameter has been implemented or approved.

Verified by new regression tests:

- Colorbars: horizontal/left/right orientation, explicit `at`, `anchor`,
  `width`, and `height`; all nine compass anchors.
- Ticks: `xmode=log`, base 10 and base 2, custom tick templates,
  `\pgfmathprintnumber[fixed,precision=0]{\tick}`, literal labels, default
  powers, and unchanged linear templates. Existing 2D/3D extra-tick tests pass.
- Text: fixed-size `\langle`, `\rangle`, `\left`/`\right` fallback forms,
  and command-name boundary handling. No general delimiter sizing claim.
- Nodes: bare `rounded corners`, explicit `2pt`/`0pt`, coordinate scale 1/2,
  graph node defaults, and the distinct `rounded rectangle` shape.

Not completed here: native automatic 3D tick-density decisions, logarithmic
minor-tick replay, default colorbar-shift fidelity, mark-aware legend examples,
general TeX math layout/optical sizing, and full PGF random/numeric parity.
Missing diagnostics do not establish any of those capabilities.

## Reference And Artifact Details

`command -v tikztosvg` resolved to `/Library/TeX/texbin/tikztosvg`.
The existing reference harness ran it with the local `pdflatex` engine,
preserved source packages/libraries/preamble through disposable wrappers,
and converted the resulting SVGs with local `rsvg-convert`. Native PNGs were
compiled separately with MacTeX. No online installation was used.

Inspected reference SVG structure: glyph outlines in `defs` reused through
`use`, concrete path data for rounded boxes and arrow tips, `nonzero` fill
rules, butt caps/miter joins, and `matrix(1,0,0,-1,...)` coordinate inversion.
For the graph fixture the reference has a `0 0 246.152 30.871` viewBox and
short cubic corner segments, not semicircular caps. Reference text uses
positioned glyph paths rather than `text`, `font-size`, `text-anchor`, or
`foreignObject`; their absence is intentional. JS text remains dependent on
the packaged MacTeX font faces and browser metrics. Native and tikztosvg have
minor raster/stroke differences themselves; native remains authoritative.

Local artifacts (not part of the npm package):

- `outputs/qa/2026-09-10-selected20-before/`: original JS, native and reference.
- `outputs/qa/2026-09-10-selected20-after/index.html`: 20-case image gallery.
- In each run: `tikzkit-svg/`, `tikzkit-png/`, `tikztosvg-svg/`,
  `tikztosvg-png/`, `mactex-png/`, and `summary.json`.
- `diff/<case>-native-sheet.png`: native top-left, tikztosvg top-right,
  JS bottom-left, native/JS difference bottom-right.
- Semantic inventories: `outputs/qa/2026-09-10-selected20-audits/<case>.md`.

The gallery displays JS and tikztosvg images with 1cm grids. Those grids aid
inspection; physical scale alone is not evidence of origin or bbox alignment.

## Verification

Ten new tests were added across four test files. The focused run passed
30/30; font-policy/assets and rounded-rectangle checks passed 24/24.
The full suite reports **2639 tests: 2483 passed, 142 failed, 14 skipped**.
The 142 failure names exactly match the pre-change baseline: no new failures,
but the full suite is still not green. Architecture checks pass while retaining
the explicitly recorded legacy text-to-frontend dependency.

After the final metadata updates, the combined focused suite passed 54/54.
A redundant final full-suite rerun did not start because automatic permission
review timed out; the full-suite figures above come from the completed run
after all four semantic fixes. The final comparison has 20/20 fresh pairs,
zero missing artifacts and zero stale fingerprints, but 20 visual differences;
its strict acceptance gate remains blocked.

```sh
node --test test/node-rounded-corners.test.js test/math-angle-delimiters.test.js test/pgfplots-log-tick-template.test.js test/pgfplots-colorbar-top.test.js test/pgfplots-3d-extra-ticks.test.js test/pgfplots-extra-ticks.test.js test/shapes-multipart-rounded-custom-fill.test.js
node --test test/font-assets.test.js test/font-policies.test.js test/shapes-misc-rounded-rectangle-arcs.test.js
npm run check:architecture
node --test
```

Re-render the exact selection, then inspect the images rather than treating
the rendering command's exit status as visual acceptance:

```sh
node --input-type=module -e 'import fs from "node:fs"; import {spawnSync} from "node:child_process"; const ids=JSON.parse(fs.readFileSync("docs/qa/2026-09-10-selected20.json")); const result=spawnSync(process.execPath,["scripts/render-example-fixtures.js","--output","outputs/qa/2026-09-10-selected20-after",...ids.flatMap(id=>["--only",id]),"--native-reference","--tikztosvg-engine","pdflatex","--quiet-progress"],{stdio:"inherit"}); process.exit(result.status??1);'
node scripts/diff-example-pngs.js --output outputs/qa/2026-09-10-selected20-after --register
```

Next priority: source-driven automatic 3D ticks and minor ticks, followed by
legend mark examples. Both have visible, unambiguous reference differences;
font weight and dense formula layout remain a separate shared work item.
