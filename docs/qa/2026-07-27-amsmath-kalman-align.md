# amsmath `align*` row-spacing visual QA

## Scope

This slice corrects the vertical baseline spacing of `align*` / `aligned` SVG-text fallback rows. It is driven by the real `latex-examples-kalman-filter` fixture, specifically the `Prediction` and `Innovation` nodes. It does not claim complete support for the whole Kalman-filter source.

## Local MacTeX implementation review

- `/usr/local/texlive/2025/texmf-dist/tex/latex/amsmath/amsmath.sty`
- `/usr/local/texlive/2025/texmf-dist/source/latex/amsmath/amsmath.dtx`
- `/usr/local/texlive/2025/texmf-dist/tex/latex/base/fontmath.ltx`

`amsmath` starts `align*` through `\\start@align`; its `\\spread@equation` executes `\\openup\\jot`. For the default 10pt document font this is the 12pt baseline plus the default 3pt `\\jot`, or a 15pt / `1.5em` row baseline. This is why an ordinary browser-like `1.22em` line height caused scripts in one formula row to crowd the next.

## Artifacts and visual inspection

- Native MacTeX PNG: `outputs/qa-amsmath-kalman-align/native-mactex.png`
- TikZKit SVG and grid PNG: `outputs/qa-amsmath-kalman-align/tikzkit.svg`, `outputs/qa-amsmath-kalman-align/tikzkit-grid.png`
- tikztosvg SVG and grid PNG: `outputs/qa-amsmath-kalman-align/tikztosvg.svg`, `outputs/qa-amsmath-kalman-align/tikztosvg-grid.png`
- Four-way sheet: `outputs/qa-amsmath-kalman-align/comparison-sheet.png`

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used `/opt/homebrew/bin/rsvg-convert`. The `tikztosvg` SVG uses TeX glyph paths and a transparent page, so its panel renders black in the comparison viewer. Native MacTeX PNG is the visual authority for text-row geometry.

Before the fix, TikZKit placed display rows about `1.22em` apart and deep subscripts/superscripts visibly intruded into the following row. After the fix its generated baseline is `14.94pt` after SVG-to-point conversion, matching MacTeX's 15pt target. The TikZKit `Prediction` box is `39.63pt` high versus the reference `40.66pt`; the `Innovation` box is `63.59pt` versus `63.56pt`. Remaining difference is glyph shape and browser text bounding behavior, not the aligned-row geometry.

## Source audit status

The semantic audit inventories this source's four packages, three libraries, 19 commands, 16 option groups, two declarations, and 25 numeric values in `outputs/semantic-audits/kalman-filter.md`. It remains **blocked for whole-case acceptance** because many TeX macro and option entries have not yet been individually reviewed. This change accepts only the verified `align*` row-spacing slice.

## Verification

```sh
node --test --test-name-pattern "uses script-cluster widths|uses amsmath's opened-up baseline skip|uses a display formula node" test/renderer.test.js
node scripts/render-example-fixtures.js --only latex-examples-kalman-filter --output /private/tmp/qa-amsmath-kalman-after --comparison-grid svg --tikztosvg-engine xelatex
node scripts/diff-example-pngs.js --output /private/tmp/qa-amsmath-kalman-after
node scripts/case-semantic-audit.js test/fixtures/examples/latex-examples/kalman-filter.tex --init-review outputs/semantic-audits/kalman-filter.review.json --output outputs/semantic-audits/kalman-filter.md
```

## Remaining work

Add command/parameter ownership for the Kalman source before strict case acceptance, then cover `tag`, `intertext`, `split`, `gathered`, and `multline` against real MacTeX fixtures.
