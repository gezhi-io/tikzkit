# `arrows.meta` Curved Tip Bending

## Scope

This round implements one bounded arrow family: `bend`, `flex`, and `flex'`
for built-in `arrows.meta` tips on terminal cubic paths. It also applies PGF's
sequence rule that promotes quick sibling tips to rigid `flex` placement when
one tip requests bending. The SVG renderer and bounds pass share the same
curvilinear geometry. Polar declaration bending, arbitrary nonlinear
transforms, and user-declared arrow bending modes remain outside this slice.

Three permanent examples exercise the capability in new diagram types:

- `test/fixtures/examples/arrows/meta-bending-flowchart.tex`
- `test/fixtures/examples/arrows/meta-bending-math.tex`
- `test/fixtures/examples/arrows/meta-bending-physics.tex`

They cover a feedback flow, mathematical morphisms, and curved physical
vectors. Together they exercise high curvature, both curve directions,
different flex factors, nonlinear bend deformation, colored fills and strokes,
node-border endpoints, labels, and SVG bounds.

## Local MacTeX Study

Read these installed TeX Live 2025 sources and documentation:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmodulebending.code.tex`.
  `flex` is mode 1 and uses visual tip/back endpoints; `flex'` is mode 2 and
  uses the ultimate assembly endpoints; `bend` is mode 3 and maps every arrow
  point through a curvilinear transformation. A factor of zero retains the
  terminal tangent, while one aligns the chosen back endpoint to the curve.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibrarycurvilinear.code.tex`.
  PGF reverses the terminal cubic so distance zero is the path endpoint and
  builds a distance-to-time lookup before evaluating points, tangents, and
  normals. TikZKit uses the same model with a deterministic 128-sample lookup
  instead of the source's four speed samples.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex`.
  Precise shortening is enabled for flexible/bent tips. If one tip in a
  sequence bends, quick sibling tips are rendered with flex placement.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.meta.code.tex`.
  The Stealth visual back endpoint is its inset, so `flex` uses
  `length - inset`; this is distinct from the complete arrow assembly span
  used by `flex'`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcoretransformations.code.tex`.
  `\pgftransformarrow` establishes a rigid normalized frame between the curve
  back and tip points without scaling the arrow artwork.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-arrows.tex`.
  The examples confirm that `flex` keeps the tip rigid, while `bend` visibly
  curves the arrow artwork itself.

## Third-Party Reference

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`. PNG conversion used
`/opt/homebrew/bin/rsvg-convert`; native references used local MacTeX.

A five-row semantic probe is preserved at:

- `outputs/qa-arrows-meta-bending-2026-09-04/probe/tikzkit-arrows-meta-bending-probe.tex`
- `outputs/qa-arrows-meta-bending-2026-09-04/probe/tikzkit-arrows-meta-bending-probe.svg`
- `outputs/qa-arrows-meta-bending-2026-09-04/probe/tikzkit-arrows-meta-bending-probe-white.png`

The reference SVG shows rigid `flex`/`flex'` tips as local arrow paths with an
SVG matrix. Its `bend` tip is instead emitted as a deformed global path with
cubic segments and no rigid tip transform. Stems use butt caps and miter joins;
filled Stealth tips inherit their path color. TikZKit now emits the same
structural distinction: rigid matrix transforms for flex modes and transformed
global geometry for bend.

## Visual Evidence

All generated artifacts are in:

- `outputs/qa-arrows-meta-bending-2026-09-04/tikzkit-svg/`
- `outputs/qa-arrows-meta-bending-2026-09-04/tikztosvg-svg/`
- `outputs/qa-arrows-meta-bending-2026-09-04/{tikzkit,tikztosvg,mactex}-png/`
- `outputs/qa-arrows-meta-bending-2026-09-04/diff/`

I inspected the three native four-way sheets. In the flowchart, the blue and
green rigid tips use different curvature-aligned frames, and the orange
feedback tip bends into the return curve while meeting the Sense node. In the
math example, all three morphisms retain their distinct curve directions and
the purple tip bends around the lower arc. In the physics example, the red
velocity tip, green momentum tip, and blue magnetic-force tip remain aligned
at visibly different curvatures without clipping or faceting.

No path, arrow, color, layer, or label is missing. Residual differences are
mostly text rasterization and canvas height: flowchart width differs by one
pixel, math height by nine pixels, and physics height by two pixels. The math
example's lower circular path label sits slightly higher in TikZKit; that is a
pre-existing path-node anchor issue and is deliberately left for a separate
node-placement slice. Arrow geometry itself visually agrees with both local
references.

## Visible Improvement

Before this slice, the parser discarded `bend`, `flex`, and `flex'`; every
curved arrow tip was merely rotated to the terminal tangent. After the change,
flex factors choose distinct rigid curve frames, `flex'` uses the assembly
span, bend maps the complete arrow outline through the curve normal field, and
the computed viewBox includes that transformed paint. The difference is
visible at the highly curved blue flow arrow, purple morphism, and red physical
trajectory.

Registered pixel differences are supporting evidence only. The three examples
have zero TikZKit diagnostics and zero external-renderer failures. Acceptance
is based on the inspected tip shape, attachment, orientation, line caps/joins,
colors, and bounds rather than aggregate diff thresholds.

## Verification

```bash
node --test test/arrows-meta-bending.test.js test/arrows-declared.test.js \
  test/declared-arrow-extents.test.js test/snake-arrow-lengths.test.js
node scripts/render-example-fixtures.js \
  --fixtures test/fixtures/examples \
  --output outputs/qa-arrows-meta-bending-2026-09-04 \
  --only arrows-meta-bending-flowchart,arrows-meta-bending-math,arrows-meta-bending-physics \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg \
  --external-timeout-ms 120000
node scripts/diff-example-pngs.js \
  --output outputs/qa-arrows-meta-bending-2026-09-04 \
  --register --alignment-radius 6
```

The focused suite passes 12/12. Rendering produces 3/3 TikZKit SVG/PNG,
tikztosvg SVG/PNG, and MacTeX PNG references. In the same sandbox, the full
suite reports 1966 tests, 1824 passing, 128 failing, and 14 skipped. An archive
of unchanged `HEAD` reports 1962 tests, 1819 passing, 129 failing, and 14
skipped. Comparing failed test names shows no new failure; all four new tests
pass, and one pre-existing registry-contract failure is removed.

## Remaining Boundary

Polar arrow declaration bending modes, arbitrary user-declared tip bending,
arbitrary nonlinear path transformations, and exact PGF soft-path deformation
remain partial. The next focused visual issue exposed by these examples is
path-node vertical placement on a curved path, especially a shaped
`node[midway,below]`.
