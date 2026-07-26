# Automata State With Output QA

## Scope

This slice completes `automata`'s `state with output` style by implementing
the `circle split` shape and its `text`/`lower` node parts. It covers the
state's shared circular geometry, center separator, text placement, the
`lower` anchor, ordinary automata edges, `initial`, and `accepting` together
in one real diagram. It does not include the accepting-arrow family.

## Local TeX Reading

Reviewed local sources:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryautomata.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.multipart.code.tex`

`tikzlibraryautomata` defines `state with output` as `circle split,draw,
minimum size=2.5em,every state`. The multipart shape source declares the
`text` and `lower` parts, chooses a circular radius from the larger part's
text box plus inner separations and stroke width, then draws a horizontal
separator through the center. Its `lower` anchor belongs to the lower text
part, not the node center. TikZKit mirrors that layout once in the interpreter
and gives the SVG renderer only the circle/separator drawing responsibility.

## Driver And Artifacts

Driver: `test/fixtures/examples/automata/state-with-output.tex`.

- MacTeX native PNG: `outputs/qa-automata-output/native-mactex.png`
- TikZKit JS SVG and grid PNG: `outputs/qa-automata-output/tikzkit.svg`,
  `outputs/qa-automata-output/tikzkit-grid.png`
- tikztosvg SVG and grid PNG: `outputs/qa-automata-output/tikztosvg.svg`,
  `outputs/qa-automata-output/tikztosvg-grid.png`
- Three-way visual sheet: `outputs/qa-automata-output/comparison-sheet.png`

`tikztosvg` was available at `/Library/TeX/texbin/tikztosvg`. Its SVG uses a
circle path and a separate centered horizontal path for each state, while the
accepting state is an outer black circle overpainted with a thin white center
stroke. The JS renderer follows the same separate-circle/separator structure
and reuses the renderer-neutral double outline.

## Visual Result

Before the change, TikZKit emitted raw `\\nodepart{lower}` text, did not draw
any circle split, and resolved `state.lower` as the state center. After the
change the JavaScript panel shows the three split circles, upper state labels,
lower output labels, the central separators, a correctly placed lower-anchor
guide, the initial arrow, and the accepting double outline. The three panels
share centers at `(0,0)`, `(3,0)`, and `(1.5,-2.25)` on the 1cm grid; their
edge endpoints meet the circular borders rather than a rectangular text box.

Residual differences are limited to TeX-versus-browser text rasterization and
the exact white-over-black accepting double-stroke construction.

## Commands And Parameters

Implemented in this slice:

- `state with output`
- `circle split`
- `\\nodepart{lower}`
- `text` and `lower` part rendering
- `(<node>.lower)` anchor resolution
- interaction with `state`, `accepting`, `initial`, `every state`, and `>=Stealth`

Still unimplemented in `automata`:

- `accepting by arrow`, `accepting above/below/left/right`, `accepting text`,
  `accepting distance`, and `every accepting by arrow`
- `initial by diamond` and custom `every initial by arrow` expansion

## Verification

Passed:

```sh
node --test test/automata.test.js test/library-modules.test.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/examples \
  --output /private/tmp/qa-automata-output \
  --only automata-state-with-output --preserve-output
```

The native MacTeX, TikZKit, and tikztosvg panels were regenerated and
inspected directly. The broad suite remains outside this acceptance claim
because the worktree contains unrelated in-progress changes.
