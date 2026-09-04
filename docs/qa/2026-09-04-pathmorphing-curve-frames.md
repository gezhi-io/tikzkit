# Curved Pathmorphing State Frames

## Scope

This round implements one shared geometry slice for
`decorations.pathmorphing`: native state-origin frames and analytic cubic
tangents for curved `zigzag` and `snake` decorations. It also replaces the
generic fixed-step flattening used by these decorations with a PGF-style
recursive cubic length estimate. No fixture-specific coordinates are encoded
in the engine.

Three permanent examples drive the implementation:

- `test/fixtures/examples/decorations/pathmorphing-curve-flowchart.tex`
- `test/fixtures/examples/decorations/pathmorphing-curve-math.tex`
- `test/fixtures/examples/decorations/pathmorphing-curve-physics.tex`

## Local MacTeX Study

Read these installed TeX Live 2025 sources and documentation:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.pathmorphing.code.tex`, especially lines 20-48 and 150-210. `zigzag` advances in half-segment states and emits each apex at local `(segment length / 4, +/- amplitude)`. `snake` uses the `initial`, `down`, `up`, `end down`, `end up`, and `final` state sequence with local cubic controls.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduledecorations.code.tex`, especially lines 640-825, 910-940, 1160-1555, and 1690-1965. PGF parses each soft-path segment, estimates cubic length recursively, advances by decorated distance, and installs the exact curve point/tangent transform at every decoration state boundary. The curve-length recursion always starts with one subdivision and stops a piece when both endpoint coordinate differences are below `1pt`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.pathmorphing.code.tex`. This is the TikZ frontend entry that loads the generic pathmorphing declarations.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex`. This documents the pathmorphing keys and their state-machine semantics.

TikZKit previously flattened every cubic to about 25 equal-time chords. It
then sampled a fresh normal at the target apex distance. That is not PGF's
model: a decoration state selects one transform at its origin and interprets
all local points in that frame.

## Third-Party Reference

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`. PNG conversion used
`/opt/homebrew/bin/rsvg-convert`; native PNGs used local MacTeX.

All permanent artifacts are in
`outputs/qa-pathmorphing-curve-frames-2026-09-04/`:

- `tikzkit-svg/` and `tikzkit-png/`
- `tikztosvg-input/`, `tikztosvg-svg/`, and `tikztosvg-png/`
- `mactex-png/` and `mactex-log/`
- `diff/` with three four-panel native sheets
- `before-after/zigzag-curve-before.png` and `before-after/zigzag-curve-after.png`

The tikztosvg SVG represents zigzag as one line-command path and snake as one
cubic-command path. Both use butt caps and miter joins. Arrow tips are separate
filled paths with transforms, formulas are glyph paths referenced from `defs`,
and there is no `foreignObject`. Its path geometry agrees with MacTeX, so this
slice follows their shared state-frame behavior.

## Visual Evidence

I inspected the native, tikztosvg, TikZKit, and diff panels for all three new
examples, plus the before/after S-curve probe.

Before the change, the JavaScript zigzag visibly missed the reference at the
left vertical tangent, the upper bend, and the final rising bend. Its first
apex was `(-0.186368, 0.212760)` instead of the native local-frame result
`(-0.2, 0.2)`. The first snake control was `(0.006598, 0.099782)` instead of
the analytic-tangent result `(0, 0.1)`.

After the change:

- Flowchart: the curved zigzag transition keeps the reference phase and apex orientation through both changes of curvature, and its arrow remains attached to the decorated endpoint.
- Mathematics: the snake wave follows the dashed cubic without phase or normal drift at the high-curvature left and right ends.
- Physics: `pre length`, `post length`, and the smooth curved wave match the reference while the terminal Stealth tip remains a late paint operation.

No path, arrow, node, formula, color, or layer is missing. For the focused
S-curve probe, TikZKit versus tikztosvg changed pixels fall from 4,182 to 1,949
and mean absolute RGBA falls from 0.00304 to 0.00112. TikZKit versus MacTeX mean
absolute RGBA falls from 0.00456 to 0.00291. These values support the directly
visible alignment and are not the acceptance criterion by themselves.

The three permanent math and physics canvases differ from tikztosvg by only
one raster row. The flowchart still has a bounding-box difference: MacTeX and
tikztosvg retain vertical extent from the original cubic controls, while
TikZKit currently sizes to the painted replacement path. The drawing geometry
is aligned, but shared decoration input-path bounding-box accounting remains a
separate slice.

## Implemented Commands And Parameters

Implemented and exercised in this slice:

- Commands and syntax: `\usetikzlibrary`, `\draw`, `\node`, `.. controls ..`, and ordinary `--` path segments.
- Decoration action: `decorate` and `decoration={snake,...}` or `decoration={zigzag,...}`.
- Decoration parameters: `segment length`, `amplitude`, `pre length`, and `post length`.
- Geometry: recursive cubic subdivision with the native `1pt` per-axis stopping tolerance, exact cubic point evaluation, analytic tangent/normal evaluation, and one local transform per decoration state.
- State semantics: zigzag quarter apex, alternating half-segment states, center finish, snake startup/cycle/end states, and phase continuity across line/curve subpaths.
- Supporting options: colors, line widths, dashed guide paths, node anchors, rounded rectangles, and `arrows.meta` Stealth tips with `length`.

Not completed by this slice:

- PGF's iterative distance-to-curve-time refinement beyond the recursive chord estimate.
- Exact `mirror` and `raise` state-frame behavior for legacy `snakes` options.
- Other pathmorphing declarations: `saw`, `random steps`, `bent`, `bumps`, and `coil`.
- Decoration input-path control-point bounding boxes after path replacement.
- Exact browser text outlines; TikZKit continues to use calibrated SVG text and embedded math glyph paths.

## Verification

```bash
node --test test/pathmorphing-curve-frames.test.js \
  test/zigzag-decoration.test.js \
  test/snake-polyline-continuity.test.js \
  test/snakes-legacy-options.test.js \
  test/snake-arrow-lengths.test.js
node scripts/render-example-fixtures.js \
  --fixtures test/fixtures/examples \
  --output outputs/qa-pathmorphing-curve-frames-2026-09-04 \
  --only decorations-pathmorphing-curve-flowchart \
  --only decorations-pathmorphing-curve-math \
  --only decorations-pathmorphing-curve-physics \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg \
  --external-timeout-ms 120000
node scripts/diff-example-pngs.js \
  --output outputs/qa-pathmorphing-curve-frames-2026-09-04 \
  --register --alignment-radius 8
npm run extension-registry
```

The focused suite passes 16/16. The render batch produces 3/3 TikZKit SVG/PNG,
3/3 tikztosvg SVG/PNG, and 3/3 MacTeX PNG references with zero TikZKit
diagnostics and zero external failures.

The complete suite contains 1995 tests: 1853 pass, 128 retain known historical
failures, and 14 are skipped. The clean pre-change snapshot contains 1989
tests: 1847 pass, the same 128 named failures, and the same 14 are skipped. All
six added tests pass and no historical failure name changed.

## Files Changed

- `src/engine/evaluate.js`
- `src/tikz/libraries/decorations.pathmorphing.js`
- `test/pathmorphing-curve-frames.test.js`
- `test/zigzag-decoration.test.js`
- `test/fixtures/examples/decorations/pathmorphing-curve-flowchart.tex`
- `test/fixtures/examples/decorations/pathmorphing-curve-math.tex`
- `test/fixtures/examples/decorations/pathmorphing-curve-physics.tex`
- `docs/extension-registry.md`
- `docs/extension-registry.csv`
