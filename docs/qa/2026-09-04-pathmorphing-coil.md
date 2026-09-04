# Pathmorphing Coil State Machine

## Scope

This round implements one bounded `decorations.pathmorphing` family: the
`coil` decoration on straight and cubic paths. The accepted parameter set is
`segment length`, `amplitude`, `aspect`, `pre length`, and `post length`.
The implementation is shared geometry; no fixture coordinates are encoded in
the engine.

Three new examples exercise the slice:

- `test/fixtures/examples/decorations/pathmorphing-coil-flowchart.tex`
- `test/fixtures/examples/decorations/pathmorphing-coil-math.tex`
- `test/fixtures/examples/decorations/pathmorphing-coil-physics.tex`

## Local MacTeX Study

The implementation follows the installed TeX Live 2025 sources:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.pathmorphing.code.tex`, especially the `coil` declaration around lines 205-275. A full state has width `segment length` and emits four cubic curves. The final state has width `0.5 * segment length + 2 * aspect * amplitude`, emits the first two cubics, and then joins the real endpoint. Local coil points use `x = radial x * aspect * amplitude + twelfths * segment length / 12` and `y = radial y * amplitude`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduledecorations.code.tex`, especially the defaults around lines 80-115, path traversal around lines 1160-1555, and curve-length recursion around lines 1807-1955. The defaults are `amplitude=2.5pt`, `segment length=10pt`, and `aspect=0.5`. Curves are first measured by recursive chord subdivision with a `1pt` per-axis tolerance. State advancement then performs a signed-chord binary search from the current Bezier time; its initial time step depends on the complete decorated path length.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.code.tex`. `pre length` and `post length` wrap the internal decoration, while `raise` and `mirror` are additional transforms.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex`, coil section around lines 309-332. `amplitude` is the spring radius, `segment length` is the curl wavelength, and `aspect` changes the projected viewing direction (`0` is a side view; `0.5` is the default).

These sources explain the previous curved-path drift: mapping a target distance
linearly inside a flattened chord is not PGF's traversal model. TikZKit now
keeps a stateful path walker and applies the same iterative distance-to-time
search before installing the exact point and analytic tangent frame.

## Third-Party Reference

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`. PNG conversion used
`/opt/homebrew/bin/rsvg-convert`; MacTeX native references used local
`pdflatex`.

Permanent artifacts are stored in
`outputs/qa-pathmorphing-coil-2026-09-04/`:

- `tikzkit-svg/` and `tikzkit-png/`
- `tikztosvg-input/`, `tikztosvg-svg/`, and `tikztosvg-png/`
- `mactex-png/` and `mactex-log/`
- `diff/` with three native/tikztosvg/TikZKit/diff sheets

The tikztosvg coil is one SVG path. Each full turn contributes four cubic
commands and the final state contributes two, followed by a line to the real
endpoint. It uses `stroke-linecap="butt"`, `stroke-linejoin="miter"`, and no
`foreignObject`. Arrow tips are separate filled paths with a placement
transform. Formula glyphs are referenced from SVG definitions. MacTeX and
tikztosvg agree on the coil state geometry, so both are used as references.

## Visual Result

Before this slice, TikZKit painted only the original guide line: every coil
loop was missing on both straight and curved probes. After the state machine
was added, the straight probe overlays tikztosvg to within terminal-arrow
rasterization. On the cubic probe, the first implementation still accumulated
a small state-origin error; replacing chord-linear interpolation with PGF's
iterative path walker reduced the maximum compared path coordinate difference
from about `0.031bp` to `0.0056bp`.

I inspected all three permanent four-panel sheets:

- Flowchart: the orange retry coil follows the same curved route, loop count, phase, and arrow endpoint in all three renderers. No stage, edge, or label is missing.
- Mathematics: `aspect=0` produces the native side-view oscillation along the complete cubic, including both high-curvature ends. The dashed guide and axes remain aligned.
- Physics: the wall-to-mass spring has the same seven projected loops, straight pre/post sections, line width, and attachment points as MacTeX and tikztosvg.

Remaining visible differences are outside the coil slice: browser text outline
and baseline rasterization, slight pale-fill color differences, and one-to-three
pixel canvas extents. The coil path itself has no missing segment, phase drift,
wrong radius, or endpoint error. Diff metrics are retained as supporting data
in `diff/summary.json`, not used as the sole acceptance criterion.

## Implemented Commands And Parameters

Implemented and exercised:

- Commands and environments: `\documentclass`, `\usepackage`, `\usetikzlibrary`, `\begin{tikzpicture}`, `\draw`, and `\node`.
- Path syntax: `--`, `.. controls ..`, named node anchors, relative `++` coordinates, and path labels.
- Decoration syntax: `decorate` and `decoration={coil,...}`.
- Coil parameters: default and explicit `aspect`, `segment length`, `amplitude`, `pre length`, and `post length`.
- Geometry: native four-cubic full state, two-cubic final state, projected longitudinal radius, recursive curve length, iterative distance-to-time refinement, exact Bezier point, and analytic tangent/normal frame.
- Supporting options: `draw`, `fill`, mixed colors, `line width`, `dashed`, `rounded corners`, `minimum width`, `minimum height`, node anchors, and `arrows.meta` `Stealth[length=...]` tips.

Not implemented by this slice:

- `mirror` and `raise` transforms for coil and legacy `snakes` combinations.
- Other pathmorphing declarations: `saw`, `random steps`, `bent`, and `bumps`.
- Decoration input-control-point bounding-box retention.
- Exact TeX glyph outlines in browser text; TikZKit continues to use calibrated embedded fonts and SVG math glyphs.

## Verification

```bash
node --test test/pathmorphing-coil.test.js \
  test/pathmorphing-curve-frames.test.js \
  test/zigzag-decoration.test.js \
  test/snake-polyline-continuity.test.js
node scripts/render-example-fixtures.js \
  --fixtures test/fixtures/examples \
  --output outputs/qa-pathmorphing-coil-2026-09-04 \
  --only decorations-pathmorphing-coil-flowchart \
  --only decorations-pathmorphing-coil-math \
  --only decorations-pathmorphing-coil-physics \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg \
  --math-renderer svg-text --external-timeout-ms 120000
node scripts/diff-example-pngs.js \
  --output outputs/qa-pathmorphing-coil-2026-09-04 \
  --register --alignment-radius 8
npm run extension-registry
node --test --test-reporter=junit
npm pack --dry-run
```

The focused suite passes `19/19`. The visual batch produces `3/3` TikZKit,
`3/3` tikztosvg, and `3/3` MacTeX SVG/PNG references with zero TikZKit
diagnostics and zero external failures.

The clean baseline has 1,997 tests: 1,859 pass, 124 retain known historical
failures, and 14 are skipped. This change has 2,006 tests: 1,868 pass, the same
124 named failures remain, and the same 14 are skipped. All nine added tests
pass and no historical failure name changes.

## Acceptance

Accepted. The selected real examples show visible coil geometry where it was
previously absent, the curved state origins now follow the installed PGF
algorithm, diagnostics do not increase, and the extension registry records the
implemented subset and reviewed local sources.

The next focused pathmorphing candidate is `bumps`, followed by shared
`mirror`/`raise` transforms for the already implemented snake, zigzag, and coil
state machines.
