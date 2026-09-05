# Spy Rectangular Lenses

## Scope

This slice implements rectangular `spy` source windows and target lenses with
independent `width` and `height`, role-specific `spy on` and `spy in` options,
rectangular clipping, and the default outline/overlay styles. It is driven by
three permanent algorithm, mathematics, and physics fixtures under
`test/fixtures/examples/spy/rectangular-lenses`.

The boundary is deliberately limited to circular and axis-aligned rectangular
lenses. It does not claim arbitrary node-shape clipping, rotated or nested
lenses, magnified text/nodes/fills, or every possible `connect spies` path.

## Local TeX Reading

Reviewed
`/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryspy.code.tex`.
The library creates the source `spy on` node first and the target `spy in`
node as an ordinary TikZ shape. The saved picture is transformed by the lens,
its source window uses the inverse lens transform, and the magnified result is
clipped to the target node. `size` maps to minimum size, while `width` and
`height` are independent. `spy using outlines` gives the source a very-thin
outline and the target a thick outline; `spy using overlays` fills both with
opacity `0.2` and text opacity `1`.

Reviewed
`/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-spy.tex`.
The manual confirms that the complete picture, including line widths and text,
is magnified and clipped to the spy-in node. It also demonstrates rectangular
lenses and role-specific source/target node options. These rules are the basis
for keeping command-level `spy on` options separate from the options supplied
after `in node`.

## Visual References

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`. Native references
used `/Library/TeX/texbin/pdflatex`, and SVG-to-PNG conversion used
`/opt/homebrew/bin/rsvg-convert`.

The complete before/after artifacts are stored in:

- `outputs/qa/2026-09-05-spy-rectangular-lenses-before`
- `outputs/qa/2026-09-05-spy-rectangular-lenses-after`

Each directory contains native MacTeX PNGs, TikZKit SVG/PNGs, tikztosvg
SVG/PNGs, registered diffs, grid views, and four-way comparison sheets for all
three fixtures.

Before the fix, TikZKit turned every requested rectangle into a circle. The
independent width and height collapsed into one radius, magnified paths leaked
through a circular boundary, and overlay lenses had the wrong outline. After
the fix, the algorithm and mathematics examples use wide rectangular source
windows and target lenses, with every magnified segment clipped at all four
edges. The physics example now uses the same translucent green rectangular
fills and no default outline as MacTeX and tikztosvg. Remaining visible
differences are chiefly grid stroke weight, crop rounding, and browser/native
text rasterization rather than missing lens geometry.

As an auxiliary signal, the TikZKit-to-tikztosvg changed-pixel ratios moved
from `15.91%` to `13.84%` for the algorithm fixture, `9.23%` to `8.96%` for
mathematics, and `14.17%` to `3.70%` for physics. Acceptance was based on the
four-way visual sheets, not these scalar values.

## SVG Structure Review

The tikztosvg algorithm reference uses rectangular `clipPath` elements around
content transformed by a `matrix(3,0,0,-3,...)`. Source and target outlines are
separate paths, preserving their own paint and line-width rules. TikZKit emits
equivalent geometry by clipping transformed line segments to the target
rectangle before serialization, then drawing independent source and target
node shapes. Magnified line widths scale with the lens.

For the physics overlay fixture, tikztosvg emits separate green rectangular
fill paths with `fill-opacity="0.2"` and no stroke. TikZKit now emits the same
shape, opacity, and no-outline behavior. Both retain separate source and target
rectangles rather than sharing a circular marker or SVG arrow definition.

## Command And Option Audit

Implemented and exercised in this slice:

- `\usetikzlibrary{spy}` and `\spy`
- `spy using outlines`, `spy using overlays`, and `spy scope`
- `spy on`, `spy in`, `in node`, and `connect spies`
- `magnification`, `size`, independent `width` and `height`
- independent source/target `circle` and `rectangle` shapes
- source/target `draw`, `fill`, `fill opacity`, colors, and line widths
- rectangular clipping of magnified line and path segments

Not implemented or not claimed here:

- arbitrary spy node shapes and general path clipping
- rotated, nested, or deferred-reference spy scopes
- magnified text, nodes, fills, patterns, and arbitrary scene primitives
- full custom spy connection paths and every node transformation

## Implementation And Verification

The engine now resolves the spy-scope defaults, command-level source options,
and target-node options as separate layers. Rectangle segment clipping uses a
general Liang-Barsky boundary calculation rather than fixture-specific
coordinates. The `spy` library descriptor and extension registry record the
implemented behavior and remaining limitations.

Verification commands:

```sh
node --test test/spy-rectangular-lenses.test.js
npm run extension-registry
node --test --test-reporter=tap
```

The focused suite passes `7/7`. The full suite reports `2453` tests, `2310`
passes, `129` existing failures, and `14` skips. Compared with the preceding
baseline, seven passes were added and the failure/skip counts did not increase.
All three new fixtures render with zero TikZKit diagnostics, and both MacTeX
and tikztosvg generated every requested reference artifact.
