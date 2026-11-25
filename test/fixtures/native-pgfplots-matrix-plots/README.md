# Native 2D matrix plots

[Final before/after comparison sheet](../../../docs/qa/assets/native-pgfplots-matrix-plots.png):
original PDF, local tikztosvg/librsvg, frozen Chrome, integrated Chrome,
reopened Download and strict CLI. All panels share the same physical scale.

Five complete examples from the installed PGFPlots documentation archive.
The standalone wrappers reproduce the manual's 7 cm width and `compat=1.18`.
The pictures, axis options, original tables, metadata and empty lines are not rewritten.

| Workbench route | `pgfplots.reference.3dplots.tex` | What the native PDF actually paints |
| --- | --- | --- |
| [`/#matrix-manual-explicit-hole`](matrix-manual-explicit-hole.tex) | 3780-3797 | Eight cells. Empty middle, painted white bottom-right. Nine black marks and indices, including 4 at the hole and black-on-black 3. |
| [`/#matrix-manual-nan-colorbar`](matrix-manual-nan-colorbar.tex) | 3758-3772 | Eight cells for nine numeric metadata. The NaN does not paint, but index 4 and its mark remain. Right colorbar: 0, 2, 4, 6, 8. |
| [`/#matrix-manual-table`](matrix-manual-table.tex) | 3692-3712 | All nine original table rows, `mesh/cols=3`, `meta=C`. Both axes include the outside half-cells: -0.5 to 2.5. |
| [`/#matrix-manual-starred`](matrix-manual-starred.tex) | 3886-3899 | Native y increases upward: 0 blue at bottom-left; 6 orange at top-left. The manual explicitly asks for `axis on top`. |
| [`/#matrix-manual-skewed`](matrix-manual-skewed.tex) | 3830-3851 | Nonuniform table with two blank scanline separators, nine connected quadrilaterals, `enlargelimits=0.2`, right colorbar. |

The table and NaN sources above are also the canonical public-gallery files.
There are no external assets or duplicate sources. The link labels are the browser
routes; clicking a source link here opens the original TeX.

## Final result

Captured in `outputs/qa/2026-11-25-pgfplots-matrix-plots/final-integrated/`, renderer
`434f6a3559c997b2c94e4014275449b4e230606f1c4e2d5f07a1097a8ccd3019`.
All five passed the 0.02 mm physical check. There are 8, 8, 9, 9 and 9 painted cells
in sheet order, nine marked centers per case, no connecting line, and no color leaking
below the axes. Both public routes load the canonical TeX unchanged. All five real
Chrome downloads equal the corresponding strict CLI SVG byte for byte, with zero
renderer diagnostics. The original PDF rasterizations and native converter PNGs
are unchanged from the frozen run (5/5 each).
The preceding `final/` capture is retained. Relative to it, the four unstarred
Download SVGs changed and the starred file did not. All five 384 dpi live,
reopened Download and CLI PNGs are byte-identical to those in that prior capture.

- The main frame path matches the original PDF, local tikztosvg, live DOM, Download and strict CLI, including its starting corner and direction. In page coordinates the four reversed axes traverse NW, SW, SE, NE; the starred axis traverses SW, NW, NE, SE. The observed corner sequences are saved in `final-integrated/frame-walk.json`.
- The corrected skewed frame shows x = -1, 0, 1, 2, 3 and y = 0, 1, 2, 3. With the parent-axis local bounding box, the frame-to-colorbar gap is **3.17335 mm in the original PDF, 3.17323 mm in the workbench** (interim: 3.07023 mm). Its width/height differences from the PDF are +0.00138/-0.00156 mm.
- Across all five, the largest absolute workbench differences are 0.00264 mm at cell corners, 0.00172 mm at mark centers and 0.00239 mm at ticks. Cell fills, strokes, pen widths and sampled interior colors match. Visible index-label ink bounds differ by at most one pixel in the editor, two in reopened Chrome and four in CLI/librsvg at 384 dpi. At eight positions the colorbar differs by at most one RGB level in Chrome and two in CLI/librsvg.
- For two skewed cells, librsvg/Cairo reports consecutive fill and outline operations instead of a combined path. Both outlines have the native color and 0.14058 mm pen; the fill/outline corners differ by only 0.00036 mm. The raw operation numbers and deltas are retained under `splitStrokePairs` in `geometry.json`.

## Frozen evidence

