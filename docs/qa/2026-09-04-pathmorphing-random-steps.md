# Pathmorphing random steps visual QA

## Scope

This slice implements the `random steps` decoration from
`decorations.pathmorphing` and the shared PGF pseudo-random sequence used by
the browser interpreter. It covers `\pgfmathsetseed`, `segment length`,
`amplitude`, `pre length`, `post length`, `mirror`, `raise`, terminal arrows,
and automatic restart at polyline corners. It does not claim all PGF math
random functions or the remaining pathmorphing decorations.

## Local PGF sources reviewed

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.pathmorphing.code.tex`
  defines a zero-width initial state, a repeated state of width `segment
  length`, automatic end and corner thresholds of `1.5 * segment length`, and
  two independent `rand * amplitude` offsets for every completed step.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/math/pgfmathfunctions.random.code.tex`
  defines the Schrage-form linear congruential generator with modulus
  `2147483647`, multiplier `69621`, quotient `30845`, and remainder `23902`.
  Its `rand` result is `(state mod 200001 - 100000) / 100000`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduledecorations.code.tex`
  supplies pre/post states, persistent corner handling, state-frame transforms,
  and the remaining-distance values used by automatic transitions.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcoretransformations.code.tex`
  establishes the mirror-before-raise transform order used by decoration state
  points.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex`
  documents `segment length` as the basic step size and `amplitude` as an
  independent uniform perturbation of both local coordinates.

## tikztosvg reference

- Executable: `/Library/TeX/texbin/tikztosvg`
- SVG rasterizer: `/opt/homebrew/bin/rsvg-convert`
- Seed probe input: `/private/tmp/tikzkit-random-steps-snippet.tikz`
- Seed probe SVG: `/private/tmp/tikzkit-random-steps-probe.svg`
- Seed probe PNG: `/private/tmp/tikzkit-random-steps-probe.png`
- Native probe PNG: `/private/tmp/tikzkit-random-native/probe-1.png`
- Length-state probe: `/private/tmp/tikzkit-random-steps-length-probe.svg`

The reference SVG emits the decoration as one stroked `<path>` with line
commands, `stroke-linecap="butt"`, and `stroke-linejoin="miter"`. Arrow tips
are separate filled paths rather than SVG markers. With seed 100, the first two
PGF `rand` values are `0.62066` and `0.35903`; the first decorated point is
`(17.691844pt,2.033531pt)`, which the browser renderer reproduces at
`(0.624132cm,0.071806cm)`. This confirms both the random sequence and the
state-local coordinate transform.

## Visual cases

Artifacts are stored in `outputs/qa-pathmorphing-random-steps-2026-09-04`:

- `flowchart`: seeded blue and red transitions, a routed corner, pre/post
  lengths, and terminal arrows.
- `math`: a seeded residual path crossing a function plot.
- `physics`: a seeded particle trajectory with automatic corner restarts and a
  terminal arrow.

Each case contains TikZKit SVG/PNG, tikztosvg SVG/PNG, MacTeX PNG, one-centimeter
grid variants, registered diffs, and native comparison sheets. Before this
change, TikZKit ignored `random steps` and drew the undecorated source paths.
After the change, the three cases visibly match the references point-for-point
in random offsets, step count, corner restart, endpoints, colors, line width,
and arrow direction. The remaining visible differences are text rasterization
and approximately one-pixel canvas crops.

## Implemented commands and parameters

- `\pgfmathsetseed{...}` before or inside a `tikzpicture`
- `decoration={random steps,...}` and `decorate`
- `segment length`, `amplitude`, `pre length`, and `post length`
- `mirror` and `raise`
- persistent automatic corner handling at `1.5 * segment length`
- document-shared seeded random state for decorations, data visualization, and
  the starburst shape

## Regression coverage

`test/pathmorphing-random-steps.test.js` checks the exact PGF random sequence,
exact tikztosvg-derived vertices, preamble and in-picture seed resets,
automatic corner behavior, pre/post lengths, mirror/raise transforms, registry
metadata, three fixture renders, zero diagnostics, and valid SVG coordinates.

## Remaining work

The browser uses seed 1 when the source does not call `\pgfmathsetseed`; TeX's
time-and-year default is intentionally not copied because stable asynchronous
browser rerenders are more useful. Generic parsing of every PGF math random
function and random-list operation remains incomplete. User-declared decoration
state machines are also outside this slice. `straight zigzag` and `expanding
waves` remain separate unsupported or partial pathmorphing features.
