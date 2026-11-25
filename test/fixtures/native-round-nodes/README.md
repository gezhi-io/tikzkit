# Ordinary round nodes: visual replay

The [catalog](catalog/manifest.json) uses the original automata and perceptron
sources without edits. Four small drawings isolate unequal cardinal anchors,
an oblique border endpoint, a red/blue double circle, a 30-degree stroked
ellipse under a 1.5x shape transform and a 45-degree fill-only ellipse.

From the repository root, use local Chrome, a Playwright Node module, MacTeX
with both pdfLaTeX and actual tikztosvg first on PATH, Poppler, librsvg and
Python with PyMuPDF, NumPy, SciPy, Pillow and OpenCV. Use a new output directory.

```sh
F=test/fixtures/native-round-nodes
P=test/fixtures/native-positioning-targets
OUT="outputs/qa/2026-11-25-native-round-nodes/replay-$(date +%Y%m%d-%H%M%S)"
PW="${PLAYWRIGHT_INDEX_MJS:?Set the absolute path to playwright/index.mjs}"
export PATH="/Library/TeX/texbin:$PATH"
mkdir -p "$OUT/parent"
git archive 522f3ef src web scripts package.json package-lock.json | tar -x -C "$OUT/parent"
rsync -a node_modules "$OUT/parent/"   # matching package-lock; includes browser-served dependencies
capture() {
  node "$1/scripts/render-example-fixtures.js" --fixtures "$F/catalog" --output "$2" \
    --native-reference --native-latex-engine pdflatex --strict-tikztosvg \
    --tikztosvg-engine pdflatex --math-renderer svg-text --no-comparison-grid &&
  node "$P/capture.mjs" "$1" "$2" "$PW" "$3"
}
capture "$OUT/parent" "$OUT/before" parent-522f3ef
python3 -B "$F/measure.py" "$OUT/before"
python3 -B "$F/proof.py" "$OUT/before"
capture . "$OUT/after" working-copy
python3 -B "$F/measure.py" "$OUT/after" --baseline "$OUT/before" --require-match
python3 -B "$F/proof.py" "$OUT/before" "$OUT/after"
python3 -B "$F/proof.py" "$OUT/before" "$OUT/after" --final-routes
```

Open `gallery-proof.png` and `probe-proof.png` for the parent comparison, or
`gallery-routes.png` and `probe-routes.png` for the five final outputs side by side.
The normal workbench UI, measured
live DOM raster, actual clicked download, CLI export, native SVG and original
PDF are retained in `capture/`. The PDF input is byte-identical to the fixture;
the converter uses the existing strict wrapper. Capture fingerprints bind each
image and SVG to the source and renderer. The baseline check requires identical
native reference PNGs and actual converter SVGs, not identical PDF metadata.
If a native PNG hash changes, keep both captures. Running `measure.py "$OUT/after"
--require-match` separately checks geometry; it does not clear the hash failure.

`round-values.csv` has page, center and path dimensions in mm (x right, y
down; angle in degrees counterclockwise). Diameters come from four physical
cubic quarter-arc endpoints; projected extents sample the cubics, not their
control hull. Raw PDF drawing operators and librsvg/Cairo's SVG vector conversion
use the same reader. The north-sector screenshot profile excludes text and
arrows. `paintGap` and sampled RGB are separate from the vector pens.

In `outer-seps-association.csv`, the four fixture IDs are assigned by physical
cell (cw/ew on top, ct/et below), separately for fills, strokes and, for JS
outputs, SVG elements. A Cairo fill and stroke need not share an operator or
exact bounds. Their centers and dimensions must agree within 0.002 mm; the JS
stroke must also match its own SVG path size, declared pen width within 0.0002 mm,
exact color, and an actual rim pixel. This does not relax the two-pen path check.

`round-residuals.csv` compares all three JS routes to **both** native references
and cross-checks the references. Limits: 0.02 mm vector, 0.20 mm raster and
0.12 degrees. Pen count, ink color class and coincident paths are separate
checks. The automata page, unregistered state centers and horizontal entry
arrow offsets are **reported, not gated**: initial labels and arrowhead
construction are not part of the round border. Whole-image similarity is
not used. Only the labeled q1 details are translated to a common center;
full pages and standalone controls are never fitted to a reference.
