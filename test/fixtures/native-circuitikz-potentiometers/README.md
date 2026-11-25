# CircuitikZ potentiometers: physical QA

[Manuals and wired contacts](../../../docs/qa/assets/native-circuitikz-potentiometers.png) |
[Bare path and arrowhead colors](../../../docs/qa/assets/native-circuitikz-potentiometers-paint.png)

The two standalone wrappers preserve the complete installed TeX Live 2025
manual drawings at examples 2293 and 2342. The audit byte-checks the actual
`circuitikz` blocks, lines 2294-2302 and 2348-2355. The PDF takes the
unchanged source. The real MacTeX `tikztosvg` adapter supplies its own
environment and standalone border; the audit checks the drawing body,
including all settings and macros, was not rewritten.

- **Manual wipers:** A/B are nine-zig American bodies; C is European. The A/B/C glyph origins independently test the named external wipers.
- **Manual longpot:** a locally styled, six-zig potentiometer and its P label lie between ordinary R controls of different scales.
- **Wired probe:** three noncentral `pR` sliders, horizontal, oblique mirrored, and oblique European mirrored/inverted. The external blue/red/green wires meet the shaft ends, not the arrow tips.
- **Paint probe:** bare path, `red`, and `draw=red`. Two gray dots fix the page. Both leads, the body, shaft and head are checked separately for vector paint and actual raster ink.

**Recorded run.** Chrome 158.0.8127.37; parent `9236615e` (renderer
`ecbb9ce69704`); final renderer
`750f76b6b0a49172a1f27e2f8298739028ef889bcfd6a20459a8b071e2122382`.
Parent: 0/7 potentiometer bodies, both ordinary resistors present, 6 unknown
wiper diagnostics. The silent longpot lost its P. The three colored wire
starts missed the PDF contacts by 17.557, 34.435, and 61.412 mm.
Final: 90/90 component, 40/40 page and 30/30 paint comparisons; zero
diagnostics. Of these, 54, 24 and 18 respectively compare a JS route
directly to a native reference; the remainder cross-check the references.

| Maximum across the three JS routes | vs original PDF | vs actual converter SVG |
|---|---:|---:|
| Body dimension, pen or center offset | 0.00081 mm | 0.00141 mm |
| Gap from lead to body, along the component | 0.00123 mm | 0.00131 mm |
| Wiper tip/shaft linear measurement | 0.00110 mm | 0.00183 mm |
| Absolute named wire start, Euclidean | 0.00155 mm | 0.00199 mm |
| Absolute glyph baseline coordinate | 0.00053 mm | 0.00053 mm |
| Page dimension | 0.00014 mm | 0.00014 mm |

All three observed wire-to-shaft gaps are zero. The bare black shape has
no leads; the colored heads are red for `red`, black for `draw=red`, both
on red shafts. The decoded live and downloaded SVG elements agree; the
two manual CLI SVGs differ only in font CSS. The four downloaded/CLI
diagram PNG pairs match byte-for-byte.

**Measurement.** Two vector references: the original PDF and actual
converter SVG, not two SVG rasterizers. Browser SVGs are independently
read as physical paths through librsvg/Cairo. The PDF uses its native paths
and glyph origins. All measurements use mm from the page's top-left or in
the signed axes defined by physically detected leads. Checks include the
body type and zig count, centerline extents, lead-to-body gaps, pen width,
wire endpoints and color, wiper shaft and filled tip, tip-to-body clearance,
and named label origin. The upper and lower ordinary resistors must remain
arrowless. Limits: 0.02 mm before rounding, 0.035 mm2 for filled arrow area,
exact color/count/presence. The 384 dpi PNGs check ink at measured features.
Paint windows use fixed page coordinates. Overlays use native page origin,
white padding and no registration. Text outlines and every individual
antialias sample are not general geometry acceptance criteria.

**Replay.** Requires local Chrome and Playwright, MacTeX with the actual
`/Library/TeX/texbin/tikztosvg`, librsvg, Poppler, and the positioning
audit's Python dependencies (PyMuPDF, Pillow, NumPy, SciPy, OpenCV). Run
with an installed dependency tree matching the archived package lock.

```sh
ROOT="$(git rev-parse --show-toplevel)"
F="$ROOT/test/fixtures/native-circuitikz-potentiometers"
P="$ROOT/test/fixtures/native-positioning-targets/capture.mjs"
OUT="$ROOT/outputs/qa/2026-11-25-circuitikz-potentiometers/replay-$(date +%Y%m%d-%H%M%S)"
PW="${PLAYWRIGHT_INDEX_MJS:?Set the absolute path to playwright/index.mjs}"
export PATH="/Library/TeX/texbin:$PATH"
mkdir -p "$OUT/parent" "$OUT/candidate"
git -C "$ROOT" archive 9236615e src web scripts package.json package-lock.json | tar -x -C "$OUT/parent"
rsync -a "$ROOT/node_modules" "$OUT/parent/"
rsync -a "$ROOT"/{src,web,scripts,package.json,package-lock.json,node_modules} "$OUT/candidate/"
capture() {
  node "$1/scripts/render-example-fixtures.js" --fixtures "$F/catalog" --output "$2" \
    --native-reference --native-latex-engine pdflatex --strict-tikztosvg \
    --tikztosvg-engine pdflatex --math-renderer svg-text --no-comparison-grid &&
  TIKZKIT_QA_RERENDER=1 node "$P" "$1" "$2" "$PW" "$3"
}
capture "$OUT/parent" "$OUT/before" parent-9236615e
python3 -B "$F/measure.py" "$OUT/before"
capture "$OUT/candidate" "$OUT/final" candidate
python3 -B "$F/measure.py" "$OUT/final" --before "$OUT/before" --require-all
python3 -B "$F/sheet.py" "$OUT/final" --before "$OUT/before"
```

The switch clicks Render, waits for the old SVG to detach and rechecks the
editor text before capturing the DOM and clicking Download SVG. Without
it, the shared capture retains its old behavior. On the same final source,
the shared switch reproduced all 12 JS SVGs and 12 JS diagram PNGs from
the preceding explicit-click driver byte-for-byte.

**Evidence on this machine.** Under `outputs/qa/2026-11-25-circuitikz-potentiometers/`,
`before/` is the first frozen three-case capture, `before-four/` adds the
first paint baseline, and `final/` is the official four-case capture. To
use these original baselines, pass `--before "$BASE/before" --paint-before
"$BASE/before-four"` to the measurement and sheet scripts, with `BASE`
set to that output directory. `final/reference-locks.csv` passes 20/20
first-capture checks: PDF page streams and PNGs, converter SVGs and their
Chrome/librsvg PNGs. The separate full repeated-parent comparison
(`final/repeat-parent-locks.csv`) is **19/20**, not waived: the repeated
wired converter Chrome PNG differs in 79 pixels, at most 4/255 per channel,
despite identical SVG, PDF and librsvg output. The final Chrome PNG matches
the first frozen one exactly.

`capture.json` records source, renderer and output hashes; `capture/ui/`
contains untouched workbench screenshots. `components.csv`, `component-residuals.csv`,
`pages.csv`, `page-residuals.csv`, `paint.csv` and `paint-residuals.csv`
give absolute values, ink counts and per-reference results. `all-routes.png`
shows both SVG rasterizers and all three JS routes; `overlays/` contains
the full-resolution editor and download differences.
