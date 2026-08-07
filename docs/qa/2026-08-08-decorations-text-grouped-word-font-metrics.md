# decorations.text grouped-word font metrics

## Scope

This slice covers `decorations.text` `text effects along path` with
`group letters`, `group letters into words`, and a custom `word separator`.
The real fixture is `test/fixtures/examples/decorations/text-group-words.tex`.
The boundary is font selection and advance consistency for ordinary grouped
text; it does not attempt arbitrary character styles, replacement TikZ code,
or rich/math grouping.

## Local implementation reading

Reviewed the local TeX Live 2025 implementation:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.text.code.tex`
  - `group letters into words` and `group letters` both append
    `\\tikz@lib@dec@te@groupletters`.
  - The grouping macro collects every token until `word separator` into one
    character token, then `\\tikz@lib@dec@te@getcharacterwidth` measures the
    resulting node box before alignment is applied.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex`
  - confirms that text effects operate on positionable character boxes, and
    that words are those boxes after the grouping transform.

The key consequence is that a default 10pt grouped word must be painted with
the same CMR design face used by the advance measurement. Before this change,
TikZKit measured CMR widths but painted `CMU Serif` for decoration text.

## Third-party and native references

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; it generated SVG
with outline glyph paths, clip paths, and a point-based viewBox. It uses an
`xelatex` pipeline in this run. MacTeX native PNG was produced with `pdflatex`.

Artifacts:

- Before: `outputs/qa-decorations-text-group-words-before-2026-08-08/`
- After: `outputs/qa-decorations-text-group-words-after-2026-08-08/`
- Three-way native sheet: `outputs/qa-decorations-text-group-words-after-2026-08-08/diff/decorations-text-group-words-native-sheet.png`
- TikZKit SVG: `outputs/qa-decorations-text-group-words-after-2026-08-08/tikzkit-svg/decorations-text-group-words.svg`
- tikztosvg SVG: `outputs/qa-decorations-text-group-words-after-2026-08-08/tikztosvg-svg/decorations-text-group-words.svg`
- MacTeX PNG: `outputs/qa-decorations-text-group-words-after-2026-08-08/mactex-png/decorations-text-group-words.png`

## Visual result

Before, TikZKit used CMU Serif shapes while retaining CMR-based advances: the
top curved `group words here` run and lower `left-right` run looked wider and
visually detached from their intended CMR positions. After, the JS SVG emits
`TikZKitCMR10` for the grouped words and separator. On the native sheet, the
word extents, central spacing, and curve tangency now visually align with the
MacTeX CMR reference. The grid origin and path geometry were unchanged.

tikztosvg remains a useful structural reference, but its XeLaTeX font pipeline
and outline conversion produce different raster edges and somewhat different
word spacing; MacTeX native remains the acceptance reference.

## Implemented surface

| TikZ input | Status |
| --- | --- |
| `decoration={text effects along path,text=...}` | Implemented |
| `text effects/.cd,group letters` | Implemented as word-sized tangent boxes |
| `group letters into words` | Implemented alias |
| `word separator=-` | Implemented; separator stays its own box |
| `text align=center`, `raise=...` | Implemented and retained |
| default serif 10pt grouped text | Implemented with resolved `TikZKitCMR10` |
| arbitrary per-character/word styles, rich/math/replacement mixed words | Partial / not accepted in this slice |

## Verification

Passed:

```text
node --test --test-name-pattern='retains ordered decorations.text word grouping effects and separators|uses the resolved CMR design face for grouped decorations.text words' test/interpreter.test.js
npm run examples:render -- --fixtures test/fixtures/examples --only decorations-text-group-words --output outputs/qa-decorations-text-group-words-after-2026-08-08 --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-decorations-text-group-words-after-2026-08-08
```

The full `test/interpreter.test.js` and `test/svg-renderer.test.js` still have
pre-existing unrelated failures in color normalization, geometry expectations,
and one 0.4pt external-renderer bbox tolerance; the focused grouping tests
pass and this slice adds no diagnostics.

## Next slice

Extend the same measured-font rule to mixed inline-math/rich-text decoration
groups, then verify `every word`, `every letter`, and character replacement
styles against the local `decorations.text` state machine.
