# Decorations Text Replacement Spacing QA

## Scope

This pass fixes one `decorations.text` visual regression: circle payloads from
`replace characters=<tokens> with {...}` now advance by the replacement
picture's own width. The supported payload vocabulary remains the focused
`\fill`, `\draw`, or `\path` circle form already parsed by TikZKit.

The real driver is `decorations-text-replace-characters`. Before this change,
ordinary text-node padding was added to every replacement and the replaced
digit's glyph width was retained. Center alignment consequently put much of
the sequence outside the path, collapsing multiple circles onto both ends.

## Local MacTeX Review

Reviewed TeX Live 2025 files:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.text.code.tex`, especially `\tikz@lib@dec@te@getcharacterwidth`, `\tikz@lib@dec@te@getcharacter@replacementwidth`, and the scan/pre-token/token/post-token states. PGF measures a replacement inside a standalone `pgfpicture`, stores half of that width as both prewidth and postwidth, and does not reuse the original character's text-node width.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex`, the `text effects along path` and `replace characters` example. Ordinary characters are TikZ nodes, while replacement snippets are direct TikZ drawing code.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.text.code.tex`, for the base text-decoration state machine shared by the frontend library.

TikZKit now assigns a supported circle replacement an advance of twice its
radius and excludes replacements from the ordinary `.3333em` character-node
padding. Unreplaced characters retain their existing node padding.

## Visual Evidence

Before artifacts:

`outputs/qa/2026-09-06-decorations-text-replacement-before/`

After artifacts:

`outputs/qa/2026-09-06-decorations-text-replacement-after/`

Combination artifacts:

`outputs/qa/2026-09-06-decorations-text-replacement-combinations/`

Each after bundle contains TikZKit SVG/PNG, tikztosvg SVG/PNG, MacTeX PNG,
grid variants, and diff/native sheets. `tikztosvg` was found at
`/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`.

The native and tikztosvg panels show the same complete purple/orange sequence
along the S curve. Before the fix, TikZKit showed only nine distinct visible
locations and stacked the other circles at the endpoints. After the fix, all
31 replacement boxes occupy distinct path positions, the 24 painted digit
circles span the curve, the seven invisible separator circles still consume
their native widths, and the color order matches both references. Remaining
differences are small raster/bbox offsets rather than missing geometry.

The combination sheet also covers grouped words, repeated text, and fit/scale
text effects. This change does not alter their ordinary character spacing.
The repeated-text fixture still has a separate, visible spacing discrepancy
and is the next recommended slice.

## Commands And Options Audited

- `\usetikzlibrary{decorations.text}`
- `\path`, `decorate`, cubic `.. controls ..`
- `decoration={text effects along path,...}`
- `text`, `text align=center`, `text effects/.cd`, `word separator=-`
- repeated `replace characters=... with {...}` entries
- replacement `\fill`, `\draw`, `\path`, `circle`, and `radius`
- ordinary text-effects node padding next to replacement graphics

## Verification

```sh
node --test --test-name-pattern='decorations\.text|decoration text' \
  test/interpreter.test.js test/svg-renderer.test.js

node scripts/render-example-fixtures.js \
  --output outputs/qa/2026-09-06-decorations-text-replacement-combinations \
  --only decorations-text-replace-characters \
  --only decorations-text-group-words \
  --only decorations-text-repeat \
  --only decorations-text-effects-fit-scale \
  --preserve-output --native-reference --continue-on-external-failure \
  --tikztosvg-engine pdflatex --math-renderer svg-text \
  --comparison-grid-mode svg

node scripts/diff-example-pngs.js \
  --output outputs/qa/2026-09-06-decorations-text-replacement-combinations \
  --register --alignment-radius 3

node --test
```

All 21 focused tests pass. All four combination cases render through
TikZKit, tikztosvg, and MacTeX with zero diagnostics and zero external
failures. The full suite contains 2,496 tests: 2,346 pass, 136 unchanged
known failures, and 14 are skipped. The three tests added by this slice all
pass; the failure count is unchanged from the 2,493-test baseline.
