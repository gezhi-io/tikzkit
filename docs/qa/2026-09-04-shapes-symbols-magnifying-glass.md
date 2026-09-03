# PGF shapes.symbols magnifying-glass QA

## Slice and acceptance boundary

- Library slice: the `magnifying glass` node family from `shapes.symbols`.
- Priority: the registry listed `shapes.symbols` as partial and every magnifying
  glass node was rendered as a rectangle with no handle.
- In scope: inherited circle sizing, content and minimum sizing, handle angle and
  aspect, circle/compass/numeric anchors, outer separation, node rotation,
  automatic border clipping, marker-free foreground painting, and paint bounds.
- Out of scope: using the node as a real image magnifier and complete TeX math
  typography. The supporting `\nabla` glyph was added because the mathematical
  fixture exposed a literal command leak.

## Local source review

Reviewed these MacTeX 2025 files:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.symbols.code.tex:2562-2613`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduleshapes.code.tex:1187-1305`
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex:824-844`

Implementation points learned from the executable source:

- The shape inherits the complete circle saved state, background path, anchor
  border, and named anchors rather than defining a new node boundary.
- The executable key defaults are angle `-45` and aspect `1.5`.
- The painted circle radius excludes the larger outer separation. Circle anchors
  and automatic border clipping use the radius after that separation is added.
- The handle starts at the painted circle radius and ends at
  `radius * (1 + aspect)` along the requested source angle. Its length is exactly
  `aspect * radius`.
- The handle is a foreground path, so it appears after the node text and expands
  the picture bounds. It does not change anchors or edge clipping.
- The foreground explicitly clears start and end arrows. A node-level arrow style
  must therefore never place a marker on the handle.
- The manual contains two key-name typos: it prints
  `magnifying glass handle angle fill` and
  `magnifying glass handle angle aspect`. TikZKit follows the executable source
  names `magnifying glass handle angle` and
  `magnifying glass handle aspect`.

## Reference artifacts

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`.
- Rasterizer: `/opt/homebrew/bin/rsvg-convert`.
- Native engine: `/Library/TeX/texbin/pdflatex`.
- Before: `outputs/qa-shapes-symbols-magnifying-glass-2026-09-04-before/`.
- Final: `outputs/qa-shapes-symbols-magnifying-glass-2026-09-04-final/`.
- Saved TikZKit SVG/PNG: `tikzkit-svg/` and `tikzkit-png/`.
- Saved tikztosvg SVG/PNG: `tikztosvg-svg/` and `tikztosvg-png/`.
- Saved native PNG: `mactex-png/`.
- Grid overlays: `tikzkit-grid-svg/`, `tikzkit-grid-png/`,
  `tikztosvg-grid-svg/`, and `tikztosvg-grid-png/`.
- Four-way inspected sheets:
  - `diff/shapes-magnifying-glass-inspection-flow-native-sheet.png`
  - `diff/shapes-magnifying-glass-critical-point-native-sheet.png`
  - `diff/shapes-magnifying-glass-field-probe-native-sheet.png`

In the inspected sheets, MacTeX is top-left, tikztosvg is top-right, TikZKit is
bottom-left, and the pixel diff is bottom-right. The tikztosvg SVG constructs the
circle as a cubic path and the handle as an independent open path. It uses butt
line caps, miter joins, nonzero fill, and a y-flipping transform. TeX glyphs are
stored in `defs` and painted with `use`; arrow tips are explicit closed paths.
TikZKit keeps the same circle/handle separation in its scene graph, then emits an
SVG ellipse plus a marker-free handle path after text. MacTeX remains the final
authority where tikztosvg and native output differ.

## Visual result

Before this slice:

- The flowchart used a rectangular Inspect node, omitted the handle entirely,
  clipped both arrows to rectangle sides, and was 14px too short vertically.
- The mathematical fixture used a wide rectangle, omitted the 135-degree handle,
  clipped the incoming arrow and numeric-anchor vector to the wrong contour, and
  printed the `nabla` command name instead of the gradient symbol.
- The field probe used a rectangle. Its incoming field vector, north normal,
  numeric 20-degree ray, and south-east point all met the wrong boundary.

After this slice:

- The flowchart has the native circle, -45-degree handle, centered text, cardinal
  anchors, and foreground ordering. TikZKit, tikztosvg, and MacTeX are all
  `367x80px`.
