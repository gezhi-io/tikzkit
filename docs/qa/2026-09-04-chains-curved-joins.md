# Chains Curved Join QA

## Scope

- Library: TikZ `chains`.
- Slice: lower `join=by {...}` and repeatable `join=with <chain>-end by {...}` through the standard edge path so joins honor `bend left`, `bend right`, `out`, `in`, and `looseness`.
- Priority: straight synthetic joins were visibly wrong in flowchart, mathematical dependency, and physical feedback diagrams even though the requested join styles parsed without diagnostics.
- Boundary: this round covers edge geometry, native style order, node-border clipping, and tangent-aware arrow tips. It does not claim arbitrary custom `to path` callbacks, edge nodes inside join specifications, arbitrary `after node path`, or arbitrary path continuation after `\chainin`.

## MacTeX Review

Reviewed local TeX Live 2025 files:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarychains.code.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-chains.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarytopaths.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorepathusage.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex`

Implementation findings:

- A chain join is lowered to `(from) edge[every join,<local join style>] (current)` rather than to a plain line segment.
- The effective style order is inherited path state, `every edge`, `every join`, then the join-local style.
- The standard `to path` implementation owns `bend left/right`, `out/in`, and `looseness`. Its default cubic control distance is approximately `0.3915 * chord length * looseness`.
- The normal edge pipeline recomputes shape-border intersections for cubic endpoints. Arrow shortening and tip orientation then use the terminal path tangent.

## Reference Tools And Artifacts

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`
- SVG rasterizer: `/opt/homebrew/bin/rsvg-convert`
- Final QA directory: `outputs/qa-chains-curved-joins-2026-09-04-final/`
- Pre-fix baseline: `outputs/qa-chains-curved-joins-2026-09-04-before/`
- Browser comparison: `http://127.0.0.1:5174/?chains-curved=1#chains-curved-joins-physics-feedback`

Each QA directory contains MacTeX native PNG, TikZKit SVG/PNG, tikztosvg SVG/PNG, 1 cm grid renders, diff PNGs, and combined sheets. All three final cases rendered in all engines with zero diagnostics and zero external-render failures.

## SVG Structure Review

- TikZKit now emits cubic path data for curved joins. For example, the flowchart join includes `M 370.58 -109.30 C 442.81 -49.51 493.61 -13.03 575.10 -7.89`.
- Its arrow tip is a separate filled path rotated by the cubic's terminal tangent, for example `rotate(3.613601)`.
- tikztosvg likewise emits a cubic path and a separate filled arrow-tip path under its TeX transform matrix.
- Both references use butt line caps, miter joins, and nonzero-filled arrow tips. TikZKit uses an internal 100 units/cm viewBox and SVG text with bundled Computer Modern fonts; tikztosvg uses a point-based viewBox and glyph paths.

## Visual Acceptance

Before the fix, all requested joins were straight diagonals. The style names were accepted but their geometric meaning was lost.

After the fix:

- `chains-curved-joins-flowchart`: the blue and dashed red joins bend symmetrically into `Published`; arrows follow the terminal tangent and stop at the node border.
- `chains-curved-joins-math-dependencies`: the blue and orange `out/in/looseness` joins reproduce the smooth dependency entry geometry instead of taking straight shortcuts.
- `chains-curved-joins-physics-feedback`: the upper blue and lower orange feedback arcs converge into the summing node; the controller connection uses the same cubic edge machinery while remaining visually straight for `out=0,in=180`.

The remaining visible differences are small font-glyph, subpixel raster, and one-to-two-pixel bounding-box differences. There are no missing paths, wrong join layers, or new diagnostics. The final TikZKit/tikztosvg mean absolute RGBA differences are 0.010936, 0.014576, and 0.012198 respectively; these values are secondary to the inspected geometry.

## Command And Parameter Audit

Commands and environments exercised:

- `\documentclass[border=2pt]{standalone}`
- `\usepackage{tikz}`
- `\usetikzlibrary{arrows.meta,chains}`
- `tikzpicture`, `\node`, `\path`, named nodes, chain aliases, edge paths, and math labels

Implemented parameters exercised:

- `start chain=<name> going right`, `on chain=<name>`, automatic chain placement, and explicit placement of the first node
- repeatable `join=with <chain>-end by {...}` and `join=by {...}`
- `every edge`, `every join`, `.style`, and native override order
- `bend left`, `bend right`, `out`, `in`, and `looseness`
- node anchors, node-border clipping, `edge`, `-{Stealth[length=2mm]}`, and `-{Latex[length=2mm]}`
- `draw`, `fill`, color mixes, `thick`, `very thick`, `dashed`, `rounded corners`, `align`, and minimum node dimensions

Numeric audit:

- Flowchart: 2 pt page border, 2 pt corners, 22 mm by 8 mm process nodes, first-node positions `(0,1.5)` and `(0,-1.5)`, destination `(7,0)`, bend angle 18 degrees, and 2 mm Stealth tips.
- Mathematical dependencies: 24 mm by 9 mm nodes, first-node positions `(0,1.6)` and `(0,-1.6)`, destination `(7,0)`, `out=-8/in=160` and `out=8/in=-160`, looseness 1.25, and 2 mm Latex tips.
- Physical feedback: 22 mm by 9 mm blocks, first-node positions `(0,1.7)` and `(0,-1.7)`, destination `(7,0)`, 11 mm summing circle, bend angle 22 degrees, feedback looseness 1.15, controller `out=0/in=180/looseness=1.05`, and 2 mm Stealth tips.

Known partial behavior:

- Arbitrary custom `to path` callbacks are not executed.
- Edge nodes embedded inside join specifications are not complete.
- Ordered side effects when mixing bend and explicit `out/in` options, remembered bend angles, and distance/min/max control variants remain partial.
- Arbitrary `after node path` code and arbitrary continuation after `\chainin` remain partial.

## Changes And Tests

Changed implementation and metadata:

- `src/engine/evaluate.js`
- `src/tikz/libraries/chains.js`
- `docs/extension-registry.csv`
- `docs/extension-registry.md`

Added regression coverage:

- `test/chains-curved-joins.test.js`
- `test/fixtures/examples/chains/curved-joins-flowchart.tex`
- `test/fixtures/examples/chains/curved-joins-math-dependencies.tex`
- `test/fixtures/examples/chains/curved-joins-physics-feedback.tex`
- `test/fixtures/examples/manifest.json`

Focused result: 10/10 chain tests pass. The chain tests combined with `test/interpreter.test.js` produce 280 passes and the same 18 pre-existing failures. The full suite produces 1,791 passes, the same 123 pre-existing failures, and 14 skips across 1,928 tests. This slice adds no failure or diagnostic.

## Next Slice

The next useful `chains` slice is edge nodes inside joins plus ordered `to path` option semantics. It should reuse the same standard edge lowering rather than adding chain-specific geometry.
