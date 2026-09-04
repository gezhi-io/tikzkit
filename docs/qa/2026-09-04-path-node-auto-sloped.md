# Auto And Sloped Path Nodes

## Scope

This round implements one shared path-node feature family: combined `auto` and
`sloped` placement on straight lines, cubic curves, and both orthogonal path
operators. It also verifies the active `|-` or `-|` leg selected by `pos`.
No fixture-specific coordinate is encoded in the renderer.

Three permanent examples drive the implementation:

- `test/fixtures/examples/paths/auto-sloped-flowchart.tex`
- `test/fixtures/examples/paths/auto-sloped-math.tex`
- `test/fixtures/examples/paths/auto-sloped-physics.tex`

## Local MacTeX Study

Read these installed TeX Live 2025 sources and documentation:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`, lines 1095-1125, 2872-2938, 4156-4171, 4462-4535, and 4894-4946. TikZ applies the automatic anchor before the path timer. During automatic-anchor selection it temporarily disables sloping, so the ordinary left/right choice becomes local `south`/`north`; the real timer then rotates that anchor with the active path tangent. The horizontal-vertical and vertical-horizontal timers divide `[0,1]` equally, and exactly `.5` belongs to the second leg.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcoretransformations.code.tex`, lines 468-497 and 566-590. Line and cubic timers construct a normalized tangent frame, and reverse it when required to keep text upright.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-shapes.tex`, lines 1866-2040. The manual confirms `pos`, the orthogonal corner at `.5`, `auto`, `swap`, `sloped`, and `allow upside down` semantics.

The missing TikZKit behavior was not the existing equal-half orthogonal timer.
The sloped-node branch bypassed `auto`, leaving the label center on the stroke.

## Third-Party Reference

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`. PNG conversion used
`/opt/homebrew/bin/rsvg-convert`; the native reference used local MacTeX.

The semantic probe artifacts from this run are:

- `/private/tmp/path-node-auto-sloped-probe.tex`
- `/private/tmp/path-node-auto-sloped-probe.tikz`
- `/private/tmp/path-node-auto-sloped-probe.svg`
- `/private/tmp/path-node-auto-sloped-probe.png`
- `/private/tmp/path-node-auto-sloped-probe-native.png`
- `/private/tmp/path-node-auto-sloped-probe-tikzkit-before.png`
- `/private/tmp/path-node-auto-sloped-probe-tikzkit-after.png`

The wrapper produced a valid reference SVG but returned status 1 while cleaning
its temporary directory. The permanent comparison harness completed with zero
external failures. The reference uses path-local transforms for glyphs and
places default `auto` and `swap` on opposite local normals, matching MacTeX.

## Visual Evidence

All permanent artifacts are in
`outputs/qa-path-node-auto-sloped-2026-09-04/`:

- `tikzkit-svg/` and `tikzkit-png/`
- `tikztosvg-input/`, `tikztosvg-svg/`, and `tikztosvg-png/`
- `mactex-png/` and `mactex-log/`
- `diff/`, including native and old/new/native sheets

I inspected all three native sheets and all three old/new/native sheets. Before
the fix, every combined `auto,sloped` label was centered directly on its path.
After the fix:

- Flowchart: `submit` and `approve` clear their horizontal arrows; `changes`
  follows the first vertical leg, and swapped `retry` uses the opposite side.
- Mathematics: `f`, `g`, `p`, and `q` use opposite local sides as requested;
  `\pi_1` and `\pi_2` follow their own legs of the same orthogonal path.
- Physics: `r(t)`, `e(t)`, `u(t)`, and `y(t)` clear the signal lines; `measure`
  and swapped `y_m(t)` match the feedback path's active local normal.

No path, arrow, node, formula, color, or layer is missing. Flowchart and
mathematics have the same canvas dimensions as MacTeX. Physics retains a 2 by
1 pixel canvas-size residual and browser glyph-outline differences; neither is
a path-node placement error. Registered TikZKit-to-native mean absolute RGBA is
0.01923, 0.01158, and 0.02452 respectively; these figures are supporting data,
not the acceptance criterion.

## Implemented Commands And Parameters

Implemented and exercised in this slice:

- Commands and syntax: `\draw`, `\node`, `\coordinate`, inline path `node`,
  straight `--`, cubic path support inherited from the shared timer, `|-`, and
  `-|`.
- Path-node parameters: inherited `auto`, `auto=left`, `auto=right`, `swap`,
  `sloped`, `pos`, local `font`, and multiple inline nodes on one path.
- Geometry: line/cubic tangent frames, upright correction, local
  `south`/`north` shape-anchor displacement, and equal-half orthogonal timers.
- Supporting figure options: named shape anchors, circles, rounded rectangles,
  diamonds, minimum dimensions, `aspect`, draw/fill colors, thick strokes,
  `Stealth`/`Latex` tip lengths, and math labels.

Not completed by this slice:

- Arc-specific path-node timers.
- Arbitrary custom soft-path operation timers.
- Exact automatic anchor geometry under non-uniform canvas transforms.
- TeX glyph outlines; browser SVG text remains metrically calibrated text.

## Verification

```bash
node --test test/path-node-auto-sloped.test.js \
  test/path-node-curves.test.js test/to-path-controls.test.js
node scripts/render-example-fixtures.js \
  --fixtures test/fixtures/examples \
  --output outputs/qa-path-node-auto-sloped-2026-09-04 \
  --only paths-auto-sloped-flowchart \
  --only paths-auto-sloped-math \
  --only paths-auto-sloped-physics \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg \
  --external-timeout-ms 120000
node scripts/diff-example-pngs.js \
  --output outputs/qa-path-node-auto-sloped-2026-09-04 \
  --register --alignment-radius 6
```

The focused and related path batch passes 26/26. The render batch produces
3/3 TikZKit SVG/PNG, 3/3 tikztosvg SVG/PNG, and 3/3 MacTeX PNG references with
zero TikZKit diagnostics and zero external failures.

The complete suite contains 1983 tests: 1840 pass, 129 retain known historical
failures, and 14 are skipped. The pre-change snapshot contains 1975 tests: 1832
pass, the same 129 fail, and the same 14 are skipped. All eight added tests pass,
and the 128 named historical failures are identical before and after this change
(the remaining failure is suite-level in both runs).

## Remaining Boundary

The next path-node slice should implement arc timers and validate their local
tangent anchors. More broadly, the physics example's small bounding-box
residual belongs to shared text and stroke extent accounting rather than this
anchor-ordering change.
