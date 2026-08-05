# PGFPlots Fixture Table Resources

## Scope

This slice makes the maintained fixture manifest the shared source of truth
for external PGFPlots table data in batch QA. It deliberately covers only
resource plumbing for `\addplot table`; it does not change CSV parsing,
axis geometry, plot styles, or general file access in the browser editor.

The driver is
`test/fixtures/examples/latex-examples/csv-line-plot-two-axes.tex`, which
uses `linearProbing.csv` and `quadraticProbing.csv` twice: once for the primary
axis and once for the overlaid right axis.

## Local MacTeX Study

Read TeX Live 2025:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotscoordprocessing.code.tex`
  at `\pgfplots@addplotimpl@table@startprocessing` (lines 6700-6730). PGFPlots
  first accepts an already-loaded table, otherwise calls the file-backed table
  path; table data is an input dependency before any coordinate survey or plot
  styling happens.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotscore.code.tex`
  at its `exception/no such table file` diagnostic. A missing resource is a
  table-loading failure, not an empty plot with valid semantics.

The fixture renderer already modeled that idea through `entry.resources`.
The gallery audit and batch outputs had bypassed it, yielding 19 false missing
table diagnostics across eight real cases despite all files being present.

## Implemented Syntax And Boundary

`scripts/gallery-case-source.js` now loads each manifest resource once with
its declared name, text content, and source path. The new
`scripts/gallery-resources.js` provides two adapters:

- `galleryRenderOptions()` exposes text resources to the existing
  `pgfplotsTableResolver`, matching names such as `data.csv`,
  `linearProbing.csv`, and `quadraticProbing.csv` after normalizing `./` and
  slash direction.
- `materializeGalleryResources()` copies the same named files to the native
  case work directory. MacTeX thus sees exactly the relative file names in the
  source rather than a rewritten or case-specific path.

This supports all declared text tables in the 260-case fixture corpus through
the audit and JS batch renderers. It does not expose arbitrary host files to
browser-authored TikZ; browser resources remain explicitly fetched and passed
by `web/app.js`.

## Visual Review

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; `rsvg-convert` was
found at `/opt/homebrew/bin/rsvg-convert`; native MacTeX used `pdflatex`.

Artifacts:

- missing-resource baseline:
  `outputs/qa-pgfplots-csv-resources-before/`
- JS SVG/PNG, tikztosvg SVG/PNG, native PNG, grid variants, diff and sheets:
  `outputs/qa-pgfplots-csv-resources/`
- native three-way sheet:
  `outputs/qa-pgfplots-csv-resources/diff/latex-examples-csv-line-plot-two-axes-native-sheet.png`

The baseline had only axes, a legend shell, and four resolver warnings: every
data-driven line and marker was absent. After the fix TikZKit shows the blue
circle and red-square primary series, the orange hollow-halfcircle and black-x
right-axis series, their line geometry, and the right-axis tick scale. MacTeX,
TikZKit, and tikztosvg all show that same four-series structure.

The tikztosvg SVG has a `423.85pt x 240.6pt` viewBox, dashed grid paths with
butt/miter stroke behavior, and explicit path/mark geometry rather than a
foreign-object table. Its plot geometry agrees with the JS output. Remaining
visible differences are font rasterization, tiny legend/label offsets, and
antialiasing; they are outside this resource-loading slice.

## Verification

```bash
node --test test/gallery-case-source.test.js
npm run gallery:audit
npm run gallery:js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-pgfplots-csv-resources \
  --only latex-examples-csv-line-plot-two-axes \
  --native-reference --comparison-grid-mode svg \
  --external-timeout-ms 120000
npm run examples:diff -- --output outputs/qa-pgfplots-csv-resources
```

The full gallery audit changes from `260/260 rendered, 19 diagnostics` to
`260/260 rendered, 0 diagnostics`. The focused tests verify both resolver
content and native-file materialization.

## Next Slice

Use the now-complete table data path to inspect visual PGFPlots discrepancies
instead of missing-data noise: exact tick-label placement and legend text-box
metrics in the CSV overlay and student-series cases are the next bounded
targets.
