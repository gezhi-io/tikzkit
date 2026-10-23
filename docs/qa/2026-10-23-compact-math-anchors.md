# Native Compact Text, Anchors and Pattern Bounds

## Scope and Status

This batch addresses a shared text-box and anchor capability, selected from
the failing-suite inventory and the high-frequency core TikZ/PGFPlots entries.
It does not claim full TikZ, PGFPlots, datavisualization or paragraph compatibility.
The adjacent pattern fix restores visibly missing dots after page cropping.

The completed whole-suite comparison is **76 -> 46 failures**, with no new
failing test names. The immediate compact-text baseline was 50 failures; this
slice removes four of those. These are test counts, not counts of certified
whole figures. The earlier 3D, quiver, color and histogram repairs account for
the other reductions, as recorded in their separate reports.

| Full run | Tests | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: | ---: |
| Path-node baseline | 2827 | 2737 | 76 | 14 |
| Quiver baseline | 2910 | 2846 | 50 | 14 |
| Compact-text integration | 2933 | 2873 | 46 | 14 |

Reports are under `outputs/qa/2026-10-23-path-node-after/test-summary.json`,
`outputs/qa/2026-10-23-pgfplots-quiver-after/test-summary-final.json` and
`outputs/qa/2026-10-23-compact-math-after/test-summary-final.json`.

## Local Implementation Read

All paths below are relative to `/usr/local/texlive/2025/texmf-dist/`.

| Native source | Implementation rule used |
| --- | --- |
| `tex/generic/pgf/modules/pgfmoduleshapes.code.tex:930-1064` | Rectangle anchors use the original text hbox width, height and depth, plus independent inner/outer separation. Base is the hbox baseline. |
| `tex/generic/pgf/frontendlayer/tikz/tikz.code.tex` | Node fonts precede text-box construction; above/below/left/right select compass anchors; inline `baseline` means 0pt. |
| `tex/latex/base/fontmath.ltx`, `ot1cmr.fd`, `omlcmm.fd`, `omscmsy.fd`, `ot1cmtt.fd` | Math families and optical sizes; CMTT is not a browser substitute with a fitted advance multiplier. |
| `fonts/tfm/public/cm/cmtt10.tfm` | Native advances, descenders, XHEIGHT and QUAD. The 10pt CMTT quad is about 10.4999pt, not 10pt. |
| `tex/generic/pgf/libraries/shapes/pgflibraryshapes.multipart.code.tex` | Horizontal split-node parts preserve text baseline anchors. |
| `tex/latex/graphics/graphics.sty:514-535`, `tex/latex/graphics-def/pdftex.def` | `scalebox` builds the original box and transforms it; it does not select a smaller optical font. |
| `tex/generic/pgfplots/pgfplots.code.tex:5139-5165` | Middle-axis paths end at the transformed limits. Pen/arrow extents are separate painted bounds. |
| `tex/generic/pgf/basiclayer/pgfcorepatterns.code.tex:130-182`, `tex/generic/pgf/systemlayer/pgfsys-pdftex.def:186-218` | Tiling paint bounds, repeat steps and page-relative phase are separate. Enumeration must inverse-translate the phase first. |

Independent probes are retained in `test/fixtures/compact-math-anchor-metrics.tex`,
`compact-axis-description-metrics.tex`, `compact-math-renderer-metrics.tex`,
`compact-scalebox-metrics.tex` and `inline-text-box-metrics.tex`.

Selected native measurements, in TeX points:

| Box | Width | Height | Depth |
| --- | ---: | ---: | ---: |
| 10pt math x | 5.71527 | 4.30554 | 0 |
| 9pt math log x | 18.73254 | 6.25 | 1.75 |
| CMTT10 UAG | 15.74986 | 6.11111 | 0 |
| Colored GUG/CAU plus inline UAG | 48.95673 | 6.96469 | 0.85358 |
| Inline CMTT STOP, 0.3mm padding | 22.70697 | 6.96469 | 0.85358 |
| Half-scaled textstyle times 1 | 6.38890 | 3.22221 | 0.41666 |

## Runtime Changes

- `src/tex/mathBox.js`: supported ordinary math uses the same native TFM box
  path as fractions/scripts. Unsupported complete formulas retain fallback.
- `src/tex/textBox.js`, `src/tikz/text.js`: native literal CMTT10 layout and
  supported colored inline text hboxes; preserve the original font, color,
  padding and anchor instead of flattening them into unrelated width estimates.
