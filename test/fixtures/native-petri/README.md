# Replay the seven Petri manual pictures

[Six small drawings](../../../docs/qa/assets/2026-11-25-native-petri.png) |
[Full mutual-exclusion network](../../../docs/qa/assets/2026-11-25-native-petri-mutual-exclusion.png).
Each sheet shows the MacTeX PDF, local `tikztosvg`, frozen and final Chrome
Render, the final Download SVG reopened in Chrome, and the strict CLI via
librsvg. Every panel shows the whole page at the same 2:1 reduction (384 to
192 dpi), from its own page origin. There is no trimming, fitting or registration.

The [catalog](manifest.json) records the exact ranges in TeX Live 2025's
`doc/generic/pgf/pgfmanual-en-library-petri.tex`, copyright 2019 Till Tantau
(LPPL and/or GFDL). All seven picture bodies are byte-identical to the manual.
MacTeX compiles each full fixture unchanged. The local converter's prepared
input restores the classical arrow tip and accounts for the standalone border;
it is not a second compilation of the byte-identical input file.

## Replay the saved captures

From the repository root, use the archived stages, their recorded renderer
trees, Node, the installed TeX manual (`kpsewhich`), librsvg, and Python with
PyMuPDF, NumPy and Pillow. These commands do not launch Chrome or rerun TeX.

```sh
F=test/fixtures/native-petri
Q=outputs/qa/2026-11-25-native-petri
B="$Q/before-seven"
A="$Q/final-65f00765d470"
python3 "$F/proof.py" "$B"
python3 "$F/proof.py" "$A"
python3 "$F/sheet.py" "$B" "$A" docs/qa/assets/2026-11-25-native-petri.png
```

`before-seven` is commit `096af885` (renderer fingerprint `9ee37121b259`);
the final capture uses `tree-final` (renderer fingerprint `65f00765d470`, not
a Git commit). Each stage's `capture.json` records the Render click, actual
download, browser and hashes. `proof.json` checks these against the archived
summary and source files, then records unregistered pixel differences and
measurements of the PDF and saved SVG paths in page millimetres. Only the
strict CLI SVG and the librsvg rasters are regenerated, under `capture/cli/`
and `capture/rsvg/`. The full workbench screenshots remain in `capture/ui/`.
The sheet command writes the network to the sibling `*-mutual-exclusion.png`.

## Recorded results

Dots are painted token circles. Pixel columns count differing pixels with an
absolute change **greater than 16** in any 8-bit RGB channel, on the original
384 dpi captures with white padding at the right/bottom when sizes differ.
The PDF raster is from Poppler; the live and download rasters are from Chrome
`158.0.8127.37`. Counts are observations, not pass thresholds.

| Picture | Dots: PDF / frozen / final | PDF vs frozen live | PDF vs final live | Final live vs download |
| --- | ---: | ---: | ---: | ---: |
| Two labeled places | 2 / 0 / 2 | 5,907 | 908 | 3,072 |
| Styled tokens | 10 / 0 / 10 | 34,066 | 1,142 | 4,623 |
| Transition | 2 / 0 / 2 | 8,773 | 1,646 | 5,318 |
| Structured atlas | 45 / 0 / 45 | 48,770 | 3,474 | 27,394 |
| Colored tokens | 4 / 0 / 4 | 2,839 | 345 | 1,713 |
| Explicit children | 4 / 0 / 4 | 18,020 | 477 | 2,347 |
| Mutual exclusion | 5 / 0 / 5 | 304,780 | 59,065 | 48,983 |

For the full network (manual lines 273-318), both local references, the final
live SVG and the downloaded SVG have 18 places, 16 transitions, five tokens,
50 straight shafts and 56 arrowheads. The frozen SVG has text but none of
those shapes. The proof's `arcs` inventory counts **106 painted paths, not
106 edges**: `l` denotes a shaft and `cc` a two-cubic arrowhead in this drawing.

| Full network: largest absolute coordinate difference (mm), final live SVG | vs MacTeX PDF | vs local tikztosvg |
| --- | ---: | ---: |
| Place center | 0.00166 | 0.00141 |
| Transition center | 0.00165 | 0.00142 |
| Token center | 0.01866 | 0.01869 |
| Shaft endpoint | 0.03013 | 0.03034 |
| Arrowhead path point (includes controls) | 0.03128 | 0.03169 |

The final network page is 0.01542 mm narrower and 0.00043 mm shorter than
the PDF. All 18 measured label ink boxes in the final live and reopened
Chrome images are within one pixel of the PDF boxes. These are dark-pixel
bounds in PDF-line windows after masking nearby geometry, not a glyph-shape
match. The 52 matched black glyph origins in the converted live SVG have
maximum absolute x/y differences of 0.19355/0.02528 mm against the PDF.
Local `tikztosvg` outlines the text; it has no corresponding text origins.

The final stage has zero Render/export diagnostics, and all seven actual
downloads match the corresponding strict CLI SVG **bytes**. At the frozen
stage only six matched: the network was the exception. Identical SVG files
do not imply identical browser and librsvg pixels or identical fonts.
These are rendering observations for seven inputs, not a general TikZ
compatibility claim or a verification of mutual exclusion as a property.
The earlier `before/public-routes.json` and `candidate-six/public-routes.json`
cover only the styled pair, transition and atlas. Their download hashes match
the respective seven-case stages; this replay did not navigate public routes.

## Fresh capture only

When a new capture is needed, also use Chrome, local Playwright, MacTeX,
Poppler and local `tikztosvg`. Set `TREE` to the chosen renderer tree, `REV`
to its identifying label, `STAGE` to a **fresh** directory and
`PLAYWRIGHT_MJS` to Playwright's local `index.mjs`. Keep the archived stages.

```sh
F=test/fixtures/native-petri
command -v tikztosvg
jq -r '.cases[] | "--only", .id' "$F/manifest.json" | xargs node "$TREE/scripts/render-example-fixtures.js" \
  --fixtures "$F" --output "$STAGE" --native-reference --native-latex-engine pdflatex \
  --strict-tikztosvg --tikztosvg-engine pdflatex --math-renderer svg-text --no-comparison-grid
TIKZKIT_QA_RERENDER=1 node test/fixtures/native-positioning-targets/capture.mjs "$TREE" "$STAGE" "$PLAYWRIGHT_MJS" "$REV"
python3 "$F/proof.py" "$STAGE"
```
