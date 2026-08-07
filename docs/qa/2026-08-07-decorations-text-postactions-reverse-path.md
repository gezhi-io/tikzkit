# `decorations.text`: Ordered Postactions And `reverse path` QA

## Scope

This slice implements one bounded PGF behavior family:

- repeated `/tikz/postaction` options are retained in source order;
- each postaction reuses the original path for `text along path`;
- `text color` belongs to the individual decoration; and
- `reverse path` reverses path sampling without reversing character order.

The real driver is
`test/fixtures/examples/decorations/text-reverse-path.tex`. It is the local
PGF manual's two-postaction curve example with an added grid and explicit
raise, so color, placement, tangent direction, and path direction are all
visible in one figure.

## Local MacTeX Reading

Reviewed locally on 2026-08-07:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-actions.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.text.code.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex`

`tikz.code.tex` appends every `postaction` to `\tikz@postactions` and runs
each entry inside its own scope after restoring the source path. The actions
manual states explicitly that multiple postactions reuse the path several
times, each with its own options. The decorations manual specifies that text
color defaults to black and that `reverse path` reverses the path, which is
particularly useful for text on opposite sides of a curve. It documents this
same red/blue example.

## References And Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. All tools completed without external errors.
The generated but intentionally untracked artifacts are in:

`/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-decorations-text-postactions-reverse-path-2026-08-07/`

Key files:

- `mactex-png/decorations-text-reverse-path.png`
- `tikzkit-svg/decorations-text-reverse-path.svg` and `tikzkit-png/...`
- `tikztosvg-svg/decorations-text-reverse-path.svg` and `tikztosvg-png/...`
- `diff/decorations-text-reverse-path-native-sheet.png`
- `diff/decorations-text-reverse-path-sheet.png`
- `diff-png/decorations-text-reverse-path-registered.png`

The `tikztosvg` SVG represents the TeX text as path glyph definitions and
`<use>` transforms; it therefore carries no browser `<text>` baseline or
anchor semantics to copy directly. Its two independent glyph groups, however,
visibly establish the required source-order decoration layering. TikZKit emits
two `.tikz-decoration-text` groups of tangent-rotated `<text>` glyphs. The
forward red glyphs traverse from the right end of the curve and the reversed
blue glyphs traverse from the left end; each group keeps its own fill color.

## Visual Result

Before this change, TikZKit treated `postaction` as a last-value option. The
reference panels contained both colored text runs, while the JavaScript panel
only contained the final gray/blue decoration and did not preserve the other
action. The visual mismatch was a missing entire text run, not merely a pixel
or anti-aliasing difference.

After the change, the native four-panel sheet shows both text runs in the
TikZKit panel: blue text starts at the visual left side and red text starts at
the visual right side, with matching colors, curve locations, and opposite
tangent direction. The TikZKit/tikztosvg sheet has the same two-run geometry.
The registered PNG diff now isolates glyph-rasterization differences; it no
longer shows a missing decoration. TikZKit versus MacTeX still has a 9.96%
changed-pixel ratio because both TikZKit and tikztosvg use different text
rasterization pipelines than native PDF text, not because of a missing path or
wrong coordinates.

## Implementation And Verification

Changed:

- `src/engine/options.js`: marks `postaction` repeatable.
- `src/engine/evaluate.js`: resolves every postaction in source order, creates
  a text-decoration IR item per decoration, and keeps per-decoration color and
  reverse-path semantics. Marking decorations use the same repeatable option
  handling.
- `src/renderers/svg/decorationText.js`: reverses the flattened sampled path
  before placing glyphs when `reverse path` is set.
- `test/interpreter.test.js` and `test/svg-renderer.test.js`: targeted semantic
  and SVG regressions.
- fixture manifest and source: visual regression driver.

Verified with:

```sh
node --test --test-name-pattern='runs repeated decorations.text postactions|reverses the sampled decorations.text path' \
  test/interpreter.test.js test/svg-renderer.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-decorations-text-postactions-reverse-path-2026-08-07 \
  --only decorations-text-reverse-path \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-decorations-text-postactions-reverse-path-2026-08-07 \
  --register --alignment-radius 3
```

Focused tests passed, all three renderers generated their artifacts, and the
fixture produced no TikZKit diagnostics.

## Remaining Limits

`decorations.text` remains partial: arbitrary postaction TeX code,
character-specific style callbacks, nested rich TeX grouping, exact TeX box
metrics, and scale/fit text-effect combinations are not complete. A sensible
next slice is `text effects` character style callbacks, only after another
manual example reveals a visible shared discrepancy.
