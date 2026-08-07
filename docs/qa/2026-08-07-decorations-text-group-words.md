# `decorations.text`: grouped words QA

## Scope

This pass implements one PGF text-effects slice: simple plain-text word
grouping for `text effects along path`. It supports:

- `group letters` and the documented `group letters into words` alias;
- `word separator=space` (the default) and a single custom separator such as
  `word separator=-`;
- source-order composition with `reverse text`.

The permanent driver is
`test/fixtures/examples/decorations/text-group-words.tex` (Case 315). It
places `group words here` and `left-right` on curved guides, with a one-centimetre
grid for registration.

## Local MacTeX Study

Reviewed TeX Live 2025's
`/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.text.code.tex`:

- lines 118-142 define `word separator`, `reverse text`, `group letters`, and
  `group letters into words`;
- from line 310, `\\tikz@lib@dec@te@groupletters` consumes consecutive
  non-separator character tokens into one decoration character, flushes at a
  separator, and preserves the separator itself;
- the keys append transforms in declaration order, rather than imposing a
  fixed reverse-then-group order.

The matching manual sections are lines 1744-1748 and 2004-2041 of
`/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex`.
They document the default space separator and explicitly note that reversing
before grouping differs from grouping before reversing.

TikZKit retains the ordered transform list on its renderer-neutral decoration
item. The SVG renderer applies it before path sampling: a plain run becomes one
word box whose advance is the sum of its glyph advances; separators and rich
boxes remain independent. This keeps the renderer boundary intact rather than
introducing a fixture-specific SVG shortcut.

## Three-Way Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; `/opt/homebrew/bin/rsvg-convert`
produced its PNG. The inspected after bundle is:

`/private/tmp/tikzkit-qa-decorations-text-group-after-2026-08-07/`

- TikZKit SVG/PNG/grid: `tikzkit-svg/`, `tikzkit-png/`,
  `tikzkit-grid-png/`;
- tikztosvg SVG/PNG/grid: `tikztosvg-svg/`, `tikztosvg-png/`,
  `tikztosvg-grid-png/`;
- MacTeX native PNG: `mactex-png/decorations-text-group-words.png`;
- four-view and registered-diff panels: `diff/` and `diff-png/`.

Before the fix TikZKit emitted 24 independently rotated glyph boxes, so each
word visibly bent along the guide. After the fix its SVG contains five
`tikz-decoration-word` boxes plus one standalone dash separator: the letters
inside each word share a single tangent angle, matching the visible native and
tikztosvg grouping. tikztosvg uses a transformed group of Computer Modern
glyph `<use>` elements while TikZKit uses one SVG `<text>` per supported word;
the paint structure differs but the layout rule is the same.

The registered post-change TikZKit/tikztosvg image residual is 8.47012% changed
pixels with 0.00981325 mean absolute RGBA; the pre-change residual was 8.46795%
and 0.00973936. Those nearly unchanged raster numbers are expected because
both images contain the same guide and text area, and are not acceptance
criteria. The visible acceptance change is per-character bending becoming
whole-word tangent alignment in the three inspected references.

## Commands, Options, And Numbers Audited

- `\documentclass[border=2pt]`, `\usepackage{tikz}`,
  `\usetikzlibrary{decorations.text}`;
- `\begin{tikzpicture}`, `\draw`, `\path`, `decorate`, `help lines`;
- `text effects along path`, `text`, `text align=center`, `raise=2pt`,
  `raise=-2pt`, `text effects/.cd`, both grouping names, and `word separator`;
- picture `x=1cm`, `y=1cm`, grid step `1cm`, the guide/control coordinates,
  and all signed raise values.

## Verification

```sh
node --test --test-name-pattern='word grouping|groups decorations\\.text words|repeat text cycle semantics|repeats decorations\\.text|reverses decorations\\.text' \
  test/interpreter.test.js test/svg-renderer.test.js
npm run case:audit -- test/fixtures/examples/decorations/text-group-words.tex \
  --review docs/qa/2026-08-07-decorations-text-group-words-review.json --strict
npm run examples:render -- --only decorations-text-group-words \
  --output /private/tmp/tikzkit-qa-decorations-text-group-after-2026-08-07 \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output /private/tmp/tikzkit-qa-decorations-text-group-after-2026-08-07 \
  --register --alignment-radius 3
```

## Remaining Work

Character-specific styles, arbitrary replacement TikZ, callback characters,
and word grouping across inline math, rich formatting, or replacement boxes
still require a decoration-local TeX box model. Exact TeX word metrics and
all scale/fit interactions remain partial.
