# Explicit background scopes

[Four-case visual comparison: PDF, converter, Chrome before/after and reopened download](../../../docs/qa/assets/2026-11-26-native-background-scopes.png)

The two Background Library examples are the complete, unedited bodies of
`pgfmanual-en-library-backgrounds.tex` lines **34-48** and **66-75** from
TeX Live 2025 (Till Tantau, 2019; LPPL and/or GNU Free Documentation
License, see `doc/generic/pgf/licenses/LICENSE`). The second includes the
preceding `\tikzset`, the arrow and the **single-statement** `\scoped`.
Both are wrapped in a one-picture `standalone` document with a 2 pt border.
Neither example uses an end-picture frame.

The [corpus cyclic graph](../examples/latex-examples/cyclic-graph.tex) is
the existing LaTeX-examples source, not a redrawing or a renamed PGF layer:
it declares `background,main` and paints four thick edges in
`\begin{pgfonlayer}{background}` behind eight labeled vertices.
Its original `article` class, `preview` environment and 2 mm border are
unchanged. The [stress case](scopes-pen-reentry.tex) places foreground ink
before, between and after two background entries. A 6 pt magenta outer pen
must not replace the keyed green 2.5 pt pen or the hook's red 1 pt pen.
The blue 4 pt main lines must cross both and survive re-entry.

The [manifest](manifest.json) names all four sources. The two new public
gallery IDs are `scopes-manual-interleaved` and `scopes-manual-crossed-pens`;
the raw PGF control already has ID `latex-examples-cyclic-graph`.

## What was captured

MacTeX runs **pdflatex directly on the entire source** (two passes), then
Poppler rasterizes the single PDF page. The measurement checks the exact
manual lines and that every direct PDF input is byte-identical to its
fixture. The independent native converter is **/Library/TeX/texbin/tikztosvg**
0.3.0 with pdflatex, then **rsvg-convert** 2.63.0. The generator saves that
converter's actual input: it restores the classical arrow default as needed
and reproduces the document border in the converter's standalone wrapper.
For the graph it also preserves the corpus preamble as a generated package.
There is no silent PDF fallback.

Chrome 158.0.8127.37 clicks **Render**, waits for the previous SVG to be
detached, and clicks **Download SVG**. The live page and the reopened, actual
download are captured separately. All image comparisons use 384 dpi at the
declared page size, aligned by the **top-left physical page origin**.
Only the bottom and right get white padding. Counts are pixels differing
by more than 16 in any 8-bit RGB channel, not a claim of identical pixels.
The [probe coordinates](probes.json) are in millimetres from that same origin;
their third field is the observed reference PDF color. The vector paint
order and unscaled pen widths in mm are recorded separately.

## Results

[Before archive](captures/before-ef8f4152.zip), SHA-256
`c090f6ffaaf38b83270bc6ce85e7a9e974b62850ea1391a1ceb466f593626e61`.
Baseline `ef8f4152`, renderer fingerprint `24a68f0ca1d3`.
[Final archive](captures/after-eff0b0e8ae40.zip), SHA-256
`56ec4dc5edd73f195e6f2fe92a3c66b631795a325234de1a54cd1ac281dc6a8a`.
The final renderer is identified by its fingerprint `eff0b0e8ae40`, not by
a commit. Both archives contain direct PDF inputs and pages, native reference images,
converter inputs and SVGs, full workbench screenshots, live SVGs and
images, literal downloads, reopened images, diagnostics and measurements.
Both independent reference PNGs for each case are byte-identical across runs.
The final archive's `public-routes.json` also confirms that the three real
public gallery routes returned the same download bytes as the focused capture.

Fixed-origin pixel counts **against the original PDF**:

| Source | Before Render | Final Render | Final Download | Native converter |
| --- | ---: | ---: | ---: | ---: |
| Manual color layers | 46,087 | 3,284 | 1,750 | 0 |
| Manual crossed pens | 8,422 | 1,969 | 1,481 | 0 |
| Corpus cyclic graph | 4,884 | 4,884 | 12,362 | 547 |
| Two background entries | 46,304 | 3,901 | 5,391 | 0 |
| **All four** | **105,697** | **14,038** | **20,984** | **547** |

