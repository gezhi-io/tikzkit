# PGFPlots 3D Plot Box Ratio QA

## Scope

This slice implements the shared PGFPlots 3D key
`plot box ratio={x}{y}{z}` for literal, finite, positive numeric triples.
It changes the x/y/z basis lengths before 3D projection and final axis-box
fitting. It does not special-case a gallery item.

The real driver is
`test/fixtures/examples/pgfplots/plot-box-ratio-3d.tex`, extracted from TeX
Live's `visualtikz` source example. Its `plot box ratio={1}{2}{1}` must make
the projected y direction visibly longer than the default 1:1:1 box.

## Local MacTeX Study

Read these local TeX Live 2025 sources and documentation:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.scaling.code.tex`,
  `\pgfplotssetaxesfromazel` (around lines 250-329): PGFPlots first builds
  the azimuth/elevation basis vectors, applies each plot-box-ratio component
  to x/y/z respectively, then scales the whole projected box to the requested
  width and height.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotsmeshplothandler.code.tex`:
  meshes are lowered as depth-ordered patches rather than a 3D SVG primitive.
- `/usr/local/texlive/2025/texmf-dist/doc/latex/pgfplots/pgfplots.pdf`,
  section 4.11.3: `plot box ratio` defaults to `1 1 1`, applies only to 3D
  plots, and is applied before rotation/stretch-to-fill.

TikZKit now follows the first rule in
`src/pgfplots/geometry.js:createPgfplots3DViewProjection`. The same ratio is
also used by `pgfplotsViewDirection`, keeping 3D surface painter ordering in
the same scaled coordinate space.

## Command And Option Inventory

The fixture uses these relevant items:

| Item | Status | Boundary |
| --- | --- | --- |
| `\begin{tikzpicture}` | supported | ordinary picture scope |
| `\begin{axis}` | partial | focused 3D axis subset |
| `width=5cm` | supported in this path | final projected-box fit |
| `view={120}{35}` | supported | azimuth/elevation pair |
| `plot box ratio={1}{2}{1}` | supported | finite positive literal triples; brace and whitespace forms |
| `mesh` | partial | TikZKit lowers a grid mesh; full mesh shader space is not complete |
| `no marks` | supported in this path | disables plot markers |
| `\addplot3 {y}` | partial | sampled numeric surface expressions |

Not implemented by this slice: macro or math-expression ratio values,
explicit PGFPlots `x`/`y`/`z` vector overrides, `view dir`, full `scale mode`,
and the complete mesh/surf shader catalog.

## Third-Party Reference And Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg` and PNG conversion
uses `/opt/homebrew/bin/rsvg-convert`. Native compilation uses
`/Library/TeX/texbin/pdflatex`.

The inspected generated artifacts are under
`/private/tmp/tikzkit-qa-plot-box-ratio-after/`:

- MacTeX native PNG:
  `mactex-png/pgfplots-plot-box-ratio-3d.png`;
- TikZKit SVG/PNG:
  `tikzkit-svg/pgfplots-plot-box-ratio-3d.svg` and
  `tikzkit-png/pgfplots-plot-box-ratio-3d.png`;
- tikztosvg SVG/PNG:
  `tikztosvg-svg/pgfplots-plot-box-ratio-3d.svg` and
  `tikztosvg-png/pgfplots-plot-box-ratio-3d.png`;
- comparison grids and sheets:
  `tikzkit-grid-svg/`, `tikztosvg-grid-svg/`, and
  `diff/pgfplots-plot-box-ratio-3d-native-sheet.png`.

The tikztosvg SVG contains a clip path around the projected box, ordinary
path geometry, TeX glyph paths, and a tight static viewBox; it does not encode
the scene with an SVG 3D transform. For this local `mesh` source, tikztosvg
paints a colored surface while native MacTeX and TikZKit show blue mesh lines.
That is a third-party renderer divergence, so MacTeX is the primary visual
oracle for this slice.

## Visual Result

Before this change TikZKit ignored `plot box ratio`; its internal projected
y-to-x vector-length ratio for this view was **1.373**. With `1:2:1`, it is
**2.412**. The inspected JavaScript panel now visibly stretches the projected
y mesh direction, matching the semantic change visible in the MacTeX panel;
the axes, ticks, and mesh remain present with no renderer diagnostics.

The final canvas dimensions differ because the three engines crop text and
paths differently: MacTeX is 184x128px, TikZKit is 163x117px, and tikztosvg
is 178x123px. Registered image residuals are supporting evidence only:
TikZKit-vs-MacTeX mean absolute RGBA is 0.07974, while tikztosvg-vs-MacTeX is
0.03235. The remaining visible difference is mesh paint style and TeX/browser
text rasterization, not a missing ratio transformation.

## Implementation And Verification

- `src/pgfplots/geometry.js`: applies ratio components to the 3D basis and
  the matching depth direction.
- `test/pgfplots-seams.test.js`: regression proves a bare `1 2 1` ratio makes
  y at least 1.7 times longer relative to x after final fitting.
- `test/fixtures/examples/pgfplots/plot-box-ratio-3d.tex` and the manifest:
  add a real TeX Live driver to the visual corpus.
- `src/capabilities/matrix.js`, generated extension registry, and README:
  record ownership, verification, and the partial boundary.

```bash
node --test --test-name-pattern='plot box ratio' test/pgfplots-seams.test.js
node scripts/gallery-audit.js --only pgfplots-plot-box-ratio-3d
node scripts/render-example-fixtures.js --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-plot-box-ratio-after \
  --only pgfplots-plot-box-ratio-3d --native-reference \
  --comparison-grid-mode svg --strict-tikztosvg --external-timeout-ms 120000
node scripts/diff-example-pngs.js --output /private/tmp/tikzkit-qa-plot-box-ratio-after \
  --register --alignment-radius 3
```

Focused regression and fixture audit pass. The broad PGFPlots seam file still
contains pre-existing baseline failures outside this ratio slice, so it is not
used as the acceptance gate for this focused improvement.

## Remaining Work

- Calibrate full 3D surface painter ordering after nonuniform final box fitting.
- Implement expression/macro-valued ratio parsing through the TeX-lite math
  path rather than coercing JavaScript numbers.
- Extend the visual gate to more azimuth/elevation combinations and active
  surf shader modes.
