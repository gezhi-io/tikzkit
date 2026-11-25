# Native positioning visual controls

Five colored probes and two unmodified example drivers exercise the local
positioning library. The two drivers are manifest references, not edited copies.
The supplemental source covers both directions without an `of` target and
the order of `at` versus positioning. Its own catalog permits a separate run.

## Reproduce

Use the local TeX tools, a real Google Chrome installation, Playwright's Node
module, and Python with NumPy, SciPy, OpenCV, Pillow and PyMuPDF. From the repo
root, choose a new ignored output directory for each renderer. For a clean
baseline, run the strict renderer and serve the workbench from the same archived
tree; give it a copy of these fixture inputs and the unchanged original drivers.

```sh
F=test/fixtures/native-positioning-targets
node "$TREE/scripts/render-example-fixtures.js" --fixtures "$F" --output "$STAGE" \
  --strict-tikztosvg --native-reference --native-latex-engine pdflatex \
  --tikztosvg-engine pdflatex --math-renderer svg-text --no-comparison-grid
node "$F/capture.mjs" "$TREE" "$STAGE" "$PLAYWRIGHT_INDEX_MJS" "$REVISION_LABEL"
python3 -B "$F/audit.py" "$STAGE"
```

Set `TREE` to the renderer root and `PLAYWRIGHT_INDEX_MJS` to the installed
Playwright module entry. For a passing run use `--require-match`. To check
before/after identities and show an archived label crop, pass `--baseline` once
per baseline stage; the source IDs must be disjoint and cover the after run.
A known-red baseline intentionally reports differences without requiring a match.

## Interpretation

- **Live** is the real workbench DOM. The normal, fitted UI screenshot is kept
  separately. For measurement only, the outer SVG viewport uses its declared
  size. **Download** is produced by the workbench's Download SVG button and
  reopened as a standalone document. **Export** is the strict CLI SVG-text file.
- **Native** consists of the actual tikztosvg SVG and the separate original
  pdfLaTeX PDF. Capture requires the PDF's TeX input to be byte-identical to the
  fixture. The PDF is inspected as vectors and independently rasterized with
  Poppler at 384 dpi, matching Chrome at four device pixels per CSS pixel.
- **Vector centers** come from SVG painted bounding boxes transformed into the
  declared physical viewport, or from the original PDF drawing operators.
  **Painted centers** are found independently by connected solid colors, or by
  the enclosed dark outlines of rectangles and diamonds in the real drivers.
  Three black marks check physical scale; gray sources are measured separately.
  Native PDF source-to-probe vectors must also match hand-calculated controls.
- **Units** are physical mm, right and up positive. The report separates
  unregistered page centers, centers relative to the first mark (or first driver
  node), source-to-node vectors and outline sizes. No best-fit scale, alignment
  on a moved node, or glyph fitting is used. A missing painted or vector node
  fails the comparison; a hidden node is not silently given its vector center.
- **Text and photometry** are controls, not the geometry gate. For sloped
  labels, T is along the connector toward its destination and N points above it.
  The ink centroid uses small dark components near the midpoint and excludes
  the connected arrow and node outlines. Word-mask overlap and RGB paint
  differences include antialiasing and hinting; they do not establish font identity.

`visual-sheet.png` and `decision-flow-labels.png` share a fixed scale within
each sheet. `node-residuals.csv`, `text-residuals.csv` and `geometry.json` record
signed results. `capture.json` binds the captures to the strict render, hashes,
actual Chrome version, and renderer fingerprint. `report.md` summarizes the run.
