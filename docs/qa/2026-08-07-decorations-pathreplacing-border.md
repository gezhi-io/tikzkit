# `decorations.pathreplacing`: `border` QA

## Scope

This slice implements the PGF `border` path-replacing decoration and the
common `postaction={decorate,draw,...}` layering form used by its manual
example. It covers `segment length`, `amplitude`, `angle`, and local tangent
orientation over a mixed line/arc subpath. It does not claim `waves`,
`expanding waves`, or arbitrary postaction code.

The real driver is Case 312, copied from the local PGF manual:

```tex
\begin{tikzpicture}[decoration=border]
  \draw [help lines] grid (3,2);
  \draw [postaction={decorate,draw,red}]
        (0,0) -- (3,1) arc (0:180:1.5 and 1);
\end{tikzpicture}
```

## Local PGF Study

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.pathreplacing.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduledecorations.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.pathreplacing.code.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex`, `border` section

The PGF `tick` state has width `+segment length`, starts a new subpath at its
local origin, then draws to `polar(angle, amplitude)`. Its `switch if less
than` enters the final state at the last full state origin, so an incomplete
tail is not moved to the raw endpoint. Defaults come from the shared
decoration module: 10pt segment length, 2.5pt amplitude, and 45 degrees.

The manual's postaction deliberately does not repeat `decoration=border`:
the nested option only says `decorate,draw,red`; the decoration inherits from
the enclosing path/picture. TikZKit now performs that same lookup, renders
the ordinary black foreground path first, then appends a separate red
decoration scene item. It only does this for decorations already implemented
by the shared path-decoration evaluator, avoiding a duplicate raw path for
unsupported decoration names.

## Three-Way Visual QA

`tikztosvg` is available at `/Library/TeX/texbin/tikztosvg`; the fixture
renderer used `rsvg-convert` to make PNGs. Artifacts are in:

`/private/tmp/tikzkit-qa-pathreplacing-border-after-2026-08-07/`

- TikZKit: `tikzkit-svg/`, `tikzkit-png/`, and `tikzkit-grid-png/`
- tikztosvg: `tikztosvg-svg/`, `tikztosvg-png/`, and `tikztosvg-grid-png/`
- MacTeX native PNG: `mactex-png/`
- four-panel visual sheet: `diff/decorations-pathreplacing-border-native-sheet.png`

I inspected all three renderers and the native sheet. Before the change the
postaction was ignored: only the black source line/arc appeared. After it,
the black diagonal and half ellipse remain while a red one-sided border is
painted above it. The red slashes rotate continuously around the ellipse,
instead of retaining the diagonal's tangent. tikztosvg's SVG has 21 red
`M ... L` subpaths with no fill, butt caps, and a standard y-flip transform;
TikZKit's SVG has the same 21 independent subpaths and source/postaction
paint order.

Registered TikZKit/tikztosvg mean absolute RGBA residual is `0.01341`;
TikZKit/MacTeX is `0.02843`. Remaining visible differences are the browser
renderer's roughly 5px crop reserve plus grid/stroke antialiasing. The
decorated geometry and layer order are present in all three panels.

## Verification

```sh
node --test --test-name-pattern='border decoration|normal ticks|brace decoration' test/interpreter.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-pathreplacing-border-after-2026-08-07 \
  --only decorations-pathreplacing-border --native-reference \
  --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output /private/tmp/tikzkit-qa-pathreplacing-border-after-2026-08-07 \
  --register --alignment-radius 3
```

The focused regression passes; JS SVG/PNG, tikztosvg SVG/PNG, and MacTeX PNG
all generate without diagnostics.

## Remaining Work

The current supported-postaction seam handles path-replacing/morphing
decorations already modeled by the evaluator. It does not execute arbitrary
TikZ postaction code, and the unimplemented path-replacing decorations remain
out of scope.