Baseline `041f86ffb192820cd296dbee5878d90d4ec3614f`; renderer
`53a89d786772f6ebb79e30de19646f4d291a6cde16f842cda073e2a7deadc9ec`.
Independent tools: MacTeX pdfLaTeX, local tikztosvg 0.3.0, Poppler and librsvg.
The frozen workbench rendered all five as ordinary black lines through the nine
samples: **zero cells and zero colorbars, zero browser diagnostics**. All five
direct-route downloads matched a real Render/Download and the strict CLI.
Frozen page width/height minus PDF, in mm: explicit, table and starred
+4.715/+4.729; NaN -7.456/+2.495; skewed -12.272/-2.528.

- The frozen parser did **not** discard the samples following a blank line. All five have nine points. Coordinate lists retain scanlines 3/3/3; the table parser flattens the skewed table and loses its two separators. The regular table has no blank lines and explicitly supplies `mesh/cols=3`. The empty color is an absent metadata field; the numeric NaN reaches the parser as `"nan"`.
- The original NaN PDF logs `/pgfplots/warning/point meta unbounded`. That warning is recorded separately from browser diagnostics: the PDF and tikztosvg both leave the center unpainted. The other four originals have no PGFPlots warning.
- Source-PDF numeric fill sequence for 0 to 8: `#0000ff #60609f #c0c03f #ffef00 #ffbf00 #ff8f00 #ff5f00 #ff2f00 #ff0000`. Both native colorbars are 5 mm wide. All five PDFs paint the axis frame after the cells. The exposed white corner is a real painted polygon; the center of the explicit case is not.
- For the skewed table the native tick positions give limits x [-1.46, 3.16], y [-0.74, 3.04]. The center cell has vertices (0.45, 0.475), (1.5, 0.525), (1.575, 1.625), (0.525, 1.5). The bottom-right corner reaches (2.575, 3.125) but is clipped; there is no colored ink below the frame. Measurements compare absolute page millimetres, not an aligned or fitted picture.

## Replay

Use local Node dependencies, Chrome and Playwright, MacTeX with its PGFPlots
documentation archive, tikztosvg, Poppler, librsvg and Python with PyMuPDF,
Pillow and NumPy. Set `PLAYWRIGHT_MJS` to Playwright's installed `index.mjs`.
Run from the repository root with fresh stage names:

```sh
F=test/fixtures/native-pgfplots-matrix-plots
Q=outputs/qa/2026-11-25-pgfplots-matrix-plots
mkdir -p "$Q/frozen-041f86f"
git archive 041f86f -- bin src web scripts package.json package-lock.json | tar -x -C "$Q/frozen-041f86f"
rsync -a node_modules "$Q/frozen-041f86f/"
TREE="$Q/frozen-041f86f" STAGE="$Q/before-replay" REV=041f86f
node "$TREE/scripts/render-example-fixtures.js" --fixtures "$F" --output "$STAGE" \
  --native-reference --native-latex-engine pdflatex --strict-tikztosvg --tikztosvg-engine pdflatex \
  --math-renderer svg-text --no-comparison-grid --external-timeout-ms 180000
TIKZKIT_QA_RERENDER=1 node test/fixtures/native-positioning-targets/capture.mjs "$TREE" "$STAGE" "$PLAYWRIGHT_MJS" "$REV"
node "$F/probe.mjs" inputs "$STAGE"
node test/fixtures/native-pgfplots-histograms/replay.mjs routes "$STAGE" "$PLAYWRIGHT_MJS"
node "$F/probe.mjs" public "$STAGE" "$PLAYWRIGHT_MJS"
python3 "$F/measure.py" "$STAGE"
```

For an integrated build point `TREE` at the corresponding snapshot (or `.`),
and use a fresh stage and label. Add `--verify` to report geometry, palette or
ordering differences with a nonzero status. Position tolerance is 0.02 mm;
glyph text/locations and the eight colorbar samples are recorded separately.
To check a later worktree against a captured stage, run the `replay.mjs routes`
command above with `TIKZKIT_QA_COMPARE_TREE=.`.

```sh
python3 "$F/sheet.py" "$Q/before" "$STAGE" docs/qa/assets/native-pgfplots-matrix-plots.png
node "$F/probe.mjs" serve "$STAGE"
```

`inputs.json` verifies archive lines against the actual MacTeX input and records
the renderer's parsed points. `public-routes.json` checks both public source
paths and real downloads against the QA captures. `geometry.json` inventories the PDF and each real
output: cell corners/strokes/interior pixels, mark centers, labels, native tick
positions, colorbar samples, paint order and diagnostics. `capture/ui` holds
the untouched workbench screenshots. The comparison sheet uses the intrinsic
384 dpi images uniformly reduced 4:1 with no per-panel crops or fitting.
