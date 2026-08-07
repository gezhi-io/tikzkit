# Polygonal Shape Curved Arrow Terminal Padding QA

## Scope

This pass accepts one `arrows` capability slice: a curved `to[out=...,in=...]`
or curved `edge` with a terminal arrow now leaves the active node border by
half the effective path line width when that border belongs to a rectangle,
diamond, star, or trapezium.

It does not change straight paths, arrowless curved paths, node paint/layout,
or the broader `shapes.geometric` implementation.

The permanent visual driver is
`test/fixtures/examples/arrows/shape-curved-terminal-padding.tex`.

## Local MacTeX Study

Reviewed TeX Live 2025:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`
  (around lines 3229--3239): unanchored curve endpoints call
  `\\pgfpointshapeborder` in the curve's terminal tangent direction.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.geometric.code.tex`:
  diamond's `anchorborder` intersects the ray with its diagonal side;
  star builds separate outer/inner miter radii; trapezium offsets each corner
  and selects the border side by the external ray angle.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex`:
  confirms that these are shape-border calculations rather than arrow-tip
  geometry.

The shared implementation therefore finds the original tangent-ray side,
computes that side's outward unit normal from the polygon winding, and offsets
the terminal point by `half line width / dot(tangent, outward normal)`. This is
the side-local form of PGF's outer-separation/miter construction.

## References And Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; its SVG was rendered
to PNG with `/opt/homebrew/bin/rsvg-convert`.

- Before: `/private/tmp/tikzkit-qa-arrow-shape-curved-tips-before-2026-08-07/`
- After: `/private/tmp/tikzkit-qa-arrow-shape-curved-tips-after-2026-08-07/`

Both directories contain TikZKit SVG/PNG/grid, tikztosvg SVG/PNG/grid, native
MacTeX PNG, and a four-panel diff sheet. The inspected after sheet is:

`/private/tmp/tikzkit-qa-arrow-shape-curved-tips-after-2026-08-07/diff/arrows-shape-curved-terminal-padding-native-sheet.png`

The tikztosvg SVG uses separate cubic body paths and transformed filled Latex
tip paths, with butt caps and miter joins. Its diamond, star, and trapezium
are explicit boundary paths. TikZKit uses the equivalent Scene Graph form:
polygon/node paths, cubic bodies, then transformed inline tips.

## Visual Result

Before the change, TikZKit did not apply marker-aware padding to these four
shape families. In the JS SVG the five terminal-tip origins were at
`(389.90,-164.11)`, `(451.89,-119.72)`, `(-16.61,255.80)`,
`(477.91,269.30)`, and `(362.30,330.00)`, leaving tips on or inside the
painted node boundary.

After the shared offset, they are `(380.21,-162.40)`, `(448.87,-113.24)`,
`(-18.48,245.18)`, `(475.35,262.27)`, and `(355.07,330.00)`: visibly outside
the matching rectangle, diamond, star, and trapezium sides, in the same
direction as native MacTeX and tikztosvg. This is a real endpoint-geometry
improvement, not a diff-only change.

The remaining sheet difference is deliberately recorded: TikZKit's preexisting
star/trapezium sizing makes its canvas `292x282px` while native MacTeX is
`324x263px`. This pass does not claim to solve that independent shape-layout
gap.

## Source Inventory

`docs/qa/2026-08-07-arrow-shape-curved-terminal-padding-audit.md` records the
complete source inventory: 1 package, 2 libraries, 7 commands, 19 option
paths, and 32 numeric literals. The rendering-relevant subset is:

- `\\node`: `rectangle`, `diamond`, `star`, `trapezium`, `aspect`, `minimum
  width`, `minimum height`, `minimum size`, `star points`, `star point ratio`,
  `trapezium left angle`, and `trapezium right angle`;
- `\\draw`: `to[out=...,in=...]`, terminal `Latex[...]` tips, and explicit
  `line width=4pt`;
- `tikzpicture`: the `x=1cm` and `y=1cm` coordinate basis values.

The audit deliberately remains **incomplete** rather than claiming the entire
shape case is accepted: exact star/trapezium sizing and vertex-ray miter
selection remain outside this arrow-crop slice. It is the complete parameter
checklist for the next shape-layout pass, not a hidden unsupported set.

## Commands And Acceptance

```sh
node --test --test-name-pattern='curved terminal arrows beyond|curved arrow tips|regular polygon sizing' test/interpreter.test.js

npm run examples:render -- --fixtures test/fixtures/examples \
  --only arrows-shape-curved-terminal-padding \
  --output /private/tmp/tikzkit-qa-arrow-shape-curved-tips-after-2026-08-07 \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg \
  --tikztosvg-engine pdflatex

node scripts/diff-example-pngs.js \
  --output /private/tmp/tikzkit-qa-arrow-shape-curved-tips-after-2026-08-07 \
  --register
```

Focused regression: 3 passed, 0 failed. All TikZKit, tikztosvg, and MacTeX
artifacts were generated with zero external failures and no interpreter
diagnostics.

`npm run gallery:audit` also completed 332/332 core fixtures with 0
diagnostics. The broad `npm test` run still has 17 unrelated existing failures
(circuitikz color expectations, path-local empty nodes, and older transform
expectations among them); they are not modified or treated as passing here.

## Remaining Work

Exact PGF miter selection for a ray landing precisely on a polygon vertex,
non-polygon custom shapes, tip-specific separation keys, full declared-arrow
hulls, and star/trapezium native sizing/rotation remain partial.
