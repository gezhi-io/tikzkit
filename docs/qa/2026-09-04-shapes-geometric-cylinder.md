# PGF shapes.geometric cylinder QA

## Scope

- Library slice: the `cylinder` node shape from `shapes.geometric`.
- Accepted geometry: `shape aspect`, quarter-turn `shape border rotate`, natural content size, `minimum width`, `minimum height`, and `minimum size`.
- Accepted paint: ordinary node paint plus `cylinder uses custom fill`, `cylinder body fill`, and `cylinder end fill`.
- Accepted routing: curved border intersection and the named anchors used by the fixtures (`shape center`, `before top`, `before bottom`, `top`, `bottom`, and cardinals).
- Out of scope: arbitrary non-quarter rotation/incircle mode and the complete radial/mid/base anchor family.

## Local source review

- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex:684-790` documents aspect, rotation, minimum-size behavior, custom fill, and cylinder anchors.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.geometric.code.tex:4019-4475` contains the actual saved-anchor and background-path algorithms.

The implementation follows four details from the local PGF source:

1. `shape aspect` is the end ellipse x-radius divided by its y-radius.
2. The ordinary border rotation is quantized to quarter turns, and 90/270 degrees swap content axes and inner separations.
3. PGF fixes the natural end x-radius before `minimum width` expands the cross radius. Recomputing the aspect afterwards produces ends that are visibly too deep.
4. The outline is a compound path: two half ellipses and two body lines, followed by the visible end arc. Custom body and end colors are separate fill paths beneath the outline.

The body half-length and end chord use the source's `cos(asin(...))` compensation. The same resulting contour now drives SVG paint, bounds, named anchors, and ray-to-border clipping.

## Reference artifacts

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`.
- Rasterizer: `/opt/homebrew/bin/rsvg-convert`.
- Native engine: `/Library/TeX/texbin/pdflatex`.
- Before: `outputs/qa-shapes-geometric-cylinder-2026-09-04-before/`.
- After: `outputs/qa-shapes-geometric-cylinder-2026-09-04-after/`.
- Four-way sheets:
  - `diff/shapes-cylinder-manual-catalog-native-sheet.png`
  - `diff/shapes-cylinder-data-flow-native-sheet.png`
  - `diff/shapes-cylinder-volume-physics-native-sheet.png`
- Saved SVGs are under `tikzkit-svg/` and `tikztosvg-svg/` in each QA directory.

The tikztosvg SVG agrees closely with MacTeX. It uses a y-flipping transform, cubic path data for ellipse halves, `stroke-linecap="butt"`, `stroke-linejoin="miter"`, and `fill-rule="nonzero"`. Custom fill produces independent body and visible-end paths before the stroked compound outline.

## Visual result

Before this change, all cylinders were plain rectangles. The manual catalog lost its elliptical ends and independent colors, database nodes had rectangular arrow clipping, and the physics tank had the wrong silhouette, bounds, and anchor positions.

After the change:

- The manual catalog has the same four cylinder topologies as MacTeX: natural horizontal, minimum-height vertical, minimum-width horizontal, and custom-filled vertical.
- Minimum width no longer deepens the end ellipse; it expands only the cross radius as the PGF source specifies.
- The flowchart's storage nodes have separate orange body/end fills, and connecting arrows terminate on the curved outline.
- The physics tank uses the intended shallow end ellipses, asymmetric cylinder bounds, center/radius anchors, and top/bottom-related anchors.
- All three browser renders report zero diagnostics.

The remaining visible differences are mostly font rasterization, antialiasing, and small subpixel text offsets. Diff images are retained as supporting evidence, not as the acceptance criterion.

## Command and parameter audit

| Source item | Status | Implementation |
| --- | --- | --- |
| `\documentclass[border=4pt]{standalone}` | accepted wrapper | document extraction and crop margin |
| `\usepackage{tikz}` | implemented | package registry |
| `\usetikzlibrary{shapes.geometric,positioning,calc,arrows.meta}` | implemented for used slices | library registries |
| `\begin{tikzpicture}[>=Stealth]` | implemented | scoped arrow default |
| `every node/.style`, named `process`, `store`, and `flow` styles | implemented | style expansion |
| `\node[cylinder]` | implemented for this slice | cylinder layout and SVG shape renderer |
| `shape aspect=.32/.35/.5` | implemented | natural ellipse radius ratio |
| `shape border rotate=90` | implemented | quarter-turn axis swap and geometry rotation |
| `minimum width`, `minimum height`, `minimum size` | implemented | PGF cylinder-specific sizing order |
| `cylinder uses custom fill` | implemented | separate body/end paint paths |
| `cylinder body fill`, `cylinder end fill` | implemented | normalized TikZ colors |
| `draw`, `fill`, `line width`, `rounded corners`, `align` | implemented for fixture usage | shared node styles |
| `right=of`, `right=12mm of`, `below=7mm of`, `node distance` | implemented | positioning library |
| `\draw[->|<->,thick]` | implemented | path and arrow renderer |
| `(node.east/west/top/bottom/shape center/before top/before bottom)` | implemented | cylinder anchors and border crop |
| `($(node.anchor)+(x,y)$)` | implemented | calc coordinate offset |
| inline `node[above|left]` on a path | implemented | path-node positioning |
| formulas with `\pi`, superscripts, `\rho`, and multiline `\\` | implemented | browser math/text renderer |

No command or parameter used by these three focused fixtures is silently ignored. The library remains `partial` because the out-of-scope cylinder modes and other geometric shapes are not complete.

## Verification

```sh
node --test test/shapes-geometric-cylinder.test.js
node scripts/render-example-fixtures.js --only shapes-cylinder-manual-catalog,shapes-cylinder-data-flow,shapes-cylinder-volume-physics --output outputs/qa-shapes-geometric-cylinder-2026-09-04-after --native-reference --strict-tikztosvg --continue-on-external-failure --math-renderer svg-text
node scripts/diff-example-pngs.js --output outputs/qa-shapes-geometric-cylinder-2026-09-04-after
```

The focused cylinder suite passes 3/3. The broader renderer/architecture selection passes 123/125; its two remaining failures are existing font/bounds expectations unrelated to the cylinder implementation.

## Next slice

Continue `shapes.geometric` with either the remaining cylinder anchor family or one complete additional node shape. The strongest next visual candidate is `shapes.symbols` database/tape symbols if the registry confirms higher corpus impact.