- `src/engine/evaluate.js`: use those boxes for directional/base anchors,
  circle/rectangle geometry and horizontal split-node parts. Keep text alignment
  distinct from a painted node's shape anchor.
- `src/tex/relativeMath.js`, `src/renderers/svg/mathNode.js`: positive uniform
  whole-math scaling transforms completed boxes and keeps original optical faces.
- `src/renderers/svg/plainTextNode.js`, `textEngine.js`, `nativeMath.js`: browser,
  asynchronous and exported SVG use the same eligible boxes and glyph origins.
- `src/pgfplots/axisLines.js`: remove synthetic 0.2pt endpoint enlargement;
  continue including actual stroke/arrow paint bounds.
- `src/renderers/svg/formOnlyPatterns.js`: inverse-translate the cropped-page
  phase before enumerating tiles; test positive and negative origin offsets.
- `scripts/build-cm-math.py`, `src/tex/cmMathMetrics.js`: add metrics from the
  local CMTT10 TFM; reuse the existing local-source browser font asset.

Tests that depended on the old HTML/SVG serialization were migrated to native
font-family, glyph-order and measured-box checks, separately from runtime fixes.
The reasoning and original failures are recorded in
[renderer assertion integration](2026-10-23-compact-math-renderer-tests.md).
No existing visual threshold was relaxed. Independent probes and new failing
tests preceded the inline-box, baseline, font-quad and scalebox corrections.

## Commands and Parameters

| Feature exercised | Result and boundary |
| --- | --- |
| `node`, inline path `node`, ordinary math, declared styles | Supported existing paths now share actual native text dimensions. |
| `above`, `below`, `left`, `right`, explicit compass/base anchors, shifts, rotate | Native local separation and baseline used; arbitrary nonuniform transformed anchors remain partial. |
| `inner sep`, `inner xsep`, `inner ysep`, `outer sep`, thick/custom line width | Included in the relevant text/shape/paint calculation rather than a global offset. |
| `font=\small`, `\tt`, `\ttfamily`, literal typewriter text | CM math optical size retained; exact native CMTT support is limited to the packaged 10pt face. |
| `rectangle split`, horizontal parts, `nodepart` | Native CMTT part baselines/advances improved; nested picture width and connectors remain imperfect. |
| Positive uniform `\scalebox{factor}{whole math}` | Original box, glyphs, rules and scripts scale together. Negative/nonuniform and mixed-paragraph scaling are outside this implementation. |
| `\textcolor`, inline `\tikz[baseline]` containing one filled rectangle | Retains literal CM/CMTT text, base/center anchor and inner x/y padding in pt/mm/cm/em/ex. Arbitrary inline drawings, transforms, styles, math and nested pictures remain fallback. |
| Middle axes and explicit offsets | Native endpoints restored; not a general axis/tick/legend completion. |
| Declared form-only pattern fill | Visible tile enumeration fixed; pattern transforms, mutable/color declarations and full PGF drawing remain partial. |

## Actual Visual Comparison

`command -v tikztosvg` found `/Library/TeX/texbin/tikztosvg`.
The reference uses the local pdflatex engine and local MacTeX packages; no font
or reference package was downloaded. The wrapper SVG is rasterized with local
`rsvg-convert`. Direct MacTeX PDF-to-PNG images are also retained.

Artifact roots under `outputs/qa/`:

- `2026-10-23-compact-math-final`: seven ordinary math, anchor, typewriter,
  earth, arrow and boxed-3D figures.
- `2026-10-23-compact-math-controls-final`: seven B-tree, datavisualization,
  LDA, styled-legend, linked-list, pattern and polar controls.
- `2026-10-23-compact-scalebox-after`: scaled products, scripts and fractions.
- `2026-10-23-compact-math-renderer-gene-after`: literal, colored inline-box
  and baseline/padding figures.

Every root contains `tikzkit-svg`, `tikzkit-png`, `tikztosvg-svg`,
`tikztosvg-png`, `mactex-png`, `diff` and `browser` artifacts.
Open `browser-audit.html` for actual Chrome screenshots of the default browser
path, native reference, SVG-text path, prior output where available, and diff.
`diff/*-native-sheet.png` includes the separately rasterized MacTeX PDF.

The native SVG contains outlined font definitions and positioned `use` elements,
not browser font substitution or foreignObject text. Its glyph origins, TeX/PDF
unit conversion, stroke bounds and clipped pattern cells were inspected.
For the audited text slices, browser glyph comparisons use one translation
from the painted frame and a fixed physical scale, not image-by-image fitting.

