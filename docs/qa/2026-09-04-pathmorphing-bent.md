# Pathmorphing bent visual QA

## Scope

This slice implements the `bent` decoration from `decorations.pathmorphing`
for straight input segments and polylines. It covers the default and explicit
`aspect`, signed `amplitude`, `pre length`, `post length`, `mirror`, and `raise`.
PGF explicitly says that bent makes little sense for curves, so curved source
segments are outside this acceptance boundary.

## Local PGF sources reviewed

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.pathmorphing.code.tex`
  defines one cubic state whose width is the remaining input-segment distance.
  Its controls are `(aspect * distance, amplitude)` and
  `((1-aspect) * distance, amplitude)`, followed by the segment endpoint.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduledecorations.code.tex`
  supplies the default `aspect=0.5`, pre/post states, state-frame transforms,
  and the input-segment remaining-distance value.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcoretransformations.code.tex`
  establishes the mirror-before-raise transform order used by state points.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex`
  documents amplitude, aspect, polyline examples, and the straight-line-only
  recommendation.

## tikztosvg reference

- Executable: `/Library/TeX/texbin/tikztosvg`
- Probe input: `/private/tmp/tikzkit-bent-probe.tex`
- Probe SVG: `/private/tmp/tikzkit-bent-probe.svg`
- Probe PNG: `/private/tmp/tikzkit-bent-probe.png`
- Length-state probe: `/private/tmp/tikzkit-bent-length-probe.svg`
- SVG rasterizer: `/opt/homebrew/bin/rsvg-convert`

The SVG uses one stroked `<path>` per input path, with `stroke-linecap="butt"`
and `stroke-linejoin="miter"`; bent geometry is emitted as cubic path data and
does not use markers. A two-line polyline produces two cubic commands, each in
the new line segment's local frame. `mirror,raise=2mm` transforms controls and
the state endpoint while leaving the initial path point raw. A `pre length`
adds a line before a shortened first cubic. A nonzero `post length` on a single
line prevents bent's full-segment state from running and leaves a straight path.

## Visual cases

Artifacts are stored in `outputs/qa-pathmorphing-bent-2026-09-04`:

- `flowchart`: forward approval arcs and a mirrored/raised revision arc.
- `math`: a two-segment composition path and a negative-amplitude function.
- `physics`: the deflected profile of a simply supported beam.

Before the change, TikZKit painted all decorated paths as raw straight lines.
After the change, the three panels match MacTeX and tikztosvg in cubic control
placement, bend direction, segment restart, endpoints, and arrow tangents. The
visible residual is limited to text rasterization and one-pixel crop differences.

## Regression coverage

`test/pathmorphing-bent.test.js` checks source-exact controls, segment-local
frames, mirror/raise order, the transformed final endpoint, pre/post behavior,
signed amplitude, registry metadata, three fixture renders, zero diagnostics,
and absence of invalid SVG coordinates.

## Remaining work

`decorations.pathmorphing` remains partial. `random steps`, `straight zigzag`,
and `expanding waves` need separate source-driven slices. General bent behavior
on curved input paths is deliberately not claimed because the PGF manual advises
against that use.
