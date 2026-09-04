# Path-replacing border terminal-state visual QA

## Scope

This slice completes the built-in `border` decoration state machine. It covers
full `tick` states, the incomplete terminal `last` state, its amplitude-width
guard, the `final` move, `segment length`, `amplitude`, `angle`, `pre length`,
`post length`, `mirror`, `raise`, and local tangent frames on straight and
cubic paths. It does not claim a generic executor for arbitrary user-declared
PGF decorations.

## Local PGF sources reviewed

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.pathreplacing.code.tex`
  declares `border` as `tick`, `last`, and `final`. `tick` switches to `last`
  when less than one segment remains. Both painted states draw from the local
  origin to `polar(angle, amplitude)`; `last` has width `amplitude`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduledecorations.code.tex`
  shows that every state `width` adds a strict remaining-distance switch to
  `final`. Thus an exact segment executes, zero remainder skips `last`, and a
  positive remainder smaller than `amplitude` also skips `last`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.code.tex`
  wraps the selected child in pre/main/post decorations. Mirror is composed
  before the local-y raise, and the post child starts at actual child-state
  progress rather than the nominal end of the main section.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex`
  documents `border` as repeated line segments whose separation, length, and
  direction are controlled by `segment length`, `amplitude`, and `angle`.

## tikztosvg reference

- Executable: `/Library/TeX/texbin/tikztosvg`
- SVG rasterizer: `/opt/homebrew/bin/rsvg-convert`
- Boundary and transform SVG/PNG: `/private/tmp/tikzkit-border-transform.svg`
  and `/private/tmp/tikzkit-border-transform.png`
- Last-state SVG/PNG: `/private/tmp/tikzkit-border-amplitude-small.svg`
  and `/private/tmp/tikzkit-border-amplitude-small.png`
- Suppressed-last SVG/PNG: `/private/tmp/tikzkit-border-amplitude-large.svg`
  and `/private/tmp/tikzkit-border-amplitude-large.png`
- Pre-only endpoint SVG/PNG: `/private/tmp/tikzkit-border-pre-only.svg`
  and `/private/tmp/tikzkit-border-pre-only.png`
- Post-only consumed-state SVG/PNG: `/private/tmp/tikzkit-border-post-only.svg`
  and `/private/tmp/tikzkit-border-post-only.png`

For a 43mm path with 3mm pre, 5mm post, 8mm segments, 2mm amplitude,
35-degree angle, mirror, and 1.5mm raise, the reference SVG has a raw pre line,
four complete ticks, one `last` tick, and a post line beginning at 37mm. With
1mm amplitude the `last` state still runs and the post begins at 36mm; with
4mm amplitude the 3mm remainder cannot enter `last`, so the post begins at
35mm. A pre-only probe confirms that `final` still moves to the 43mm source
endpoint, while a post-only probe begins its post line at the consumed 34mm
state point. The SVG uses independent `M ... L` tick subpaths with butt caps,
miter joins, and path-coordinate transforms; TikZKit now emits the same
structure and local orientation.

## Visual cases

Artifacts are stored in
`outputs/qa-pathreplacing-border-states-2026-09-04`:

- `decorations-pathreplacing-border`: existing manual/postaction regression.
- `flowchart`: an oriented dispatch boundary between two process stages.
- `math`: sampled normals following a cubic function path.
- `physics`: oriented samples following a curved electric-field line.

Each case contains TikZKit SVG/PNG, tikztosvg SVG/PNG, MacTeX PNG, one-centimeter
grid variants, registered pixel diffs, and a four-panel native comparison
sheet. Before this change, `border` ignored pre/post, mirror, raise, the
terminal amplitude guard, and actual child-state progress. Afterward, tick
count, last-state presence, post-line start, angle, raise, reflection, and
curved tangent orientation visibly agree across all three renderers. The old
manual case is pixel-classified `same` against tikztosvg. Remaining differences
in the new fixtures are text rasterization and small text-bbox crop reserves;
the decoration geometry itself is aligned.

## Implemented commands and parameters

- `\usetikzlibrary{decorations.pathreplacing}`
- `\draw[...,decorate,decoration={border,...}]`
- `segment length`, `amplitude`, and `angle`
- full `tick`, conditional `last`, and `final` states
- `pre length`, `post length`, `mirror`, and `raise`
- straight and cubic paths with per-state tangent frames
- ordinary styles, colors, nodes, labels, grids, and Stealth arrows used by
  the three fixtures

Not implemented in this slice: arbitrary user-declared decoration automata,
custom pre/post decoration names, arbitrary `decoration transform`, reverse
path state execution, or analytic tangent transport over pathological cubic
curvature beyond the shared adaptive path sampler.

## Verification

```sh
node --test --test-name-pattern='wave|border decoration|border last' test/interpreter.test.js
node --test test/pathreplacing-border-states.test.js
npm run case:audit -- test/fixtures/examples/decorations/pathreplacing-border-states/math.tex \
  --review docs/qa/2026-09-04-pathreplacing-border-states-review.json --strict
npm run examples:render -- --output outputs/qa-pathreplacing-border-states-2026-09-04 \
  --only decorations-pathreplacing-border decorations-pathreplacing-border-states-flowchart \
  decorations-pathreplacing-border-states-math decorations-pathreplacing-border-states-physics \
  --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text
npm run examples:diff -- --output outputs/qa-pathreplacing-border-states-2026-09-04 --register
```

All four artifact pipelines complete without TikZKit diagnostics or external
renderer failures.
