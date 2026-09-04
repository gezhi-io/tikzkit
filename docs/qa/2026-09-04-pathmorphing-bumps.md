# Pathmorphing bumps visual QA

## Scope

This slice implements the `bumps` decoration from `decorations.pathmorphing`.
It covers `amplitude`, `segment length`, `pre length`, `post length`, `mirror`,
`raise`, signed amplitudes, explicit `path has corners`, straight and cubic
paths, and the final connection to the undecorated endpoint. It does not claim
support for the remaining pathmorphing decorations.

## Local PGF sources reviewed

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.pathmorphing.code.tex`
  defines one bump as a half-segment state made from two cubic curves. The
  control coefficients are `0.555`, `0.11125`, `0.25`, `0.38875`, and `0.5`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduledecorations.code.tex`
  supplies the automatic-end and automatic-corner rules. Bumps use a
  `0.51 * segment length` threshold, and the final state draws to the raw input
  path endpoint.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcoretransformations.code.tex`
  confirms that `mirror` changes the local normal before `raise` translates the
  state frame.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex`
  documents the bumps family and its segment/amplitude controls.

## tikztosvg reference

- Executable: `/Library/TeX/texbin/tikztosvg`
- Probe input: `/private/tmp/tikzkit-bumps-probe.tex`
- Probe SVG: `/private/tmp/tikzkit-bumps-probe.svg`
- SVG rasterizer: `/opt/homebrew/bin/rsvg-convert`

The reference SVG uses one stroked path with `stroke-linecap="butt"` and
`stroke-linejoin="miter"`. Each bump is represented by two SVG cubic segments;
there are no markers. With `mirror,raise=2mm,amplitude=3mm`, the repeated state
baseline is 2 mm below the source path, the apex is 5 mm below it, and the final
line returns to the unraised source endpoint. This structure matches the local
PGF state declaration.

## Visual cases

Artifacts are stored in `outputs/qa-pathmorphing-bumps-2026-09-04`:

- `flowchart`: repeated blue and mirrored/raised red transitions with explicit
  pre/post lengths and terminal arrows.
- `math`: positive straight bumps and negative-amplitude bumps following a
  cubic function with analytic tangent frames.
- `physics`: a bumped compliant-contact line along an inclined plane.

Before the change, TikZKit rendered the three decorated inputs as their raw
straight or cubic paths. After the change, all three show the same bump count,
phase, local orientation, and terminal connection as MacTeX and tikztosvg. The
remaining visible differences are text rasterization and roughly one-pixel
bounding-box offsets, not missing geometry.

## Regression coverage

`test/pathmorphing-bumps.test.js` checks the exact two-cubic coefficients, the
0.51 automatic-end threshold, mirror/raise ordering, raw endpoint final state,
corner restart behavior, cubic tangent frames, signed amplitude, registry
metadata, three fixture renders, zero diagnostics, and absence of invalid SVG
coordinates.

## Remaining work

`decorations.pathmorphing` remains partial. `random steps`, `bent`, `straight
zigzag`, and `expanding waves` still need separate source-driven slices and
visual acceptance.
