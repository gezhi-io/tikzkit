# Smooth plot proofs

[Whole-page comparison](../../../docs/qa/assets/2026-11-26-native-smooth-plots.png).
The left two columns are independently produced native references. The other
three show the frozen Chrome Render, final Chrome Render, and final **actual
download reopened**. Each run captures its own download separately from
the live page. No alignment is estimated from the ink.

## What the pictures test

The examples are drawn from the [PGF/TikZ plotting chapter](https://tikz.dev/tikz-plots)
and the [PGFPlots 2D plot reference](https://tikz.dev/pgfplots/reference-2dplots).
The [manifest](manifest.json) gives the original TeX Live 2025 filenames and
line numbers. Measurement checks the document body against the installed
manual source, not a retyped list of expected coordinates. Every source is
a one-picture standalone document with a 2 TeX pt border.

| Fixture / gallery fragment | What is original and what is tested |
| --- | --- |
| [#smooth-manual-tensions](smooth-manual-tensions.tex) | PGF lines 558-565, unchanged picture. Inherited `smooth cycle`; same four knots, tensions 0.2, 0.5 and 1. |
| [#smooth-manual-cycle-sharp](smooth-manual-cycle-sharp.tex) | PGF lines 575-577. A local smooth cycle and a sharp polygon on the **same draw path**. Only the one-statement `\tikz` wrapper is expanded to a picture environment. |
| [#smooth-manual-parametric](smooth-manual-parametric.tex) | PGF lines 241-242. Same wrapper expansion; the variable, formula in radians, sampling defaults, and **draw-local** scale 0.5 are unchanged. No gnuplot. |
| [#smooth-pgfplots-manual](smooth-pgfplots-manual.tex) | PGFPlots `pgfplots.reference.2dplots.tex` lines 44-52, unchanged picture; standalone preamble supplies width 7 cm and compat 1.18. This is a control: the old open line already had both cubics and all three marks. |
| [Open tension extremes](smooth-open-extremes.tex) | Focused test, **not** a published example. Identical knots at zero and four on a declared, unpainted common frame. No rescaling to hide overshoot. |
| [#smooth-pgfplots-dashed-cycle](smooth-pgfplots-dashed-cycle.tex) | Explicitly a **variant** of the PGFPlots manual row, not a second published source. Only its option line changes to `smooth cycle, tension=1, dashed`. The dashed line exposes the starting phase; all three observations and marks are retained. |

The five `#` IDs above can be opened directly in the workbench. The public
route check loads the full gallery (not the focused test catalog), verifies
the editor source and matches the downloaded bytes to the focused capture.

## Native path evidence

[vectors.py](vectors.py) reads PDF content-stream operators **before**
graphics-library flattening: at tension zero PGF still emits three cubic
operators with coincident handles. SVG commands are parsed separately and
transformed through the declared viewport; neither reader imports renderer
code. All following points are millimetres from the physical top-left page
corner, positive Y down. Comparisons preserve input order, do not cyclically
rotate a list, and include the `M` and `Z` operations. Off-page control
points are not clipped or dropped.

- **Three cycles:** native emits `M C C C C Z` three times, starting at the
  **second** knot, (1,1), not (0,0). Native first-handle X offsets are
  **1.109934, 2.774999, 5.549995 mm** respectively. Baseline: three open
  `M L L L` paths, indistinguishable apart from their positions.
- **Cycle then sharp:** native starts at **(5.773346, 11.467042)**; first
  cubic controls **(7.160846, 10.773297)** and **(10.773410, 7.854477)**.
  The second subpath remains a straight closed polygon. Baseline omitted the
  curved contour and was **2.081383 mm** too short at the page origin.
- **Parametric:** native has 25 knots / 24 cubics. The first outgoing and last
  incoming handles coincide with the path ends. Baseline: 24 lines and a
  page **31.410618 mm taller** than the native page.
- **Zero / four:** native blue's first incoming handle is its knot
  **(13.703131, 4.702648)**, not the old **(8.152920, 5.257920)**. Native
  red's first incoming handle is **(-8.496843, 26.922857)**, not the old
  **(-2.947080, 26.367920)**. Taken over both paths the old maximum control
  error was **6.382849 mm**, despite the fixed page and nearly identical knots.
  The full red stroke fits on the page; its handles need not.
- **PGFPlots:** the native open curve starts at **(9.388828, 41.618958)**;
  the dashed cycle on the same data starts at its **second** observation,
  **(31.965646, 16.863723)**. Baseline painted only two straight segments
  on the dashed example. The open manual control must not be counted as a
  newly supported curve.

## Results

Frozen Git baseline `75b9b386d3efdf1d2d3392b3fecc994fff0530e2`
(renderer `fe839777a401`); final **working-tree** renderer
`a357d92817b6fb729814a7295a1325dd5eb097caa96fd8ea8f394f9d90ab7751`.
Both used Chrome 158.0.8127.37, TeX Live 2025 pdflatex 1.40.28,
tikztosvg 0.3.0, librsvg 2.63.0 and Poppler 26.09.0. The browser UI asset
hash and font inventories matched. Both native reference PNGs per case
and the native converter SVG bytes matched across runs.

Pixels exceeding the RGB threshold **against the original physical PDF page**:

| Case | Before Render | Before Download | Final Render | Final Download | Native SVG |
| --- | ---: | ---: | ---: | ---: | ---: |
| Manual tensions | 15,609 | 13,441 | 8,903 | 8,821 | 3 |
| Cycle then sharp | 4,283 | 3,869 | 2,097 | 3,123 | 0 |
| Parametric | 9,353 | 7,709 | 2,945 | 3,033 | 0 |
| PGFPlots open control | 2,936 | 9,677 | 2,937 | 9,678 | 937 |
| Tension zero / four | 15,258 | 13,803 | 4,125 | 4,041 | 7 |
| PGFPlots dashed cycle | 6,207 | 12,257 | 3,351 | 10,270 | 938 |
| **All six** | **53,646** | **60,756** | **24,358** | **38,966** | **1,885** |

Both final Chrome vectors have the same painted plot commands, pen colors,
and cubic ordering as both native references. Across **51 cubic segments /
102 controls**, maximum absolute X or Y error is **0.000870 mm against the
PDF** and **0.001236 mm against the converter**. The largest page-dimension
difference from the PDF is **0.000623 mm**. The zero/four case's worst control
error fell from **6.382849 to 0.000684 mm**. The ordinary PGFPlots control
retained both cubics and all three marks; its raster mismatch rose by one
pixel in each Chrome view. Zero editor/export diagnostics or browser errors.

**Residuals:** the final Chrome images are not pixel-identical to each other
or either native raster. Compared with the native SVG raster, final Render
differs at **25,169** pixels and reopened Download at **39,123**. Comparing
final Render directly with reopened Download gives **42,700**. Every
above-threshold final Chrome/PDF difference is in a 5 x 5 window containing
a native PDF edge (RGB range >16 in at least one channel). This localizes
the differences to stroke, mark or glyph boundaries; it does not establish a
cause for each pixel. Both PGFPlots rows include the complete ticks and labels.

## Capture and replay

Requirements: Node with this repository's dependencies; an installed Chrome
channel and Playwright `index.mjs`; MacTeX with the PGF and PGFPlots manual
sources; Poppler and librsvg. Python 3.12+ with NumPy, Pillow, PyMuPDF,
fontTools and pypdf is used for measurement. On a clean checkout, obtain the
renderer trees as follows; `PW` is the absolute path to the Playwright module:

```sh
F=test/fixtures/native-smooth-plots
R=$(mktemp -d)
mkdir "$R/baseline"
git archive 75b9b386 bin src web scripts package.json package-lock.json | tar -x -C "$R/baseline"
ln -s "$PWD/node_modules" "$R/baseline/node_modules"
sh "$F/capture.sh" "$R/baseline" "$R/before" "$PW" 75b9b386
sh "$F/capture.sh" "$PWD" "$R/after" "$PW" after
python3 -B "$F/report.py" sheet "$R/before" "$R/after" "$R/proof.png"
```

Use a new stage for every run. The workbench capture harness is the one
used by [native-background-scopes](../native-background-scopes/capture.sh).
The generator must produce an original-source **pdflatex** PDF and an SVG
from **/Library/TeX/texbin/tikztosvg** using pdflatex: blocked generation
stops the run; neither reference can be substituted for the other. The
converter receives the recorded standalone picture/border and restores the
classical arrow default; for PGFPlots its generated preamble preserves the
compat and width. No plot data are rewritten. Render clicks must detach the
previous DOM SVG. The Download button supplies the file, which a separate
Chrome page opens as an SVG document. It is never substituted with a CLI
export. Both browser pages are captured at their **declared physical size**.

Pixel counts use 384 dpi (4 device pixels per CSS pixel); PDF rasterization
uses Poppler, converter rasterization is explicitly **rsvg-convert**. Comparison
is on an opaque white canvas at (0,0); only the bottom and right are padded.
A pixel differs if any RGB channel changes by more than 16. The display
sheet downsamples uniformly within a row; the reported measurements do not.

The single [evidence archive](evidence.tar.xz) is **513,196 bytes**,
SHA-256 `4bf626b7bfdd48bfff428844aeb9e27b7eab2d263ce98dd5d4f3208e71a03fdc`.
It retains the source inputs, direct PDFs, converter inputs/preambles and
SVGs, live and downloaded SVG bytes, all four original 384 dpi comparison
rasters per case per run, capture reports, public routes and measurements.
Identical files are stored once: 131 logical entries, 99 distinct payloads.
Full-window UI screenshots and the unused CLI tiles are made by the harness
in a raw stage but are not stored again. Standard `tar` can read the archive;
`before/metrics.json` and `after/metrics.json` contain all plotted knots,
controls, page dimensions and comparisons to both references.

To verify every archived file, reread both vector formats, recompute raster
counts and regenerate the sheet **without Chrome or TeX**:

```sh
python3 -B "$F/report.py" replay "$F/evidence.tar.xz" "$R/replayed.png"
```

The delivered sheet and the archive replay have identical SHA-256
`0b4282e6dc684b3e7753fe0b869be556aa3b8955e608b00affa8914f5354c66b`.
To preserve another complete run, use `report.py bundle BEFORE AFTER NEW.tar.xz`;
an existing archive is never overwritten.
