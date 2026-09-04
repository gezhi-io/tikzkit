# Pathmorphing straight zigzag visual QA

## Scope

This slice implements the `straight zigzag` meta-decoration from
`decorations.pathmorphing`. It covers the alternating `curveto` and `zigzag`
children, `meta-segment length`, `segment length`, `amplitude`, child-state
remainders, curved paths, routed paths, terminal arrows, `mirror`, and `raise`.
It does not claim generic user-declared meta-decorations or `expanding waves`.

## Local PGF sources reviewed

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.pathmorphing.code.tex`
  declares `straight zigzag` as a meta-decoration that alternates a `curveto`
  child and a `zigzag` child, then always selects `curveto` for the final state.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduledecorations.code.tex`
  shows that a meta state switches when the remaining distance is smaller than
  its width. The `curveto` child advances in one-hundredth input-segment states;
  child invocations consume only complete states and reset the additional
  transform after returning.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.code.tex`
  starts a selected meta-decoration directly instead of wrapping it with the
  normal pre/main/post meta-decoration. This is why `pre length` and `post
  length` do not trim `straight zigzag` in native TikZ.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex`
  documents `meta-segment length` as the alternating child width, `segment
  length` as one complete zigzag cycle, and `amplitude` as the zigzag height.

## tikztosvg reference

- Executable: `/Library/TeX/texbin/tikztosvg`
- SVG rasterizer: `/opt/homebrew/bin/rsvg-convert`
- Main probe: `/private/tmp/tikzkit-straight-zigzag-probe.svg`
- Boundary probe: `/private/tmp/tikzkit-straight-zigzag-boundary-probe.svg`
- Transform probe: `/private/tmp/tikzkit-straight-zigzag-transform-probe.svg`
- Native probe PDF: `/private/tmp/tikzkit-straight-zigzag-native/tikzkit-straight-zigzag-probe.pdf`

The reference SVG emits one stroked path with `stroke-linecap="butt"` and
`stroke-linejoin="miter"`; arrow tips are separate filled paths. On a 4.5cm
line with a 10mm meta segment, a 4mm zigzag segment, and 2mm amplitude, the
first curveto child consumes 0.99cm, the zigzag child ends at 1.99cm, and the
same alternation repeats before the raw 4.5cm endpoint. A non-divisible 11mm
meta segment produces the native 1.08cm and 1.00cm child consumptions. The
transform probe also confirms that only the first nested child keeps the outer
`mirror`/`raise` transform.

## Visual cases

Artifacts are stored in
`outputs/qa-pathmorphing-straight-zigzag-2026-09-04`:

- `flowchart`: two horizontal data transitions and one routed feedback path.
- `math`: a decorated cubic function over a dashed source curve.
- `physics`: pulsed propagation between emitter and detector blocks.

Each case contains TikZKit SVG/PNG, tikztosvg SVG/PNG, MacTeX PNG, one-centimeter
grid variants, registered diffs, and a four-panel native comparison sheet.
Before this change, TikZKit ignored `straight zigzag` and painted the original
undecorated line or cubic. After the change, all three cases visibly reproduce
the alternating straight and zigzag spans, state phase, amplitudes, local curve
tangents, routed corner, raw endpoint, colors, line widths, and arrow direction.
The math geometry is visually coincident in all three renderers. Remaining
differences are glyph rasterization, one-pixel crops, and a known extra lower
bbox margin in the physics fixture caused by a positioned text node; the signal
geometry itself matches.

## Implemented commands and parameters

- `\usetikzlibrary{decorations.pathmorphing}`
- `decorate` with `decoration={straight zigzag,...}`
- `meta-segment length`, `segment length`, and `amplitude`
- straight, cubic, and routed source paths
- terminal `-Stealth` arrows after decoration
- native direct-meta handling of `pre length` and `post length` (ignored)
- first-child-only `mirror` and `raise` behavior from nested transform reset

## Regression coverage

`test/pathmorphing-straight-zigzag.test.js` checks exact tikztosvg-derived
vertices, non-divisible child-state remainders, direct-meta pre/post behavior,
mirror/raise reset, curved input, registry metadata, all three fixture renders,
zero diagnostics, and valid SVG coordinates.

## Remaining work

Generic `\pgfdeclaremetadecoration` parsing and execution is not implemented;
this is the built-in `straight zigzag` declaration. Exact state accounting
across arbitrary original multi-cubic soft paths remains an extension target.
`expanding waves` belongs to `decorations.pathreplacing`; its corrected state
boundary and transforms are covered separately in
`docs/qa/2026-09-04-pathreplacing-expanding-waves.md`. The positioned-node bbox
margin found by the physics fixture belongs to the separate node/bbox slice.
