# CircuitikZ component label sides

## Scope

- Library: `circuitikz`; registry status remains `partial`.
- Accepted slice: ordinary bipole labels `l`, `l_`, `l^`, `label below`, and `label above` on the path-relative side of square/triangle voltage sources, resistors, and capacitors.
- Separation rule: active-source shortcuts such as `V=...`, `sV=...`, `sqV=...`, `tV=...`, and the corresponding current-source forms retain their voltage/current annotation semantics; an explicit `l=...` is a separate component label.
- Math dependency: grouped upright label text such as `V_{\mathrm{pulse}}` must keep the group as a real subscript in SVG-text output.

This slice was chosen after rendering all 114 manifest cases that lacked canonical TikZKit PNGs. Most high-risk candidates were already visually close. The real `circuitikz-waveform-dimensions-physics` panel was a larger semantic gap: MacTeX and tikztosvg showed four component labels, while TikZKit omitted all four.

## Local source review

- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcirclabel.tex`, lines 33-72, stores `l` independently and maps `l^`/`label above` to position `90` and `l_`/`label below` to `-90`.
- The same file, lines 110-163 and 235-299, starts placement at the component outline anchor, applies a `.75ex` label space, derives the text anchor from path direction and side, and keeps straight/rotated/smart label modes distinct.
- `/usr/local/texlive/2025/texmf-dist/doc/latex/circuitikz/circuitikzmanual.tex`, lines 8740-8915, distinguishes component labels and annotations from voltage/current labels. Source shortcut values belong to the latter channel; explicit `l=...` remains the ordinary bipole label.

## Reference tools and artifacts

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`
- MacTeX engine: `/Library/TeX/texbin/pdflatex`
- SVG-to-PNG: `/opt/homebrew/bin/rsvg-convert`
- Comprehensive candidate scan: `outputs/qa/2026-09-06-severe-scan-all-missing/`
- Accepted three-case output: `outputs/qa/2026-09-06-circuitikz-component-label-sides-final/`
- Primary inspected sheet: `outputs/qa/2026-09-06-circuitikz-component-label-sides-final/diff/circuitikz-waveform-dimensions-physics-native-sheet.png`

The tikztosvg reference emits glyph paths in `defs/use`, transformed component paths, nonzero fill, butt caps, and miter joins. Its four labels agree with MacTeX. TikZKit intentionally retains browser text elements, but now preserves the same label channel, side, and grouped-subscript structure.

## Visual review

- Before: the square source, resistor, triangle source, and capacitor were present, but `V_{\mathrm{pulse}}`, `R`, `V_{\mathrm{ramp}}`, and `C` were all absent. The circuit therefore lost semantic information even though the geometry looked close.
- After: all four labels appear on the right side of the vertical paths, matching `l_` for the two sources and `l` for the resistor/capacitor. The source shortcut remains a voltage annotation rather than being duplicated as a component label.
- After the math follow-up: `pulse` and `ramp` are smaller, upright, and lowered as grouped subscripts; the literal underscore/baseline rendering is gone.
- The companion algorithm and mathematics waveform cases retain their source geometry and zero diagnostics. Remaining small font-paint and label-gap differences are not treated as missing semantics.

The raw changed-pixel ratio increases after adding the previously absent glyphs because browser text and TeX glyph paths rasterize differently. That number is therefore not an acceptance criterion here; the inspected before/after panels show the actual missing-element repair.

## Implementation and tests

- `src/engine/evaluate.js`: separates component labels from source voltage/current labels and resolves the requested side from the original options.
- `src/renderers/svg/mathUprightFallback.js`: parses the complete scripted expression before serializing scoped upright text.
- `test/circuitikz-waveform-source-dimensions.test.js`: covers label/annotation separation and side placement.
- `test/svg-renderer.test.js`: prevents `V_{\mathrm{pulse}}` from regressing to a literal underscore and baseline text.

Commands:

```sh
node --test test/circuitikz*.test.js
node --test test/svg-renderer.test.js
npm test
npm run extension-registry
node scripts/render-example-fixtures.js --output outputs/qa/2026-09-06-circuitikz-component-label-sides-final --only circuitikz-waveform-dimensions-physics --only circuitikz-waveform-dimensions-algorithm --only circuitikz-waveform-dimensions-math --native-reference --continue-on-external-failure --tikztosvg-engine pdflatex --math-renderer svg-text
node scripts/diff-example-pngs.js --output outputs/qa/2026-09-06-circuitikz-component-label-sides-final --register --alignment-radius 4
```

The focused CircuitikZ family has 41 passing tests, zero failures, and two optional-corpus skips. All three real fixtures render in TikZKit, tikztosvg, and MacTeX with zero external failures and zero TikZKit diagnostics.

The full suite has 2484 tests: 2334 pass, 136 known failures, and 14 skips. The pre-change baseline in the same run had 2482 tests, 2332 passes, 136 failures, and 14 skips, so this slice adds two passing regressions without increasing failures or skips. The standalone SVG-renderer file still contains two pre-existing metric-tolerance failures; neither involves this label or grouped-subscript slice.

## Remaining work

- `label/align=rotate|smart`, stacked `l2` labels, and exact font-dependent `.75ex` spacing are still partial.
- The broader unsupported bipole catalog remains outside this slice.
- Browser SVG text and TeX glyph paths still have small rasterization and bounding-box differences.
