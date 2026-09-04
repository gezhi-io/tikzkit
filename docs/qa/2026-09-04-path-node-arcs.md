# Arc Path-Node Timers

## Scope

This round implements one shared path-node feature family: exact parameter-time
placement and local tangents for nodes attached to circular and elliptical arc
operations. It includes increasing and decreasing angles plus `pos`, `sloped`,
`auto`, and `swap`. No fixture-specific coordinate is encoded in the engine.

Three permanent examples drive the implementation:

- `test/fixtures/examples/paths/arc-node-flowchart.tex`
- `test/fixtures/examples/paths/arc-node-math.tex`
- `test/fixtures/examples/paths/arc-node-physics.tex`

## Local MacTeX Study

Read these installed TeX Live 2025 sources and documentation:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`, lines 3691-3741 and 4953-4970. TikZ records the arc start/end angles and both radius axes, then installs `tikz@timer@arc`; a path node invokes `pgftransformarcaxesattime` rather than interpolating the endpoints.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorepoints.code.tex`, lines 567-616. `pgfpointarcaxesattime` interpolates the angle affinely in time, evaluates center plus cosine times the zero-degree axis plus sine times the ninety-degree axis, and reverses the tangent when the start angle exceeds the end angle.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcoretransformations.code.tex`, lines 517-538. The arc transform shifts to the evaluated point and rotates by the normalized local tangent, with TikZ's upright correction.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-paths.tex`, lines 540-600. The manual documents `start angle`, `end angle`, `delta angle`, `radius`, `x radius`, `y radius`, and compact arc syntax.

TikZKit already painted arcs as cubic SVG segments, but retained only the arc's
two endpoints for later path-node placement. Thus `pos` and `sloped` followed
the endpoint chord instead of the ellipse parameter and derivative.

## Third-Party Reference

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`. PNG conversion used
`/opt/homebrew/bin/rsvg-convert`; native PNGs used local MacTeX.

The focused semantic probe artifacts are:

- `/private/tmp/path-node-arc-probe.tex`
- `/private/tmp/path-node-arc-probe.tikz`
- `/private/tmp/path-node-arc-probe.svg`
- `/private/tmp/path-node-arc-probe.png`
- `/private/tmp/path-node-arc-probe-native.png`
- `/private/tmp/path-node-arc-probe-tikzkit-before.png`

The one-off wrapper returned status 1 during temporary-directory cleanup but
left a valid SVG. The permanent harness completed all three cases with zero
external failures. In the reference SVG, arcs are cubic `C` path commands with
butt caps and miter joins; arrow tips are independent paths with transforms,
and text glyphs are pre-shaped and transformed along the local tangent. There
is no `foreignObject`. MacTeX remains the acceptance reference.

## Visual Evidence

All permanent artifacts are in
`outputs/qa-path-node-arcs-2026-09-04/`:

- `tikzkit-svg/` and `tikzkit-png/`
- `tikztosvg-input/`, `tikztosvg-svg/`, and `tikztosvg-png/`
- `mactex-png/` and `mactex-log/`
- `diff/`, including native sheets and old/new/native sheets

I inspected all three native sheets and all three old/new/native sheets.
Before the change, the flowchart's `approve` and `revise` labels were horizontal
inside the ellipse, the mathematical `gamma(theta)` label followed the chord
near the radius, and the physics labels were inside the orbit with one covering
the focus. After the change:

- Flowchart: both labels sit outside their arcs and follow the local tangent.
- Mathematics: `gamma(theta)` follows the circular tangent at `P(theta)`.
- Physics: `v(t)` and `a(t)` follow opposite requested normals of the elliptical orbit.

No path, arrow, formula, color, or layer is missing. Residual differences are
mostly browser glyph outlines and small canvas extents. Registered TikZKit to
MacTeX mean absolute RGBA is 0.01686, 0.00642, and 0.02507 respectively; these
numbers support, but do not replace, the visual acceptance.

## Implemented Commands And Parameters

Implemented and exercised in this slice:

- Commands and syntax: `\draw`, `\node`, inline path `node`, `arc`, circular and elliptical arc options, and increasing/decreasing traversal.
- Arc parameters: `start angle`, `end angle`, `radius`, `x radius`, and `y radius`; the shared parser also retains `delta angle` and compact syntax support.
- Path-node parameters: `pos`, `sloped`, `auto`, `auto=left`, `auto=right`, `swap`, and explicit `anchor`.
- Geometry: affine parameter-angle evaluation, transformed ellipse axes, analytic derivative, traversal direction, upright tangent correction, and opposite local normal anchors.
- Supporting figure options: named anchors, rounded rectangles, colors, line widths, arrows.meta tips, and math labels.

Not completed by this slice:

- Arbitrary custom soft-path operation timers.
- Exact automatic anchor geometry under non-uniform canvas transforms.
- TeX glyph outlines; browser SVG text remains metrically calibrated text.

## Verification

```bash
node --test test/path-node-arcs.test.js \
  test/path-node-auto-sloped.test.js test/path-node-curves.test.js
node scripts/render-example-fixtures.js \
  --fixtures test/fixtures/examples \
  --output outputs/qa-path-node-arcs-2026-09-04 \
  --only paths-arc-node-flowchart \
  --only paths-arc-node-math \
  --only paths-arc-node-physics \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg \
  --external-timeout-ms 120000
node scripts/diff-example-pngs.js \
  --output outputs/qa-path-node-arcs-2026-09-04 \
  --register --alignment-radius 6
```

The focused and related path batch passes 23/23. The render batch produces 3/3
TikZKit SVG/PNG, 3/3 tikztosvg SVG/PNG, and 3/3 MacTeX PNG references with zero
TikZKit diagnostics and zero external failures.

The complete suite contains 1991 tests: 1848 pass, 129 retain known historical
failures, and 14 are skipped. The pre-change snapshot contains 1983 tests: 1840
pass, the same 129 fail, and the same 14 are skipped. All eight added tests pass,
and the 128 named historical failures are identical before and after this change
(the remaining failure is suite-level in both runs).

## Remaining Boundary

The next path-node slice should address custom soft-path timers. The physics
example's small bounding-box residual belongs to shared text and stroke extent
accounting rather than the arc point/tangent calculation.
