# `decorations.pathreplacing`: `show path construction` callback-label QA

## Scope

This focused slice corrects labels attached at the end of a callback path in
the documented `show path construction` decoration. It covers inherited
`every node` placement keys such as `midway`, `pos`, and `sloped` on straight
and cubic input segments. It does not claim arbitrary TeX callback execution,
low-level PGF point macros, or exact native text metrics.

The real driver is
`test/fixtures/examples/decorations/pathreplacing-show-path-construction.tex`,
copied from the TeX Live manual's `show path construction` example. Its
callbacks use `moveto code`, `lineto code`, `curveto code`, `closepath code`,
`\tikzinputsegmentfirst`, `\tikzinputsegmentlast`, and both cubic support
points.

## Local PGF Study

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.pathreplacing.code.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex`, `show path construction`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`, node transformations and `every node`

The PGF decoration runs each callback once per original input command after
installing its first, last, and two support points. The manual explicitly says
the decoration automaton transform is disabled during callback execution; it
does **not** disable ordinary TikZ node semantics. Therefore callback paths
must still apply the picture's `every node` style. A 180-degree TikZ arc is
two input cubic segments, so it correctly runs the `curveto` callback twice.

## Implementation

`inlineNodeResolvedOptions` now merges inherited node options before calculating
an inline label's path position. Direct terminal labels, pending inline labels,
and orthogonal paths share this resolution. Cubic path records carry their two
controls; `inlineNodePathPoint` applies de Casteljau at `midway`/`pos` and the
sloped label rotation uses the same point's Bezier tangent.

This is shared interpreter behavior, not a case-specific coordinate override.

## Three-Way Visual QA

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. Artifacts were generated in the ignored local
directory:

`outputs/qa-decorations-show-path-construction-2026-08-07/after/`

- TikZKit SVG/PNG: `tikzkit-svg/`, `tikzkit-png/`
- tikztosvg SVG/PNG: `tikztosvg-svg/`, `tikztosvg-png/`
- MacTeX native PNG: `mactex-png/`
- 1cm grids, diff, and four-panel sheet: `tikzkit-grid-png/`,
  `tikztosvg-grid-png/`, and
  `diff/decorations-pathreplacing-show-path-construction-native-sheet.png`

I inspected the MacTeX, TikZKit, tikztosvg, and diff panels. Before the
change, TikZKit placed `lineto` at the line endpoint, both `curveto` labels
near their curve endpoints, and `closepath` at the top endpoint. Its crop was
170x141px, while both native references were 144x105px. After the change, the
blue label is centered on the diagonal, green labels sit at each cubic's
midpoint and follow its local tangent, and the orange label is centered on the
closing vertical segment. The JS crop shrank to 159x116px.

The semantic visual result is improved even though a raw pixel residual is not
a completion signal: the current JS text is wider than the native CMR outlines,
so the crop remains 15x11px larger and the PNG changed-pixel ratio is still
high. `tikztosvg` matches MacTeX's geometry here. Its SVG has a
`107.93pt x 78.56pt` viewBox, glyph-outline paths, a y-flip matrix for the
drawn paths, `stroke-linecap=butt`, `stroke-linejoin=miter`, and nonzero-filled
arrow tips. TikZKit emits normal SVG `<text>` groups with `dominant-baseline`
and rotation transforms; that renderer-owned text difference is the remaining
visible gap.

## Verification

```sh
node --test --test-name-pattern='inherits every node placement|runs show path construction|does not apply the outer coordinate transform twice' test/interpreter.test.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/examples \
  --only decorations-pathreplacing-show-path-construction \
  --output outputs/qa-decorations-show-path-construction-2026-08-07/after \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
node scripts/diff-example-pngs.js \
  --output outputs/qa-decorations-show-path-construction-2026-08-07/after \
  --alignment-radius 3
```

The three focused interpreter tests pass. All three renderers generated their
artifacts without diagnostics. The full interpreter suite remains at its
pre-existing 17 unrelated failures; this change introduced none.

## Remaining Work

Next, calibrate the renderer's CMR `\tiny` text widths and painted bounds
against the local glyph outlines. That should remove the remaining crop gap
without moving the now-correct path geometry. General TeX callback bodies,
PGF point-level macros, and other path-replacing decorations remain separate
partial slices.

