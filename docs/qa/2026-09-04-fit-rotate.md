# QA: TikZ `fit` Oriented Bounds

## Scope

This slice implements the documented coordinate-scanning semantics of the
TikZ `fit` library and the `rotate fit` option. The acceptance boundary is:

- bare node references scan west, east, north, and south anchors;
- explicit node anchors contribute exactly one point;
- coordinates are accumulated in the inverse-rotated fit frame;
- the fitted center is rotated back and the resulting node is rotated;
- `rotate fit`/`fit` option order follows PGF's immediate key execution;
- independent inner x/y separation and existing minimum shape sizes remain.

Arbitrary nonuniform affine transforms applied around a fit operation remain
outside this slice.

## Local PGF Reading

Reviewed locally:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryfit.code.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-fit.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`

`tikzlibraryfit.code.tex` initializes min/max dimensions, scans every fit
reference, and distinguishes a bare shape border from a resolved coordinate.
A bare node is expanded to its west/east/north/south anchors; an explicit
anchor is one coordinate. For `rotate fit`, PGF temporarily removes the canvas
transform, rotates each point by the negative fit angle, accumulates an
axis-aligned box there, then rotates the center back. The key also applies the
ordinary `rotate` key to the resulting node.

The source executes keys immediately. Therefore `rotate fit=30,fit=...`
creates an oriented fit, while `fit=...,rotate fit=30` first creates an
axis-aligned fit and then rotates that node. TikZKit now preserves this order.

## Commands And Parameters

Implemented and exercised:

| Construct | Behavior |
| --- | --- |
| `\usetikzlibrary{fit}` | Loads the dedicated fit semantics module. |
| `\node[fit=(a)(b)]` | Scans all four compass anchors of each bare node. |
| `fit=(a.center)(b.north)` | Uses the two explicit anchors as two points. |
| `rotate fit=<angle>` | Computes oriented bounds and sets node rotation. |
| `inner sep`, `inner xsep`, `inner ysep` | Expands the local fit width/height independently. |
| `minimum width`, `minimum height`, `minimum size` | Preserves explicit lower bounds after fitting. |
| `circle`, `ellipse`, `rounded corners` | Reuses the existing fit-shape sizing and rendering paths. |
| `(fit.north)`, `(fit.east)`, `(fit.south west)` | Resolves anchors after fit-node rotation. |
| `\coordinate`, `\node`, `\draw`, `\fill` | Feed point, shape, path, label, and marker drivers. |

The numbers are deliberate: the manual's five-point set and `30` degrees test
the exact inverse-frame center `(1.5, 1.341506...)`; `26.565` aligns a common
flowchart diagonal; `20`, `5pt`, and `4pt` test a rotated physics enclosure and
unequal local separation.

Not implemented in this slice: arbitrary nonuniform affine transformations of
fit scans, exhaustive `every fit` ordering interactions, and exact TeX glyph
metrics.

## Third-Party And Native References

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; `rsvg-convert` was
found at `/opt/homebrew/bin/rsvg-convert`. Final artifacts are stored in:

`outputs/qa-fit-rotate-2026-09-04-after/`

It contains TikZKit SVG/PNG, tikztosvg SVG/PNG, MacTeX PNG, diff images, grid
images, and native four-panel sheets for `fit-rotate-flowchart`,
`fit-rotate-math`, and `fit-rotate-physics`. The initial failure artifacts are
in `outputs/qa-fit-rotate-2026-09-04-before/`.

The tikztosvg SVG uses nonzero-filled paths, butt caps, miter joins, explicit
dash arrays, and a global matrix that flips the TeX y axis. Its rotated fit is
already flattened into path coordinates. TikZKit keeps semantic coordinates
and emits a local node path inside `rotate(...)`; both approaches now produce
the same oriented boundary and anchor locations. Glyph outlines in tikztosvg
versus SVG text in TikZKit remain the main structural difference.

## Visual Result

Before the change, every TikZKit `rotate fit` box remained axis-aligned. The
flowchart enclosure cut across its diagonal process sequence, the manual point
set produced a vertical red rectangle, and the physics control volume was
horizontal. Labels, corner markers, and force arrows inherited those wrong
anchors.

After the change, all three TikZKit panels visibly match MacTeX and tikztosvg:
the flowchart enclosure follows the process chain, the mathematical red box has
the same center and 30-degree orientation, and the physics control volume is
parallel to the incline. The north/east/south-west dependent labels, markers,
and arrows now start at the corresponding reference positions. Remaining
differences are small text rasterization, antialiasing, and subpixel stroke
width differences. All three cases render with zero TikZKit diagnostics and
zero external-render failures.

## Verification

```bash
node --test test/fit-rotate.test.js
node --test --test-name-pattern='fit node|fit nodes|ellipse fit' test/interpreter.test.js
node --test test/tikzmark-math-overlay.test.js test/tikz-bayesnet.test.js test/library-modules.test.js
node scripts/render-example-fixtures.js --output outputs/qa-fit-rotate-2026-09-04-after --only fit-rotate-flowchart --only fit-rotate-math --only fit-rotate-physics --native-reference --strict-tikztosvg --continue-on-external-failure --math-renderer svg-text
node scripts/diff-example-pngs.js --output outputs/qa-fit-rotate-2026-09-04-after
npm run extension-registry
```

The focused fit regression has 4/4 passing tests. Existing fit, bayesnet, and
TikZ-mark overlay regressions also pass. Visual acceptance passed for all three
permanent cases. The complete repository run reports 2208 tests: 2067 passed,
127 pre-existing or unrelated failures, and 14 skipped. None of the failures
refer to `fit`, `rotate fit`, or the three new fixtures.