- **Manual fills:** before, both the yellow corner and the exposed blue disc
  were black. Both now match the PDF: `#fff200` and `#0000ff` respectively;
  the black inset and the final `#8080ff` stripe are also in the right layers.
- [x] **Manual `\scoped`: color, stacking, width and position verified.**
  Before, the red diagonal was absent and Chrome reported unsupported
  `\scoped`. The final live and downloaded SVGs both paint red first, then
  the black arrow. The isolated shaft pixel is `#ff0000`; the crossing is
  `#000000`. Both shaft widths are **1.51322 mm**, against **1.51324 mm**
  in the PDF. The largest absolute X or Y endpoint difference, across both
  shafts, is **0.00049 mm** vs PDF and zero to five decimal places vs the
  converter. Actual page-origin coordinates are in `metrics.json` under
  `panels.*.shafts`. The initial engine-only trial still omitted red; these
  final numbers are from a fresh browser run after frontend integration.
- **Corpus graph:** the four pink 5 pt highlights, eight gray vertices and
  black edges already stacked correctly. Live pixels and the actual download
  bytes did not change between before and after. This is a control, not an
  improvement credited to the fix.
- **Stress:** both background pens used to be magenta, 2.10876 mm wide.
  Now the keyed green pen is 0.87865 mm and the hook's red pen is 0.35146 mm
  (PDF 0.87866 / 0.35147). The later red fill covers green in the overlap,
  and the blue 4 pt main pen crosses both and is still blue after re-entry.

**Remaining differences:** all 15 color probes match the PDF in both Chrome
views, with no editor diagnostics, export diagnostics or browser errors.
Page extents differ by up to 0.00026 mm. The previews and reopened downloads
are **not pixel-identical**, either to the PDF or to one another. For the
crossed pens alone there are 2,356 live-vs-download pixels over threshold.
Every final pixel over threshold vs the PDF (including all 12,362 in the
downloaded graph) lies within a 5 x 5 window containing a native edge:
at least one PDF channel varies by more than 16 there. This localizes the
residual to boundaries; it does not equate the rasterizers or prove why
each pixel differs. The two native references also differ at 547 graph pixels.

## Replay

From the repository root, provide an immutable renderer tree (including
`bin`, `src`, `web`, `scripts`, both package files and installed dependencies)
and the path to a local Playwright installation that can launch Chrome.
MacTeX, Poppler, librsvg and Python with PyMuPDF, NumPy and Pillow are needed.
Use a **new** stage for every run. Use revision label `ef8f4152` for the
baseline, or `after-<first 12 hex digits of the renderer fingerprint>` for
a final stage. No external service is involved.

```sh
F=test/fixtures/native-background-scopes
sh "$F/capture.sh" "$TREE" "$STAGE" "$PW" "$REV"
python3 -B "$F/report.py" seal "$STAGE" "$F/captures/$REV.zip"
```

Capture reuses the gallery renderer and the existing workbench click/download
harness. The report reuses the earlier backgrounds geometry reader and Petri
fixed-origin pixel comparison. `capture.sh` refuses an existing stage, and
`seal` refuses an existing archive. To reproduce just the sheet and residual
counts from the sealed evidence, without either renderer or a browser:

```sh
F=test/fixtures/native-background-scopes
mkdir -p "$F/output"
R=$(mktemp -d "$F/output/replay-XXXXXX")
A="$R/after"
B="$R/before"
unzip -q "$F/captures/before-ef8f4152.zip" -d "$B"
unzip -q "$F/captures/after-eff0b0e8ae40.zip" -d "$A"
python3 -B "$F/report.py" edges "$A"
python3 -B "$F/report.py" sheet "$B" "$A" "$R/sheet.png"
```
