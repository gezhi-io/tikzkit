# decorations.text Reverse Text QA (2026-08-06)

## Scope

This slice implements the documented `text effects along path` recognition and
`text effects={reverse text}` character ordering. It is intentionally limited
to reversing the scanned character boxes before the existing per-glyph path
placement. It does not claim the full text-effects framework.

Driver: `test/fixtures/examples/decorations/text-reverse.tex`.

```tex
\path[decorate,text effects={reverse text},decoration={
  text effects along path,text={normal text},text align={center},
  text effects/.cd,characters={text along path}}]
  (0,0) -- (6,0);
```

## Local MacTeX Review

Reviewed TeX Live 2025 files:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.text.code.tex` measures character boxes and distributes them along the decorated path.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.text.code.tex` declares `text effects along path`; its `reverse text` key appends a reversal transform before character counting and placement.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex` documents that text effects place each character as a TikZ node and that `reverse text` reverses the character sequence before other text operations.

The shared implementation rule is: recognize the text-effects decoration,
parse the path-level `text effects={...}` options, and reverse the already
measured glyph sequence before sampling its positions on the path.

## Reference Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`; native references used local `pdflatex`.

Ignored rendered artifacts are in
`/private/tmp/tikzkit-qa-decorations-text-reverse-after-2026-08-06/`:

- `mactex-png/decorations-text-reverse.png`
- `tikzkit-svg/decorations-text-reverse.svg`
- `tikzkit-png/decorations-text-reverse.png`
- `tikztosvg-svg/decorations-text-reverse.svg`
- `tikztosvg-png/decorations-text-reverse.png`
- 1cm-grid variants and `diff/decorations-text-reverse-native-sheet.png`

The tikztosvg SVG represents TeX glyphs through reusable outline paths in
`<defs>`/`<use>` with a `0 0 170.48 56.89` viewBox. TikZKit emits semantic SVG
`<text>` glyphs with individual rotations. The backends differ structurally,
but the rendered glyph order and positions are the same.

## Visual Review

Before this change, MacTeX and tikztosvg showed `normal text` on the upper
guide and `txet lamron` on the lower guide. TikZKit recognized neither
`text effects along path` decoration, so both labels were absent while the
dashed guides remained.

After the change, all three renderings show the upper `normal text` and lower
`txet lamron` centered on their respective dashed paths. The 1cm grids place
both text baselines at the same guide rows. The registered TikZKit versus
tikztosvg raster comparison is accepted as `same`: `57/17328` changed pixels
(`0.329%`), all at glyph antialiasing edges, with no displaced or missing
geometry. The MacTeX sheet retains the expected PDF/SVG glyph-raster and crop
differences.

## Change And Verification

- `src/engine/evaluate.js`: recognizes `text effects along path` and carries
  the outer `reverse text` option into the drawing IR.
- `src/renderers/svg/decorationText.js`: reverses character boxes before
  distance sampling.
- `src/tikz/libraries/decorations.text.js`: records the reviewed source and
  supported boundary.
- `test/fixtures/examples/decorations/text-reverse.tex`: supplies the real
  documented driver.
- `test/interpreter.test.js` and `test/svg-renderer.test.js`: protect the
  interpretation and rendering boundary.

```bash
node --test --test-name-pattern='supports decorations\\.text effects along path' \\
  test/interpreter.test.js
node --test --test-name-pattern='reverses decorations\\.text character boxes' \\
  test/svg-renderer.test.js
npm run examples:render -- --fixtures test/fixtures/examples \\
  --output /private/tmp/tikzkit-qa-decorations-text-reverse-after-2026-08-06 \\
  --only decorations-text-reverse --native-reference --comparison-grid-mode svg \\
  --strict-tikztosvg
npm run examples:diff -- --output /private/tmp/tikzkit-qa-decorations-text-reverse-after-2026-08-06 \\
  --register
```

The focused tests pass, generated artifacts have no diagnostics, and the real
driver has a visible compatibility improvement. Remaining work includes
character-specific style dispatch, replacement/repeat/group text effects,
scale/fit effects, and exact TeX glyph metrics.