| Figure group | Observed improvement | Visible remainder |
| --- | --- | --- |
| Ordinary math / directional anchors | Correct CM optical glyphs, baselines and compass separation; default and export agree. | Native outline quantization and raster ink differences remain. |
| CMTT / Gene | Correct glyph advances/base anchors; restored blue/green runs and full white UAG/STOP inside correctly sized red backgrounds. | Direct PDF and SVG rasterizers still differ at glyph edges. |
| Scalebox | Half-scaled formula retains 10pt outlines scaled by 0.5; no oversized 5pt optical substitution. | Native PDF raster differences remain. |
| Styled math boxes | Circle text is centered; node size uses the selected 9pt box. | Some rounded-border rendering still differs. |
| Pattern control | Missing upper rows of dots restored; visible tile coverage follows page phase. | Plain label font/baseline and raster details differ. |
| Earth / arrow | Ordinary math labels and compact arrow canvas height improve. | Earth prose label and some arrow/ink details remain different. |
| B-tree / linked list | Typewriter numerals and part baselines improve. | Outer widths, nested padding and some connectors still disagree. |
| LDA / boxed 3D | Native axis endpoints and calibrated canvas checks pass. | Some text/fallback and raster details differ. |
| Datavisualization / polar / styled legend | Shared math and shape-center corrections retained. | Tick selection, legend row/column spacing, absolute bounds and some clipping remain visibly wrong. |

The original 0.09px glyph-origin threshold is unchanged. The main 49-glyph gate
has maximum error 0.027624px; scalebox's 24-glyph gate is 0.014126px; the Gene
14-glyph gate is 0.003928px and its 24-character literal gate is 0.006289px.
Both default browser and SVG-text paths pass those gates with no browser errors.
The final additional padding fixture passes its 12-glyph gate at 0.003796px.
Together, the 18 browser figures cover 123 independently matched glyph origins
per renderer; the broader controls have no whole-figure acceptance claim.

**Whole-raster acceptance is not claimed.** Nine of the eighteen
JS/tikztosvg PNG pairs pass the unchanged raster threshold; all direct
PDF-to-PNG comparisons still trip the strict raster gate. The seven broader
controls include real geometry/type differences, not merely antialiasing noise.
No blocked comparison was relabeled as passing.

## Reproduction

```sh
node --test test/compact-math-anchors.test.js test/compact-scalebox.test.js test/inline-text-box.test.js test/pattern-declarations.test.js
node --test --test-reporter=./scripts/module-test-reporter.js --test-reporter-destination=outputs/qa/2026-10-23-compact-math-after/test-summary-final.json test/*.test.js
npm run gallery:audit
npm run check:architecture
npm run docs:links
```

For each fixture directory, generate both reference formats before auditing:

```sh
node scripts/render-example-fixtures.js --fixtures test/fixtures/compact-math-renderer-gene --output outputs/qa/2026-10-23-compact-math-renderer-gene-after --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text --strict-tikztosvg
node scripts/diff-example-pngs.js --output outputs/qa/2026-10-23-compact-math-renderer-gene-after
node scripts/audit-module-regressions.js --fixtures test/fixtures/compact-math-renderer-gene --output outputs/qa/2026-10-23-compact-math-renderer-gene-after --before outputs/qa/2026-10-23-compact-math-renderer-gene-before --browser-module /Users/kaiwu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs
```

The focused anchor, scalebox, inline-box, pattern and LDA regression run reports
**30 passed, zero failed** in `2026-10-23-compact-math-final/focused-tests.json`.
The complete gallery renders **660/660 with zero diagnostics**. This is a
smoke check, not visual acceptance of all 660 figures. Architecture checks pass
with the already recorded `tikz/text.js -> frontend/latex-shell.js` legacy edge.

## Remaining Failures and Next Order

| Module | Remaining failures |
| --- | ---: |
| extensions | 10 |
| renderer | 7 |
| interpreter | 6 |
| petarv compatibility | 6 |
| pgfplots seams | 6 |
| parser | 2 |
| tikzquads | 2 |
| automata, capabilities, fixture ownership, real cases, shading, signal shape, gensymb | 1 each |

Prioritize actual visible defects: datavisualization endpoint/single-point ticks
and legend spacing; A3C node widths and paragraph layout; circuitikz triode
components; scientific-table mantissa/exponent baseline alignment. Recheck
legacy serialization/capability assertions against local source independently
rather than rewriting all remaining expectations to match current output.
The 46-test inventory and exact failure messages are preserved in the full
JSON report. No npm publish, git reset or unrelated cleanup was performed.
