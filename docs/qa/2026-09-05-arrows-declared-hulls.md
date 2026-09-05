# Declared arrow hull and clip QA

## Scope

This round implements the picture-bound semantics of `\pgfarrowshullpoint` and
`\pgfarrowsupperhullpoint` for legacy user-declared arrows. It also implements
the documented rule that a TikZ path carrying the `clip` action draws no arrow
tips and receives no arrow endpoint shortening.

Harpoon-specific one-sided hulls, modern `\pgfdeclarearrow` declarations,
arbitrary TeX branches, saved-register callbacks, and complete clip-region
rendering remain outside this slice.

## Local source review

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex`
  - Explicit hull points are recorded during setup and transformed only for
    picture bounds.
  - A positive `\pgfarrowsupperhullpoint` y coordinate is mirrored unless the
    arrow is a harpoon.
  - Reversal maps every hull point from `(x,y)` to `(-x,y)`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorepathusage.code.tex`
  - The clip branch bypasses arrow setup, shortening, paint, and inner stroke.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-base-arrows.tex`
  - Hull arguments are dimensions and may contain code that advances
    `\pgf@x` or `\pgf@y` after the initial value.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-arrows.tex`
  - TikZ explicitly documents that `clip` paths have no arrow tips.

## Visual driver

`arrows-declared-hull-control-network` combines active line widths, an explicit
asymmetric hull, a symmetric upper hull, inline dimension advances, aliases,
reversal, straight arrows, and an orthogonal bidirectional feedback path.

Before the fix, the upper wing of the top telemetry arrow exceeded the SVG
viewBox and was clipped. After the fix, the viewBox expands from a top edge of
`-257.029196` to `-271.228172`, preserving the complete declared hull. The
visible layout and all five arrow tips remain otherwise unchanged. Diagnostics
stay at zero.

The native and tikztosvg SVGs both paint the declared arrow as a separate
filled-and-stroked path with a round join and an endpoint transform. TikZKit
uses the same structure. The remaining total-height difference comes from
text and node vertical metrics, not the hull algorithm.

## Artifacts

- Before: `outputs/qa/2026-09-05-arrows-declared-hulls-before/`
- After: `outputs/qa/2026-09-05-arrows-declared-hulls-after/`
- TikZKit SVG/PNG: `tikzkit-svg/`, `tikzkit-png/`
- tikztosvg SVG/PNG/input: `tikztosvg-svg/`, `tikztosvg-png/`, `tikztosvg-input/`
- MacTeX PNG/log: `mactex-png/`, `mactex-log/`
- Four-panel native/tikztosvg/TikZKit/diff sheet: `diff/arrows-declared-hull-control-network-native-sheet.png`

## Verification

```sh
node --test test/arrows-declared-hulls.test.js
node --test test/arrows-declared-*.test.js
node scripts/render-example-fixtures.js --output outputs/qa/2026-09-05-arrows-declared-hulls-after --only arrows-declared-hull-control-network --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text --comparison-grid-mode svg --strict-tikztosvg
node scripts/diff-example-pngs.js --output outputs/qa/2026-09-05-arrows-declared-hulls-after --only arrows-declared-hull-control-network
```
