# Rectangle outline visual QA

Ten probes separate the rectangle path, painted pen, named anchors and page.
The drivers catalog points at the two **unchanged** positioning examples.
The tight and roomy signed-corner drawings differ only by their page border.
No unit-test coordinates, renderer scene objects or expected PNGs are inputs.

## Reproduce

From the repository root, use local Chrome, a Playwright Node entry point,
MacTeX/pdfLaTeX, actual tikztosvg, Poppler, librsvg and Python with
PyMuPDF, Pillow, NumPy, SciPy and OpenCV. Choose a fresh replay directory.

```sh
F=test/fixtures/native-rectangle-outlines
P=test/fixtures/native-positioning-targets
QA=outputs/qa/2026-11-25-native-rectangle-outlines
OUT="$QA/replay-$(date +%Y%m%d-%H%M%S)"
TREE=.  # Or the exact final snapshot: "$QA/tree-a79c0993"
PW="${PLAYWRIGHT_INDEX_MJS:?Set the absolute path to playwright/index.mjs}"

capture() {
  node "$1/scripts/render-example-fixtures.js" --fixtures "$2" --output "$3" \
    --native-reference --native-latex-engine pdflatex --strict-tikztosvg \
    --tikztosvg-engine pdflatex --math-renderer svg-text --no-comparison-grid &&
  node "$P/capture.mjs" "$1" "$3" "$PW" "$4"
}
capture "$TREE" "$F" "$OUT/probes" candidate
capture "$TREE" "$F/drivers" "$OUT/drivers" candidate
python3 -B "$F/measure.py" "$OUT/probes" --require-match
python3 -B "$P/audit.py" "$OUT/drivers" --require-match
```

The two current-version gates do not need a historical output directory.
For a before/after difference sheet, use a second checkout at `19f6567`
with the project dependencies installed and set `OLD` to its absolute path.
Keep running the commands from the current repository:

```sh
BASE="$OUT/parent-drivers"
capture "$OLD" "$F/drivers" "$BASE" parent
python3 -B "$P/audit.py" "$BASE"
capture "$OLD" "$F" "$OUT/before" parent
python3 -B "$F/measure.py" "$OUT/before"
python3 -B "$F/measure.py" "$OUT/probes" --baseline "$OUT/before" --require-match
python3 -B "$P/audit.py" "$OUT/drivers" --baseline "$BASE" --require-match
python3 -B "$F/proof.py" "$OUT/before" "$OUT/probes" "$BASE" "$OUT/drivers" "$OUT"
```

For just the final gates, use the existing `$QA/before/final`, `$QA/final/probes`
and `$QA/final/drivers`; leave the frozen parent captures untouched. The final
renderer's fingerprint is `a79c0993`, the parent's is `c08d6cef` (19f6567).

## Read the evidence

Open `visual-proof.png` first. Each difference uses the original top-left page
coordinates. Gray = same ink, pink = reference only, green = compared image
only, orange = changed color. White padding only; no registration or fitting.
The driver windows are 6 x 4 mm; their overlap is **not** whole-diagram overlap.
`outline-proof.png`, `corner-proof.png` and `control-proof.png` show all five
rendering routes; `driver-proof.png` shows both complete original drivers.

`probe-values.csv` and `probe-residuals.csv` use mm (x right, y down).
Original PDF operators are read directly. Filled probe boxes and anchor dots
use Chrome's physical SVG coordinates; other SVG strokes and cubics use a
librsvg/Cairo vector conversion, verified against the declared viewport.
Colored screenshot ink is measured separately at 384 dpi. Probe limits are
0.005 mm vector and 0.20 mm painted; counts and double-path equality are exact.
The positioning audit retains its own tolerances and signed driver CSVs.
Raw fitted UI, downloaded SVGs and original PDFs are in each stage's
`capture/`; the actual converter output is in `tikztosvg-svg/`.
