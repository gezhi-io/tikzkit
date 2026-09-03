# PGF shapes.symbols cloud QA

## Scope

- Library slice: the `cloud` node shape from `shapes.symbols`.
- Accepted geometry: content/aspect fitting, `minimum width`, `minimum height`, `cloud puffs`, `cloud puff arc`, and `cloud ignores aspect`.
- Accepted routing: cardinal/diagonal anchors, numeric border anchors, `puff n` anchors, `cloud anchors use ellipse`, and curved edge clipping.
- Out of scope: exact TeX rounding for non-integral puff counts and the remaining `shapes.symbols` families.

## Local source review

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.symbols.code.tex:569-1379` contains the cloud keys, saved radii, two-cubic puff construction, anchors, and border search.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex:846-934` documents cloud fitting, minimum-size semantics, and the anchor family.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduleshapes.code.tex:887-923` provides the inherited inner/outer separation and minimum-size defaults.

The implementation follows the source algorithm rather than the previous decorative approximation:

1. The text box plus inner separation is enclosed by an ellipse whose radii are multiplied by `sqrt(2)` and then fitted to `aspect`, unless `cloud ignores aspect` is true.
2. With puff step `p=360/n` and `k=sin(p/2)tan(a/4)`, the circum-ellipse radii are `X=cos(p/2)x+ky` and `Y=cos(p/2)y+kx`. Minimum dimensions are applied to `X` and `Y`, then the 2x2 system is inverted to recover the painted inner ellipse.
3. Every puff is a circular arc shorter than 180 degrees and is emitted as two cubic Bezier segments, matching PGF's Riskus-based construction.
4. The same circular-puff geometry drives SVG paint, `puff n` anchors, compass anchors, bounding boxes, and edge-to-node clipping.

The TeX Live 2025 source initializes `cloud puff arc=150`; the nearby manual prose still says 135. TikZKit follows the executable source default.

## Reference artifacts

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`.
- Rasterizer: `/opt/homebrew/bin/rsvg-convert`.
- Native engine: `/Library/TeX/texbin/pdflatex`.
- Before: `outputs/qa-shapes-symbols-cloud-2026-09-04-before/`.
- Final: `outputs/qa-shapes-symbols-cloud-2026-09-04-final/`.
- Four-way sheets:
  - `diff/shapes-cloud-service-flow-native-sheet.png`
  - `diff/shapes-cloud-uncertainty-set-native-sheet.png`
  - `diff/shapes-cloud-plasma-region-native-sheet.png`
- TikZKit and tikztosvg SVGs are retained under `tikzkit-svg/` and `tikztosvg-svg/`.

The tikztosvg SVG is close to native MacTeX. It uses one closed path per cloud, two cubic `C` segments per puff, `fill-rule=nonzero`, butt line caps, miter joins, and a y-flipping transform for the dvisvgm coordinate system. Text is converted to glyph paths, while TikZKit keeps font-backed SVG text.

## Visual result

Before this change, cloud nodes were fixed 24-segment sinusoidal polygons. `cloud puffs`, `cloud puff arc`, and `aspect` did not control the outline; puff anchors were absent; and arrows clipped against an unrelated ellipse.

After the change:

- The service flow has ten smooth puffs, a two-line centered label, and arrows touching the true west/east cloud boundary.
- The uncertainty-set diagram has seven 125-degree puffs. `puff 1` and `puff 4` land on their circular arc crests, and the explicit minimum dimensions make the cloud geometry independent of browser-versus-TeX formula advances.
- The plasma diagram has thirteen tighter 110-degree puffs, ignores `aspect` as requested, and clips the blue/red physical vectors to the real outline.
- All three TikZKit, tikztosvg, and MacTeX renders complete with zero diagnostics.

Visible residuals are limited to font glyph/antialiasing differences and small text baseline shifts. As supporting numbers, the uncertainty fixture is `365x178` versus tikztosvg `365x174`, and the plasma fixture differs by one pixel in height. The acceptance decision is based on the inspected sheets and grid placement, not those values alone.

## Command and parameter audit

| Source item | Status | Implementation |
| --- | --- | --- |
| `\documentclass[border=2pt]{standalone}` | accepted wrapper | document extraction and crop margin |
| `\usepackage{tikz}` | implemented | package registry |
| `\usepackage{amsmath}` | accepted for fixture | formula command normalization |
| `\usetikzlibrary{shapes.symbols,arrows.meta,positioning,calc}` | implemented for used slices | per-library registries |
| `\begin{tikzpicture}[>=Stealth|Latex]` | implemented | scoped arrow defaults |
| `\node[cloud]` | implemented for this slice | cloud layout and SVG shape renderer |
| `cloud puffs=7|10|13` | implemented | puff count and angular step |
| `cloud puff arc=110|125|150` | implemented | circular radius and two-cubic arcs |
| `aspect=1.7|2.2` | implemented | inner ellipse aspect fit |
| `cloud ignores aspect` | implemented | independent x/y content radii |
| `cloud anchors use ellipse` | implemented and unit-tested | circum-ellipse border branch |
| `minimum width`, `minimum height`, `inner sep`, `outer sep` | implemented | PGF sizing equations |
| `(node.puff 1)`, `(node.puff 4)`, compass and numeric anchors | implemented | shared cloud geometry |
| `right=of`, `right=... of` | implemented | positioning library |
| `($(node.west)+(x,y)$)` and `++(x,y)` | implemented | calc/relative coordinates |
| `\draw[->,thick] (node) -- (node)` | implemented | true cloud border clipping and arrow renderer |
| `\fill ... circle`, `draw`, `fill`, colors, line width | implemented | shared path and style renderer |
| inline formulas, subscripts, superscripts, `\mathcal`, `\varepsilon`, `\mathbf` | implemented for fixture usage | SVG math text renderer |

No command or parameter used by these three focused fixtures is silently ignored. The library remains `partial` because the other `shapes.symbols` node families are not all implemented.

## Verification

```sh
node --test test/shapes-symbols-cloud.test.js
npm run examples:render -- --output outputs/qa-shapes-symbols-cloud-2026-09-04-final --only shapes-cloud-service-flow --only shapes-cloud-uncertainty-set --only shapes-cloud-plasma-region --native-reference --strict-tikztosvg --continue-on-external-failure
npm run examples:diff -- --output outputs/qa-shapes-symbols-cloud-2026-09-04-final
```

## Next slice

Continue `shapes.symbols` with one source-bounded family such as `starburst`, or move to a high-frequency shared text-metric slice for natural-width math labels. Do not mix those concerns into the accepted cloud geometry.
