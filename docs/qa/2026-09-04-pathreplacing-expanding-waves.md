# Path-replacing expanding waves visual QA

## Scope

This slice completes the built-in `expanding waves` state geometry in
`decorations.pathreplacing`. It covers exact endpoint state boundaries,
`segment length`, `angle`, `pre length`, `post length`, `mirror`, `raise`, and
local tangent frames on straight and cubic paths. Fixed-radius `waves`
continues to cover its existing untransformed state geometry but is outside
this boundary/transform slice. It does not claim a generic executor for
user-defined `\pgfdeclaredecoration` state machines.

## Local PGF sources reviewed

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.pathreplacing.code.tex`
  declares an empty initial state one segment wide. Each later arc uses
  `\pgfdecoratedcompleteddistance` as both its radius and negative local x
  offset before `\pgfpatharc{angle}{-angle}{radius}`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduledecorations.code.tex`
  shows that zero remaining distance switches directly to `final`; only a
  positive remainder smaller than one segment enters `last`. State code runs
  in the current input tangent frame with the additional TikZ transform.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.code.tex`
  declares the internal `pre`, `main`, `final` meta-decoration. Its children
  are `pre=lineto`, the selected decoration, and `post=lineto`; mirror is
  installed before raise in the local y transformation.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex`
  documents growing arcs controlled by `segment length` and `angle`, under
  Path Replacing Decorations rather than Path Morphing Decorations.

## tikztosvg reference

- Executable: `/Library/TeX/texbin/tikztosvg`
- SVG rasterizer: `/opt/homebrew/bin/rsvg-convert`
- Exact-boundary probe: `/private/tmp/tikzkit-expanding-waves-basic.svg`
- Transform probe: `/private/tmp/tikzkit-expanding-waves-transform.svg`
- Curved-path probe: `/private/tmp/tikzkit-expanding-waves-curve.svg`
- Landmark probe: `/private/tmp/tikzkit-expanding-waves-landmarks.svg`

The reference SVG uses independent `M ... C` subpaths with butt caps and miter
joins. A 4cm path with 1cm states has arcs at 1cm, 2cm, and 3cm, not at the
4cm endpoint. In the transform probe, the raw path begins with a 3mm line,
four arcs use 8mm state spacing and a reflected 2mm raise, and the post line
runs from the child-final 3.5cm coordinate to 4.3cm. Normalized cubic control
points in TikZKit now match those reference values.

## Visual cases

Artifacts are stored in
`outputs/qa-pathreplacing-expanding-waves-2026-09-04`:

- `decorations-pathreplacing-waves`: the original fixed/growing manual case.
- `flowchart`: broadcast states between source and receiver blocks.
- `math`: reflected and raised level arcs over coordinate axes.
- `physics`: wavefronts following a cubic propagation path.

Each case contains TikZKit SVG/PNG, tikztosvg SVG/PNG, MacTeX PNG, one-centimeter
grid variants, a pixel diff, and a four-panel native comparison sheet. Before
the fix, the original case had a false largest red arc at the exact endpoint;
the transform probe ignored its straight pre/post pieces, reflection, and
raise. After the fix, arc count, centers, radii, orientation, path endpoints,
and curved local tangents visibly agree across all three renderers. Remaining
differences are font rasterization, one-pixel crops, and a small known text
bbox reserve in the physics fixture.

## Implemented commands and parameters

- `\usetikzlibrary{decorations.pathreplacing}`
- `\draw[...,decorate,decoration={expanding waves,...}]`
- fixed-radius `waves` and growing `expanding waves`
- `segment length`, `angle`, `radius`, and `start radius`
- `pre length`, `post length`, `mirror`, and `raise`
- straight and cubic input paths with per-state tangent frames
- `\definecolor`, ordinary nodes, positioned nodes, labels, and Stealth axes

Not implemented in this slice: arbitrary user-declared decorations, custom
`pre`/`post` decoration names, arbitrary `decoration transform`, reverse-path
state execution, fixed-radius `waves` with pre/post or mirror/raise, and
analytic arc transport over unsampled pathological cubic curvature.

## Verification

```sh
node --test --test-name-pattern='wave' test/interpreter.test.js
node --test test/pathreplacing-expanding-waves.test.js
npm run case:audit -- test/fixtures/examples/decorations/pathreplacing-expanding-waves/math.tex \
  --review docs/qa/2026-09-04-pathreplacing-expanding-waves-review.json --strict
npm run examples:render -- --output outputs/qa-pathreplacing-expanding-waves-2026-09-04 \
  --only decorations-pathreplacing-waves decorations-pathreplacing-expanding-waves-flowchart \
  decorations-pathreplacing-expanding-waves-math decorations-pathreplacing-expanding-waves-physics \
  --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text
npm run examples:diff -- --output outputs/qa-pathreplacing-expanding-waves-2026-09-04
```

All four artifact pipelines completed without TikZKit diagnostics or external
renderer failures.
