# TikZ `topaths` Curve Distance Controls

Date: 2026-09-04

## Scope

This slice implements the shared `to`/`edge` curve state used by ordinary
paths and `chains` joins:

- PGF defaults `out=45`, `in=135`, and `bend angle=30`
- `bend left`, `bend right`, `relative`, `out`, and `in`
- `looseness`, `out looseness`, and `in looseness`
- `distance`, `min distance`, and `max distance`
- independent `out/in distance`, `out/in min distance`, and
  `out/in max distance`
- source-order updates between distinct curve option keys

Explicit `out control`, `in control`, `controls`, arbitrary `to path`
callbacks, and repeated identical-key timeline preservation are not claimed.

## Local TeX Live Review

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarytopaths.code.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-edges.tex`

`tikz.code.tex` loads `topaths` as a core library. The source initializes the
curve angles to 45 and 135 degrees. It computes a base arm length of about
0.3915 times the endpoint distance, multiplies each side by its looseness,
then clamps the outgoing and incoming lengths independently. An exact
distance sets the corresponding minimum and maximum to the same value.
Every key mutates this state when it is read, so distinct keys are
order-sensitive.

## Reference Tools And Artifacts

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`
- `rsvg-convert`: `/opt/homebrew/bin/rsvg-convert`
- `pdflatex`: `/Library/TeX/texbin/pdflatex`
- Before: `outputs/qa-to-path-distance-2026-09-04-before`
- Accepted: `outputs/qa-to-path-distance-2026-09-04-final2`
- TikZKit SVG/PNG: `tikzkit-svg/`, `tikzkit-png/`
- tikztosvg SVG/PNG: `tikztosvg-svg/`, `tikztosvg-png/`
- MacTeX PNG: `mactex-png/`
- Four-panel sheets and diffs: `diff/`, `diff-png/`

The tikztosvg SVG uses cubic `C` path data and separate filled arrow-tip
paths. It emits `stroke-linecap="butt"`, `stroke-linejoin="miter"`, and
transforms TeX coordinates into the SVG viewBox. TikZKit emits the same cubic
topology and line-cap/join choices, with inline arrow paths rotated to the
terminal tangent. TikZKit keeps live text elements while tikztosvg converts
TeX glyphs to reusable paths; this explains most remaining raster residual.

## Visual Results

### Flowchart

Before, the outgoing 16mm minimum and incoming 8mm maximum constraints were
ignored, so the curved branches entered the rectangular nodes on shallower
arcs than MacTeX. After the fix, both branch pairs have the same turning
direction, peak position, border clipping, and arrow landing as the two
references. The TikZKit image is 414x138px versus tikztosvg 415x139px.

### Mathematics

Before, `min distance=13mm` did not activate the default curved path. The
upper morphism collapsed onto the straight `f` arrow, its `g` label overlapped
the center, and the image height was only 87px versus the 126px reference.
After the fix, `g` is a separate upper arch and the independently constrained
lower morphism matches the reference. The image is now 241x124px versus
241x126px.

### Physics

Before, the asymmetric feedback control arms produced a second low loop and
expanded the image to 344x144px versus the 343x122px reference. After the fix,
the sensor-to-summing-junction feedback is one correctly routed curve with
the label below it. The image is 344x121px versus 343x122px.

The diff ratios improved from 6.03% to 5.74% for the flowchart, 38.71% to
6.47% for mathematics, and 9.80% to 8.95% for physics. These numbers support,
but do not replace, the panel inspection above.

## Source Audit

### `to-path-distance-flowchart`

Commands/environments: `documentclass`, `usepackage`, `usetikzlibrary`,
`document`, `tikzpicture`, `node`, `path`, `begin`, and `end`.

Options: standalone `border`; local `process`, `decision`, and `route`
styles; `draw`, `rounded corners`, `minimum width`, `minimum height`,
`align`, `diamond`, `aspect`, `fill`, `Stealth[length]`, `thick`; edge
`out`, `in`, `min distance`, `max distance`; edge-node `above` and `below`.

Numbers: border/rounding 2pt; process 22mm x 8mm; decision 20mm x 10mm with
aspect 2; tip length 2mm; node coordinates 0, 3, 5.6, +/-1.35, and 8.6cm;
angles +/-35, 180, 0, and +/-145 degrees; minimum 16mm; maximum 8mm; color
mixes 8, 10, 12, and 20 percent.

### `to-path-distance-math`

Commands/environments: the same document shell plus `node` and `path`; math
content includes composition. Options: object/morphism styles, `draw`,
`circle`, `minimum size=12mm`, `inner sep=1pt`, `Latex[length=2mm]`,
`thick`, fills, edge-node `above/below`, `min distance=13mm`, angles -35 and
-145 degrees, `out min distance=7mm`, and `in max distance=8mm`. Node
coordinates are 0 and 5cm.

### `to-path-distance-physics`

Commands/environments: the document shell plus `node` and `path`; math
content includes `hat`. Options: block/signal styles, `draw`, `circle`,
`minimum width=22mm`, `minimum height=9mm`, `minimum size=9mm`, `align`,
`Stealth[length=2mm]`, `very thick`, fills, `above/below`; first feedback
angles -90/0 with exact outgoing/incoming distances 8/14mm; second feedback
angles 180/-90, looseness 0.35/2, outgoing minimum 11mm, and incoming maximum
9mm. Node coordinates use 0, 2, 5, 6, 8, and -2cm.

All listed commands, options, and numeric values are covered by the focused
tests and saved visual artifacts. No diagnostics are emitted.

The workbench fixture audit endpoint now reads an adjacent `.review.json`
file and includes its contents in the cache key. All three cases therefore
show `accepted` in the browser with zero review todos and zero blockers; an
unreviewed editor draft continues to use an empty review.

## Verification

- `node --test test/to-path-distance.test.js test/chains-curved-joins.test.js test/chains-multiple-joins.test.js test/library-modules.test.js test/web-server.test.js` (31 passed)
- `node scripts/case-semantic-audit.js test/fixtures/examples/paths/curve-distance-<case>.tex --review test/fixtures/examples/paths/curve-distance-<case>.review.json --strict` (all three accepted)
- `node scripts/render-example-fixtures.js --output outputs/qa-to-path-distance-2026-09-04-final2 --only to-path-distance-flowchart --only to-path-distance-math --only to-path-distance-physics --native-reference --strict-tikztosvg`
- `node scripts/diff-example-pngs.js --output outputs/qa-to-path-distance-2026-09-04-final2`
- `npm run extension-registry`
- `npm test` (1937 total, 1800 passed, 123 existing failures, 14 skipped; no baseline increase)

Acceptance: passed for this bounded option family.
