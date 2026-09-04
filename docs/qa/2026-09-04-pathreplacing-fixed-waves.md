# Path-replacing fixed waves visual QA

## Scope

This slice completes boundary and local-frame behavior for the built-in
fixed-radius `waves` decoration. It covers `segment length`, `radius` (the PGF
`start radius` key), `angle`, `pre length`, `post length`, `mirror`, `raise`,
exact and incomplete terminal states, and straight or cubic input paths. It
does not claim a generic executor for user-defined PGF decoration automata.

## Local PGF sources reviewed

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.pathreplacing.code.tex`
  declares one `wave` state with `width=segment length`. The state shifts one
  segment forward and draws a fixed-radius arc from `angle` to `-angle`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduledecorations.code.tex`
  makes every `width` key install a strict remaining-distance switch to
  `final`: exact states run, incomplete terminal states do not. State code is
  transformed into the current input tangent frame.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.code.tex`
  wraps ordinary decorations in `pre=lineto`, the selected main child, and
  `post=lineto`; mirror is installed before the local raise translation.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex`
  documents fixed waves under Path Replacing Decorations and identifies
  segment length, radius, and angle as their geometric controls.

## tikztosvg reference

- Executable: `/Library/TeX/texbin/tikztosvg`
- SVG rasterizer: `/opt/homebrew/bin/rsvg-convert`
- Exact-state SVG/PNG: `/private/tmp/tikzkit-fixed-waves-exact.svg` and `.png`
- Boundary-transform SVG/PNG: `/private/tmp/tikzkit-fixed-waves-transform.svg` and `.png`
- Short-remainder SVG/PNG: `/private/tmp/tikzkit-fixed-waves-short.svg` and `.png`

The reference SVG serializes each wave as an independent cubic `M ... C`
subpath with butt caps and miter joins. A 4cm path with 1cm states emits four
arcs. A 5mm path with an 8mm state emits no painted path. With 3mm pre, 5mm
post, an 8mm segment, mirror, and 2mm raise, the SVG contains the raw pre line,
four reflected and raised arcs, and a post line from the observable 3.5cm
child-final coordinate to the 4.3cm source endpoint.

## Visual cases

Artifacts are stored in
`outputs/qa-pathreplacing-fixed-waves-2026-09-04`:

- `decorations-pathreplacing-waves`: existing fixed and expanding manual case.
- `flowchart`: fixed carrier states between a sensor and filter block.
- `math`: mirrored local-scale arcs along a cubic function path.
- `physics`: constant-radius wavefronts following a curved ray path.

Each case contains TikZKit SVG/PNG, tikztosvg SVG/PNG, MacTeX PNG, one-centimeter
grid variants, a pixel diff, and a four-panel native comparison sheet. Before
the fix, fixed waves ignored pre/post, mirror, and raise and could paint one
extra wave for an incomplete terminal segment. After the fix, arc count,
radius, orientation, boundary lines, and per-state curve tangents visibly
agree across all three renderers. Remaining differences are font
rasterization, help-grid color, and one-pixel crop reserves.

## Implemented commands and parameters

- `\usetikzlibrary{decorations.pathreplacing}`
- `\draw[...,decorate,decoration={waves,...}]`
- `segment length`, `radius`, `start radius`, and `angle`
- `pre length`, `post length`, `mirror`, and `raise`
- exact full-state and incomplete terminal-state switching
- straight and cubic paths with per-state tangent frames
- ordinary styles, colors, nodes, labels, grids, and Stealth arrows used by
  the three fixtures

Not implemented in this slice: arbitrary user-declared decorations, custom
pre/post decoration names, arbitrary `decoration transform`, reverse-path
state execution, or analytic transport over unsampled pathological cubic
curvature.

## Verification

```sh
node --test --test-name-pattern='wave' test/interpreter.test.js
node --test test/pathreplacing-fixed-waves.test.js
npm run case:audit -- test/fixtures/examples/decorations/pathreplacing-fixed-waves/math.tex \
  --review docs/qa/2026-09-04-pathreplacing-fixed-waves-review.json --strict
npm run examples:render -- --output outputs/qa-pathreplacing-fixed-waves-2026-09-04 \
  --only decorations-pathreplacing-waves decorations-pathreplacing-fixed-waves-flowchart \
  decorations-pathreplacing-fixed-waves-math decorations-pathreplacing-fixed-waves-physics \
  --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text
npm run examples:diff -- --output outputs/qa-pathreplacing-fixed-waves-2026-09-04
```

All four artifact pipelines completed without TikZKit diagnostics or external
renderer failures.
