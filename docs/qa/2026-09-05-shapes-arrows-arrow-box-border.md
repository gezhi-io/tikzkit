# QA: `shapes.arrows` arrow-box border sectors

## Scope

This follow-up slice implements PGF-compatible automatic border intersection
for `arrow box`. The acceptance boundary is center, numeric, base, and mid
border anchors plus node-to-node line clipping. The painted polygon, arrow
dimensions, text metrics, and general `positioning` layout are not reworked in
this slice.

## Local Source Reading

Reviewed locally:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.arrows.code.tex`, especially the `arrow box` `\anchorborder` implementation at lines 2180-2355.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduleshapes.code.tex`, especially `\pgfpointshapeborder` at lines 597-668.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex`, especially the arrow-box contract and border-anchor example at lines 1402-1505.

`\pgfpointshapeborder` transforms the external point into the node's local
coordinate system, subtracts the shape center, and invokes the shape-specific
border function. The arrow-box border function then restores its chosen
reference point, computes an external angle, selects one of a fixed set of
named-anchor edge pairs, and intersects two infinite lines. It does not choose
the nearest intersection with the painted polygon.

This distinction matters when an arrow is suppressed. TeX Live 2025 defines a
suppressed `south arrow tip` as `east`, while the other suppressed south
anchors fall back to `south`. At exactly 180 degrees, the fixed comparison tree
therefore selects the line from that hidden east anchor to a hidden south
anchor. Its intersection is the east side, so a westward incoming connection
can cross the target arrow box before ending. MacTeX and tikztosvg both expose
this compatibility behavior.

## Implemented Commands And Parameters

The permanent flowchart, mathematics, and physics drivers cover:

| Construct | Result |
| --- | --- |
| `\node[arrow box]` | Uses the arrow-box shape's source-derived local contour and anchor table. |
| `arrow box arrows={east:8mm}` | Exercises a one-sided box with suppressed north, south, and west arrows. |
| `arrow box arrows={west:6mm,east:8mm}` | Exercises horizontal automatic clipping through a two-sided target. |
| `arrow box arrows={north:16mm from center,south:7mm,east:18mm from center,west:6mm}` | Exercises all angular sectors, center-relative lengths, and numeric anchors. |
| `arrow box shaft width`, `head extend`, `head indent`, `tip angle` | Keeps the named edge points tied to non-default geometry. |
| `outer sep` and arrow terminal padding | Rebuild the outer anchor geometry before the same PGF sector selection. |
| `<node>`, `<node>.<angle>`, `base east/west`, `mid east/west` | Share the PGF decision tree and infinite-line intersection. |
| `rotate=18` | Resolves the border in local coordinates before restoring node rotation. |
| `\draw[->] (capture) -- (validate)` | Clips both nodes through the shape-specific border function. |
| `to[out=-90,in=-90,looseness=1.35]` | Retains the explicit south-anchor retry curve without changing this slice. |

No option or literal number in the three drivers is silently discarded. The
remaining visual differences are owned by text metrics, positioning width, and
rasterization, not by arrow-box border selection.

## Three-Way References

The local tools used were:

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`
- MacTeX `pdflatex`: `/Library/TeX/texbin/pdflatex`
- `rsvg-convert`: `/opt/homebrew/bin/rsvg-convert`

Artifacts are under:

`outputs/qa/2026-09-05-shapes-arrows-border-after/`

The directory contains TikZKit SVG/PNG, tikztosvg SVG/PNG, MacTeX PNG,
registered diffs, and native four-panel sheets for `arrow-box-flowchart`,
`arrow-box-math`, and `arrow-box-physics`. The pre-fix comparison is the prior
implementation snapshot:

`outputs/qa/2026-09-04-shapes-arrows-arrow-box-after/`

In the tikztosvg flowchart SVG, the first connector is a butt-capped,
miter-joined path from about `x=94.07pt` to `x=237.21pt`; its filled arrow-tip
path ends near the target's east tip. Text is emitted as reusable glyph paths
under a y-flipping transform, and the document uses a `0 0 371.864 112.141`
viewBox. TikZKit likewise emits separate line and filled tip paths with butt
caps and miter joins, but retains its semantic 100-units-per-centimeter
viewBox and SVG text nodes.

## Visual Result

Before this slice, the flowchart's first black connector stopped before the
west tip of `Validate`, and the second stopped before the west tip of
`Publish`. MacTeX and tikztosvg instead crossed each target and ended at its
east-side border. The missing horizontal spans were plainly visible in the
four-panel sheet.

After this slice, TikZKit follows both reference images: the first semantic
endpoint moves from `x=3.442` to `x=7.327`, and the second from `x=8.727` to
`x=11.783`. Both black arrows now cross their target boxes and terminate on the
far side. The retry curve, fills, labels, and shape positions remain stable.
The all-direction mathematics case and rotated physics case show no anchor,
rotation, grid, or force-vector regression.

Pixel metrics move only slightly because the corrected spans occupy a small
part of the image: the flowchart's unregistered TikZKit-to-native changed ratio
moves from `0.11464` to `0.11449`. The visible connector topology is the
acceptance signal; the remaining large diff regions are font antialiasing,
native grid darkness, and the existing 27-pixel flowchart width difference.

All three cases render with zero TikZKit diagnostics, zero tikztosvg failures,
and zero MacTeX failures.

## Verification

```bash
node --test test/shapes-arrows-arrow-box.test.js
node --test test/shapes-arrows-arrow-box.test.js test/arrows-spaced-shapes.test.js test/shapes-geometric-semicircle.test.js test/shapes-misc-rounded-rectangle-arcs.test.js
node scripts/render-example-fixtures.js --output outputs/qa/2026-09-05-shapes-arrows-border-after --only arrow-box-flowchart --only arrow-box-math --only arrow-box-physics --continue-on-external-failure --strict-tikztosvg --native-reference --native-latex-engine pdflatex --tikztosvg-engine pdflatex --math-renderer svg-text
node scripts/diff-example-pngs.js --output outputs/qa/2026-09-05-shapes-arrows-border-after --register
npm run extension-registry
node --test --test-reporter=tap
node --test test/web-server.test.js
```

The focused shape and arrow suite passes 20/20. The complete sandboxed suite
contains 2212 tests: 2066 pass, 132 known failures remain unchanged, and 14 are
skipped. Five of those failures are only the sandbox's localhost bind
restriction; they pass 5/5 with local port permission. The effective baseline
is therefore 2071 passing, 127 known failures, and 14 skipped, exactly one new
passing regression beyond the preceding revision.

## Remaining Limits

`shapes.arrows` remains `partial`. Exact TeX text-box widths, exhaustive
negative or self-intersecting dimensions, the source typo in the rarely
selected `before north head` branch, and every radial edge case of `single
arrow` and `double arrow` still require dedicated slices.