- The mathematical fixture has the native circle, 135-degree handle, complete
  `\nabla f(x_0)=0` formula, 35-degree numeric anchor, north-west anchor, and
  automatic incoming edge clipping. TikZKit is `273x148px` against the
  `281x149px` reference; the remaining width is the right formula text box and
  glyph rasterization, not missing shape geometry.
- The physics fixture has the native circle, 20-degree long handle, grid,
  automatic field-vector clipping, north and south-east anchors, and numeric ray.
  TikZKit is `203x162px` against the `203x161px` reference.
- All three cases render through TikZKit, tikztosvg, and MacTeX with zero
  diagnostics and zero external-render failures.

The changed-pixel ratios fell from 13.22% to 6.07% for the flowchart, 10.93% to
4.16% for the mathematics fixture, and 10.68% to 9.76% for the field fixture.
The field ratio is dominated by the dense grid and text rasterization; visual
inspection confirms that its focused node geometry and connection points now
match. These numbers support, but do not replace, inspection of the sheets.

## Command and parameter audit

| Source item | Status | Implementation |
| --- | --- | --- |
| `\documentclass[border=2pt]{standalone}` | accepted wrapper | fixture crop and reference harness |
| `\usepackage{tikz}`, `\usepackage{amsmath}` | implemented/accepted for used slice | package registry and document shell |
| `\usetikzlibrary{shapes.symbols,positioning,arrows.meta,calc}` | implemented for used slices | per-library modules |
| `\begin{tikzpicture}[>=...,node distance=...,every node/.style=...]` | implemented | scoped options and style registry |
| `stage/.style`, `flow/.style`, `vector/.style` | implemented | named style expansion |
| `\node[magnifying glass]`, `shape=magnifying glass` | implemented | shared circle geometry and renderer |
| `magnifying glass handle angle=-45/20/135` | implemented | source-angle radial handle |
| `magnifying glass handle aspect=.75/1.2/1.6` | implemented | source-compatible handle length |
| `minimum size=15/18/28mm`, `minimum width`, `minimum height`, `inner sep` | implemented | inherited circle sizing |
| `outer sep=2pt` | implemented | anchor radius only, excluded from paint radius |
| `draw`, `fill`, mixed colors, `line width`, `thick`, `very thick`, `rounded corners`, `font=\small` | implemented for fixture usage | shared options and text layers |
| `right=of`, `node distance` | implemented | positioning library |
| `.north`, `.south`, `.north west`, `.south east`, `.west`, `.east`, `.center`, `.20`, `.35` | implemented | inherited compass and numeric circle anchors |
| automatic `(node)` edge endpoints | implemented | circle border clipping, independent of handle |
| `\draw[->]`, `\draw[dashed]`, `--`, `|-`, `++(x,y)` | implemented | path builder and explicit arrow paths |
| `grid[step=.5]`, inline path nodes, `\fill ... circle` | implemented | path actions and path-node placement |
| `\nabla`, `\vec`, `\hat`, subscripts | implemented for focused SVG-text formulas | math fallback and metrics |

No command or parameter used by these three fixtures is silently ignored.
The `calc` library declaration in the physics fixture is accepted but its
operators are not exercised by that fixture.

## Verification

```sh
node --test test/shapes-symbols-magnifying-glass.test.js test/shapes-symbols-starburst.test.js test/library-modules.test.js
node --test test/renderer.test.js
npm run examples:render -- --output outputs/qa-shapes-symbols-magnifying-glass-2026-09-04-final --only shapes-magnifying-glass-inspection-flow --only shapes-magnifying-glass-critical-point --only shapes-magnifying-glass-field-probe --native-reference --strict-tikztosvg --continue-on-external-failure
npm run examples:diff -- --output outputs/qa-shapes-symbols-magnifying-glass-2026-09-04-final
npm run extension-registry
```

The focused suites pass 18/18. The full renderer file remains at its previous
baseline of 178 passing and 10 pre-existing failures, so this slice adds no
renderer regression. The full repository run reports 1780 passing, 123 existing
failures, and 14 skipped; the failures are the known broad fixture/extension
baseline rather than this slice. The registry now records 372 core cases,
including 21 for `shapes.symbols`.

## Remaining limits and next slice

- Exact TeX glyph painting and text crop bounds still differ slightly from the
  browser SVG text path.
- Non-uniform transformations of inherited node anchors remain part of the
  broader node-transform limitation.
- The symbol is a drawing shape, not an image magnification effect.

All node families declared by the TeX Live 2025 `shapes.symbols` source now have
an implementation. The next round should select the highest-count unsupported
package or library from the regenerated registry rather than broadening this
completed node-family slice.
