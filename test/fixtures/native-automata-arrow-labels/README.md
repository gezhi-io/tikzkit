# Automata arrow labels: physical visual QA

Three immutable inputs: the [original gallery](../examples/automata/initial-accepting-states.tex),
four outgoing accepting arrows, and four ordinary cardinal anchor nodes.
The two controls use the same words, inherited large font, 12 mm circles
and 10 mm center-to-label anchor distance. One uses an explicit left direction;
the others use the cardinal shorthand. The PDF is compiled from the original
source. Real tikztosvg uses the existing standalone-border wrapper, not a JS oracle.

From the repo root, provide local Google Chrome, Playwright, MacTeX (pdfLaTeX and
tikztosvg), Poppler, librsvg, and Python with NumPy, OpenCV, Pillow, SciPy and
PyMuPDF. Use a fresh output folder; a renderer snapshot must include web
dependencies. No files from the production tree or generic capture tools are edited.

```sh
F=test/fixtures/native-automata-arrow-labels
P=test/fixtures/native-positioning-targets
OUT="outputs/qa/2026-11-25-automata-arrow-labels/replay-$(date +%Y%m%d-%H%M%S)"
PW="${PLAYWRIGHT_INDEX_MJS:?Set the absolute path to playwright/index.mjs}"
export PATH="/Library/TeX/texbin:$PATH"
mkdir -p "$OUT/parent" "$OUT/candidate"
git archive ac79c76e src web scripts package.json package-lock.json | tar -x -C "$OUT/parent"
rsync -a node_modules "$OUT/parent/"   # use the dependencies for the committed lock
rsync -a src web scripts package.json package-lock.json node_modules "$OUT/candidate/"
capture() {
  node "$1/scripts/render-example-fixtures.js" --fixtures "$F/catalog" --output "$2" \
    --native-reference --native-latex-engine pdflatex --strict-tikztosvg \
    --tikztosvg-engine pdflatex --math-renderer svg-text --no-comparison-grid &&
  node "$P/capture.mjs" "$1" "$2" "$PW" "$3"
}
capture "$OUT/parent" "$OUT/before" parent-ac79c76e
python3 -B "$F/labels.py" "$OUT/before"
capture "$OUT/candidate" "$OUT/after" frozen-working-tree
python3 -B "$F/labels.py" "$OUT/after" --parent "$OUT/before" --require-match
python3 -B "$F/sheet.py" "$OUT/before" "$OUT/after"
python3 -B "$F/sheet.py" "$OUT/before" "$OUT/after" --routes
```

**What is measured.** `labels.csv` gives millimeters from the original top-left
page origin (right/down positive). `baseX/baseY` is the first glyph's baseline
origin; `dx/dy` is that point minus the state center. State centers come from
the physical circle paths. The native SVG uses glyph placements; original PDFs
and Cairo-converted JS SVGs use the emitted glyph origins, not a fallback font's
ink bounds. Word identity and glyph order are checked.

Visible ink comes from each **actual** 384 dpi screenshot (0.06615 mm/pixel).
In-memory word masks from the converter's existing glyph outlines locate the
word within 0.55 mm of that output's own glyph origin, including where the
gallery's upper `start` overlaps an unrelated path/letter. No rescaling or
reference-position registration is allowed. A correlation of at least 0.65 is
required and only dark captured pixels within one pixel of the mask count.
`inkX/Y` is the center of that ink box; `inkFromCenter` and `inkFromRim` are
signed distances to its near edge along the named side. Negative means
overlap or the wrong side. The sheet's full pages are not registered; only
its explicitly labeled rim details are centered on the state.

`residuals.csv` records all three JS surfaces against both independent
references, plus reference-to-reference comparisons: 96 rows. Vector/page
limit 0.02 mm; visible ink limit 0.20 mm. The strict replay also requires the
original PDF PNG, native SVG bytes and native SVG PNG to match the parent
exactly. A hash warning is separate from geometric agreement and is not waived.
This is not a whole-gallery or arrowhead-shape equivalence test.

**Recorded run, 2026-11-25.** Parent `ac79c76e` (renderer `752dcc0f`), final
`63b6ae2ddc5817f3384b25ce07be8921aed9aac7493cc5fd4333691f99a142be`,
Chrome 158.0.8127.37. [Before / after / PDF diff](../../../docs/qa/assets/native-automata-arrow-labels.png)
is included in the repository. The replay also produces `routes.png` (five
outputs), `labels.csv` (physical measurements) and `residuals.csv` (signed
differences) in the local output folder. The two references and the direct control
passed on the parent (48/96); the final passed 96/96. All six native PNGs and
all three actual converter SVGs were byte-identical to the frozen parent.

| Physical measurement, mm | Parent live | Final live | Original PDF | Actual tikztosvg |
|---|---:|---:|---:|---:|
| Gallery page W x H | 58.78674 x 44.15678 | 63.61300 x 46.56991 | 63.61289 x 46.56984 | 63.61289 x 46.56984 |
| q1: first glyph of entry, x from center | +9.10891 | +10.35020 | +10.34974 | +10.34944 |
| q1: nearest entry ink from painted rim | 4.60547 | 5.83022 | 5.82999 | 5.69687 |
| A: first glyph of west, x from center | +10.00050 | -19.17965 | -19.17982 | -19.17947 |

Across all 12 labels and three JS surfaces, the largest absolute difference in a
state-relative baseline coordinate was 0.00146 mm vs PDF and 0.00175 mm vs
tikztosvg. The largest visible rim-clearance differences were 0.13206 / 0.13335
mm, at q1. The reopened download and CLI SVG both measured 5.69793 mm there;
the native reference rasters themselves differed by 0.13312 mm. The original
gallery's overlapping upper `start` and edge annotation are present natively.
Empty, rotated and scope-order oracle cases are not independently certified by
these three images. An intermediate `ea623f25` replay differed from the frozen
converter PNG by two gray pixels; no final baseline was replaced or averaged.
