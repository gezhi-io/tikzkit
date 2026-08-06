# PGF Decorations Text Character Replacement QA

## Scope

This pass implements one `decorations.text` slice: repeated
`replace characters=<characters> with {<circle payload>}` registrations. It
covers the documented `\fill`, `\draw`, and `\path` circle payloads with
radius and paint options. It does not claim arbitrary replacement TikZ code,
per-character styles, repeat text, or generic text-effect callbacks.

Driver: `test/fixtures/examples/decorations/text-replace-characters.tex`.

```tex
\path[decorate, decoration={text effects along path,
  text={000-001-010-011-100-101-110-111}, text align=center,
  text effects/.cd,
  word separator=-,
  replace characters=0 with {\fill[purple] circle[radius=2pt];},
  replace characters=1 with {\fill[orange] circle[radius=2pt];},
  replace characters=- with {\path circle[radius=2pt];}}]
  (0,0) .. controls ++(2,0) and ++(-2,0) .. (3,4);
```

## Local MacTeX Review

Reviewed local TeX Live 2025 sources:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.text.code.tex`, around lines 143 and 697. `replace characters` registers each scanned character independently, so repeated key occurrences must not collapse to one option value.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex`, around line 1642. The manual's text-effects example uses separate purple `0`, orange `1`, and a `\path` replacement for `-`.

TikZKit retains the raw decoration option while parsing it, scans all top-level
replacement entries, creates a character-to-circle map in the scene item, and
lets the SVG renderer emit those circles at glyph placement points. It does
not add a special case for the fixture characters.

## Reference Artifacts

`tikztosvg` was available at `/Library/TeX/texbin/tikztosvg`; PNG conversion
used `/opt/homebrew/bin/rsvg-convert`; MacTeX supplied the native PNG.

The after bundle is
`/private/tmp/tikzkit-qa-decorations-text-replace-after-2026-08-07/`:

- `mactex-png/decorations-text-replace-characters.png`
- `tikzkit-svg/`, `tikzkit-png/`, and `tikzkit-grid-png/`
- `tikztosvg-svg/`, `tikztosvg-png/`, and `tikztosvg-grid-png/`
- `diff/decorations-text-replace-characters-native-sheet.png`
- `diff-png/decorations-text-replace-characters-registered.png`

The earlier comparison was retained at
`/private/tmp/tikzkit-qa-decorations-text-replace-2026-08-07/`.

`tikztosvg` emits the decoration as positioned graphical elements rather than
ordinary text, with its own transformed SVG canvas. MacTeX and tikztosvg both
show purple and orange disks following the curve.

## Visual Result

Before the change, TikZKit displayed literal black `0`, `1`, and `-` glyphs
along the curve, so the source's encoded visual sequence was missing. After
the change, the TikZKit panel visibly contains the same colored disks and
invisible `\path` circle replacement as the native/tikztosvg panels; no
literal replacement characters remain in its SVG text.

The post-change native comparison reports `4.81%` changed pixels and mean
absolute RGBA difference `0.01213`. Those numbers are supporting evidence
only: the panels were inspected directly. Residual differences are in text
metrics, curve flattening, antialiasing, and SVG canvas bounds; they are not
replacement-semantics failures. `tikztosvg` also has its own native raster and
bbox offset, so MacTeX remains the oracle.

## Commands, Options, And Numbers Audited

- `\usetikzlibrary{decorations.text}`
- `\path`, `decorate`, `decoration={...}`, `text effects/.cd`
- `text effects along path`, `text={000-001-010-011-100-101-110-111}`, `text align=center`, `word separator=-`
- all three repeated `replace characters` mappings
- `\fill`, `\draw`, `\path`, `circle`, `radius=1pt/2pt/3pt`
- curve coordinates `(0,0)`, control offsets `++(2,0)`/`++(-2,0)`, and `(3,4)`

## Verification

```sh
node --test --test-name-pattern='repeated decorations\.text' test/interpreter.test.js

npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-decorations-text-replace-after-2026-08-07 \
  --only decorations-text-replace-characters --native-reference \
  --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output /private/tmp/tikzkit-qa-decorations-text-replace-after-2026-08-07 \\
  --register --alignment-radius 3
```

The focused regression passes. The rendering command produced one each of
TikZKit SVG/PNG, tikztosvg SVG/PNG, and MacTeX PNG with zero external
failures. The full interpreter suite still has pre-existing unrelated
failures, so it is not used as this slice's acceptance signal.

## Remaining Work

Arbitrary replacement snippets can contain paths, nodes, styles, grouping,
and TeX expansion. Supporting them needs a nested decoration-local command
interpreter and is deliberately outside this circle-only visual correction.
