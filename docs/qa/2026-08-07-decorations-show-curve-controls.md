# `decorations.pathreplacing`: named postaction curve controls QA

## Scope

This slice implements the documented `show path construction` use through a
named `postaction` style. It covers one cubic curve, its two support
segments, and empty `cross out` control markers. It does not claim arbitrary
TeX callback bodies or the general low-level PGF decoration API.

The real driver is
`decorations-pathreplacing-show-curve-controls`, copied from the TeX Live
PGF manual's `show curve controls` example:

```tex
\tikzset{
  show curve controls/.style={
    decoration={
      show path construction,
      curveto code={
        \draw [blue, dashed]
          (\tikzinputsegmentfirst) -- (\tikzinputsegmentsupporta)
          node [at end, cross out, draw, solid, red, inner sep=2pt]{};
        \draw [blue, dashed]
          (\tikzinputsegmentsupportb) -- (\tikzinputsegmentlast)
          node [at start, cross out, draw, solid, red, inner sep=2pt]{};
      }
    },decorate
  }
}
\draw [postaction=show curve controls, thick]
  (0,2) .. controls (2.5,1.5) and (0.5,0.5) .. (3,0);
```

## Local MacTeX Study

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.pathreplacing.code.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex`, lines 513-589
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.misc.code.tex`, the `cross out` declaration

The decoration source invokes each callback with the original segment's first,
last, and control coordinates. The `cross out` shape inherits the rectangle
southwest/northeast anchors and draws two diagonals; it therefore uses the
empty node's actual inner/minimum box, plus outer separation, rather than a
text line box.

TikZKit now resolves a named `postaction=style` before evaluating the
callback, keeps the original foreground path, disables the decoration
transform for the injected coordinates, and inherits outer paint options
without re-running decoration, registration, or bounding-box behavior.

## Three-Way Visual QA

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; the renderer used
`/opt/homebrew/bin/rsvg-convert` for PNG conversion. MacTeX native, TikZKit,
and tikztosvg artifacts are retained at:

`/private/tmp/tikzkit-qa-show-curve-controls-final-2026-08-07/`

- MacTeX native PNG: `mactex-png/decorations-pathreplacing-show-curve-controls.png`
- TikZKit SVG/PNG: `tikzkit-svg/` and `tikzkit-png/`
- tikztosvg SVG/PNG: `tikztosvg-svg/` and `tikztosvg-png/`
- 1cm grids and four-panel comparison:
  `tikzkit-grid-png/`, `tikztosvg-grid-png/`, and
  `diff/decorations-pathreplacing-show-curve-controls-native-sheet.png`

I inspected all three images and the four-panel sheet. Before this change,
TikZKit drew only the black source Bezier. After it, all renderers show the
black source curve, two blue dashed support lines, and two red control crosses.
The original source `thick` paint state now reaches both callback paths and
markers. The former TikZKit markers were a tall text-line box; they are now
square and sized from `inner sep=2pt`.

The tikztosvg SVG uses five no-fill paths: one cubic source path, two
butt-capped dashed blue lines, and two red two-diagonal paths, under its y-flip
transform. TikZKit emits the same five-path topology with butt caps and miter
joins. The remaining difference is a 120x82px TikZKit crop versus a 115x77px
tikztosvg crop and normal browser antialiasing; no elements, markers, or
source curve are missing.

## Verification

```sh
node --test --test-name-pattern='show path construction|shapes.misc' test/interpreter.test.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/examples --output /private/tmp/tikzkit-qa-show-curve-controls-final-2026-08-07 --only decorations-pathreplacing-show-curve-controls --native-reference --strict-tikztosvg
node scripts/diff-example-pngs.js --output /private/tmp/tikzkit-qa-show-curve-controls-final-2026-08-07
```

All focused tests and all three artifact generators pass with no diagnostics.

## Remaining Work

Arbitrary callback macros, direct low-level PGF point expressions, callback
scopes, and general postaction/preaction composition remain partial. Exact
canvas cropping and subpixel antialiasing are separate renderer-calibration
work.
