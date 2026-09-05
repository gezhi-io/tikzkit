# Decorations Text Character Node Styles

## Scope

This severe-gap slice covers the node-box semantics of TikZ
`decorations.text` when using `text effects along path`. The real driver is
`decorations-text-group-words`. Before this change, TikZKit compressed its
grouped words into one nearly continuous string and rotated every word along
the path. Native TikZ instead creates ordinary padded nodes unless the caller
explicitly requests `text along path` for the characters.

The accepted boundary includes default character nodes, `group letters`,
`group letters into words`, custom one-character word separators,
`characters={text along path}`, `characters/.append={text along path}`,
`every character/.style={text along path}`, and the outer
`text effects={text along path}` shorthand. Character-specific styles,
arbitrary node shapes, and exact vertical metrics for general TeX/math boxes
remain partial.

## Local TeX Reading

Reviewed
`/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.text.code.tex`
around lines 88-145, 322-364, and 650-679. The source defines `characters` as
the `every character` style, groups non-separator sequences before measuring
them, and measures each resulting character by constructing a TikZ node. Its
`text along path` style sets `inner xsep=0pt`, `anchor=base`, and
`transform shape`.

Reviewed
`/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduleshapes.code.tex`
around lines 880-890. Ordinary PGF nodes default to `inner xsep=.3333em`.

Reviewed
`/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex`
around lines 1575-1705 and 2004-2041. The manual states that text-effects
characters are TikZ nodes, that `every character` is initially empty, and
that following the path is an explicit style rather than the default.

## Visual References

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`. MacTeX used
`/Library/TeX/texbin/pdflatex`, and SVG rasterization used
`/opt/homebrew/bin/rsvg-convert`. The complete artifacts are in:

- `outputs/qa/2026-09-06-decorations-text-character-node-styles-after/`
- `tikzkit-svg/decorations-text-group-words.svg`
- `tikzkit-png/decorations-text-group-words.png`
- `tikztosvg-svg/decorations-text-group-words.svg`
- `tikztosvg-png/decorations-text-group-words.png`
- `mactex-png/decorations-text-group-words.png`
- `diff/decorations-text-group-words-native-sheet.png`
- `diff/decorations-text-group-words-sheet.png`

The tikztosvg SVG paints curves with butt caps and miter joins. Its grouped
words are unrotated glyph-path `<use>` clusters at independent node
coordinates, with the gaps implied by the measured padded boxes. TikZKit keeps
selectable SVG `<text>`, but now samples the same padded box centers and leaves
ordinary nodes horizontal.

Before the fix, `group words here` and `left-right` were visibly compressed
and tangent-rotated. After the fix, all five word groups have the same
horizontal orientation, spacing, and baseline placement as MacTeX and
tikztosvg. The explicit `text along path` fit/scale control still rotates each
character along the curve, and the reverse-path control retains its direction,
color, and tangent orientation. Remaining pixels are browser-versus-Type-1
glyph rasterization and minor antialiasing differences.

## Implementation And Verification

- `src/engine/evaluate.js` records whether character nodes follow the path,
  their effective horizontal padding, and their anchor contract.
- `src/renderers/svg/decorationText.js` pads final grouped node boxes, samples
  their centers, applies ordinary-node baseline placement, and rotates only
  explicit path-following nodes.
- `test/interpreter.test.js` and `test/svg-renderer.test.js` cover the minimal
  semantic split, two style combinations, retained legacy behavior, and the
  real grouped-word fixture.

The focused decorations-text suite passes 17/17. The full suite reports 2487
tests, 2337 passes, 136 pre-existing failures, and 14 skips; the failure and
skip counts are unchanged from the 2484-test baseline. All three rendered
cases completed through TikZKit, tikztosvg, and MacTeX with zero diagnostics
or external failures.
