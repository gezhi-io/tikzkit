# `decorations.pathreplacing`: `waves` and `expanding waves` QA

## Scope

This slice adds the two circular-arc replacement decorations defined by the
local PGF path-replacing library:

- `decoration={waves,...}`: a fixed-radius arc at every complete state;
- `decoration={expanding waves,...}`: an initial empty state followed by
  arcs whose radius grows with completed decoration distance.

It accepts `segment length`, `angle`, `radius`, and `start radius`, samples
each input subpath continuously through its local tangent, and retains the
native terminal move. It does not claim arbitrary `show path construction`
code or exact analytic tangent calculation for extremely high-curvature
Bezier input.

The real driver is Case 313,
`decorations-pathreplacing-waves`, derived from the two local PGF manual
examples. Its blue fixed waves use `8mm`, `2.4mm`, and `40`; its red
expanding waves use `8mm` and `12`.

```tex
\draw[blue,very thick,decorate,
  decoration={waves,segment length=8mm,radius=2.4mm,angle=40}]
  (0,2) -- (4,2);
\draw[red,very thick,decorate,
  decoration={expanding waves,segment length=8mm,angle=12}]
  (0,0.4) -- (4,0.4);
```

## Local PGF Study

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.pathreplacing.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduledecorations.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.pathreplacing.code.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex`, `waves` and `expanding waves` sections

The shared decoration module sets the defaults to 10pt segment length, 45
degrees, and a 2.5pt start radius. `waves` shifts by one segment length,
then calls `\pgfpatharc(angle,-angle,start radius)`: each fixed wave is an
independent circular subpath in the current tangent frame. `expanding waves`
first consumes a silent segment. Each later arc uses
`\pgfdecoratedcompleteddistance` for both its radius and the negative local
x offset before `\pgfpatharc`; the `last` state has width zero, so it still
draws the largest arc when the source length ends on an exact segment
boundary.

TikZKit mirrors that state sequence on each flattened complete subpath,
converts the local circles to cubic SVG path segments with transformed
tangents, and emits a non-painting terminal move for correct arrow/path
continuation semantics.

## Three-Way Visual QA

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; `rsvg-convert`
created the PNG panels. Artifacts are in:

`/private/tmp/tikzkit-qa-pathreplacing-waves-after-2026-08-07-r2/`

- TikZKit SVG/PNG: `tikzkit-svg/`, `tikzkit-png/`, `tikzkit-grid-png/`
- tikztosvg SVG/PNG: `tikztosvg-svg/`, `tikztosvg-png/`, `tikztosvg-grid-png/`
- MacTeX native PNG: `mactex-png/`
- four-way sheet: `diff/decorations-pathreplacing-waves-native-sheet.png`
- per-command/option/number acceptance record:
  `docs/qa/2026-08-07-decorations-pathreplacing-waves-review.json`

I inspected the TikZKit, tikztosvg, MacTeX, and sheet panels. Before this
change both names fell through to an ordinary continuous source line. After
it, blue fixed arcs and red growing arcs replace those source lines in all
three renderers. The decisive correction came from the tikztosvg SVG: it
contains five red `M ... C` subpaths, including the terminal 4cm-radius arc.
The first implementation emitted only four; TikZKit now emits the same five.

The registered TikZKit/tikztosvg residual is `0.00183` mean absolute RGBA;
TikZKit/MacTeX is `0.01886`. The remaining difference is a small browser crop
reserve plus grid, font, and stroke antialiasing, not missing arcs, incorrect
radius growth, or wrong orientation.

## Verification

```sh
node --test --test-name-pattern='fixed-radius and expanding wave arcs|normal ticks|border decoration|brace decoration' test/interpreter.test.js
npm run case:audit -- test/fixtures/examples/decorations/pathreplacing-waves.tex \
  --review docs/qa/2026-08-07-decorations-pathreplacing-waves-review.json --strict
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-pathreplacing-waves-after-2026-08-07-r2 \
  --only decorations-pathreplacing-waves --native-reference \
  --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output /private/tmp/tikzkit-qa-pathreplacing-waves-after-2026-08-07-r2 \
  --register --alignment-radius 3
```

The focused tests pass; strict semantic acceptance passes; all TikZKit,
tikztosvg, and MacTeX artifact generators complete without diagnostics.

## Remaining Work

The evaluator uses the same flattened-path seam already used by `ticks` and
`border`, so very tight Bezier curvature can retain a small tangent sampling
error. `show path construction` remains unimplemented and should be handled
as its own callback/segment-introspection slice.
