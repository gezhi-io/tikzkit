# `decorations.text`: `repeat text` QA

> Superseded for boundary-space and terminal-state semantics by
> `docs/qa/2026-09-06-decorations-text-repeat-state-machine.md`. In particular,
> pgfkeys trims a soft trailing value space; an explicit `\ ` is required.

## Scope

This pass implements one PGF text-effects slice only: `repeat text` for
`text effects along path`. It supports the documented forms below without a
fixture-specific layout shortcut:

- `repeat text`: repeat the source boxes until the remaining path cannot hold
  the next complete box;
- `repeat text=N`: paint the first source copy plus `N` complete additional
  copies;
- explicit terminal whitespace in `text={...}`: retain it as the gap before
  the next source copy.

The permanent driver is
`test/fixtures/examples/decorations/text-repeat.tex` (Case 314):

```tex
\path[decorate,decoration={text effects along path,text={AB },raise=2pt,
  text effects/.cd,repeat text}] (0,2) -- (8,2);
\path[decorate,decoration={text effects along path,text={WXY},raise=2pt,
  text effects/.cd,repeat text=1}] (0,.5) -- (8,.5);
```

## Local MacTeX Study

Reviewed local TeX Live 2025 files:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.text.code.tex`, lines 143-148 and 650-681.
  The key is stored with default `-1` for its bare form and initialized to
  `0`. In the `scan` state PGF increments the character count; once it passes
  the source count, zero enters `final`, otherwise the count is reset to `1`
  and the remaining repeat count is decremented.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex`, lines 2043-2065.
  The manual defines a positive value as a number of repeats, says that the
  bare key runs until the path ends, and explicitly warns that alignment,
  scaling, and fitting combinations are undefined.

TikZKit preserves the raw `text={...}` value long enough to retain a terminal
space, stores `pathTextRepeat` on the renderer-neutral decoration text item,
and restarts the same glyph sequence only while its next advance fits inside
the flattened path. It does not alter ordinary non-repeating `text along path`
placement.

## Three-Way Artifacts

`tikztosvg` was available at `/Library/TeX/texbin/tikztosvg`; local
`rsvg-convert` generated its PNG. MacTeX supplied the native PNG. The complete
after bundle is:

`/private/tmp/tikzkit-qa-decorations-text-repeat-after-2026-08-07/`

- TikZKit: `tikzkit-svg/`, `tikzkit-png/`, `tikzkit-grid-png/`
- tikztosvg: `tikztosvg-svg/`, `tikztosvg-png/`, `tikztosvg-grid-png/`
- native: `mactex-png/decorations-text-repeat.png`
- panels: `diff/decorations-text-repeat-native-sheet.png` and
  `diff-png/decorations-text-repeat-registered.png`

I inspected all four views. The prior interpreter had no repeat metadata, so
the source text was emitted once and the rest of the first guide remained
empty. The completed panel fills the first guide with repeated `AB ` boxes and
shows exactly two `WXY` copies on the finite-repeat guide. During QA the first
implementation still consumed the terminal source space; retaining the raw
braced text corrected the visibly compressed first line.

The TikZKit SVG uses positioned `<text>` glyphs with a 35.14598-unit font and
per-glyph rotation; tikztosvg outlines Computer Modern glyphs as `<path>`
definitions and draws them through translated `<use>` instances. Their
different SVG text structures and font rasterization account for residual
letter-edge differences. The post-change registered TikZKit/tikztosvg residual
is 10.88% changed pixels and 0.02586 mean absolute RGBA; these values are only
locators. The meaningful visual checks are filled first-line coverage, the
single terminal partial-box cutoff, and the exact two-copy second line.

## Commands, Options, And Numbers Audited

- `\documentclass[border=2pt]`, `\usepackage{tikz}`,
  `\usetikzlibrary{decorations.text}`
- `\begin{tikzpicture}`, `\draw`, `\path`, `decorate`, `help lines`,
  `gray`, `dashed`
- `decoration={text effects along path,...}`, `text={AB }`, `text={WXY}`,
  `raise=2pt`, `text effects/.cd`, `repeat text`, `repeat text=1`
- all guide/path values: `-0.5`, `0`, `0.5`, `2`, `2.5`, and `8`

## Verification

```sh
node --test --test-name-pattern='repeat text cycle semantics|repeats decorations\\.text source glyphs' \
  test/interpreter.test.js test/svg-renderer.test.js
npm run case:audit -- test/fixtures/examples/decorations/text-repeat.tex \
  --review docs/qa/2026-08-07-decorations-text-repeat-review.json --strict
npm run examples:render -- --fixtures test/fixtures/examples \
  --only decorations-text-repeat \
  --output /private/tmp/tikzkit-qa-decorations-text-repeat-after-2026-08-07 \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output /private/tmp/tikzkit-qa-decorations-text-repeat-after-2026-08-07 \
  --register --alignment-radius 3
```

## Remaining Work

`group letters`, character-count callbacks, arbitrary character styles and
replacement TikZ snippets need a decoration-local TeX/TikZ callback model.
Exact TeX box metrics, nested/general TeX groups, and scale/fit text effects
remain partial. Per the native manual, repeat combined with scaling/fitting is
intentionally not treated as a compatibility promise.
