# Automata Initial And Accepting QA

## Scope

This slice implements the state-machine defaults from `tikzlibraryautomata`:
`state`, `accepting`, and `initial` with the default/above/below/left/right
directions. It also covers `initial distance` and the default `start` label or
an explicit `initial text=...` value. It deliberately excludes `state with
output`, accepting arrows/text, and the remaining `circle split` behavior.

## Local TeX Reading

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryautomata.code.tex`

The local library makes `state` a circular, drawn node with `minimum
size=2.5em`; `accepting` applies `double`; and `initial` uses an after-node
path. That path starts `3ex` outside the chosen node boundary, points back to
the boundary with `->`, and places `start` at the same anchor. `initial
above/below/left/right` only select the direction/anchor pair. This is why the
implementation uses the shared node-border calculation, rather than fixed
coordinates in a fixture.

## Driver And Artifacts

Driver: `test/fixtures/examples/automata/initial-accepting-states.tex`.

- MacTeX native PNG: `outputs/qa-automata-initial/native-mactex.png`
- TikZKit JS SVG and grid PNG: `outputs/qa-automata-initial/tikzkit.svg`,
  `outputs/qa-automata-initial/tikzkit-grid.png`
- tikztosvg SVG and grid PNG: `outputs/qa-automata-initial/tikztosvg.svg`,
  `outputs/qa-automata-initial/tikztosvg-grid.png`
- Three-way visual sheet: `outputs/qa-automata-initial/comparison-sheet.png`

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; its SVG shows the
initial arrow as a separate stroked path, a filled arrow tip, and a text group
anchored exactly at the outside path endpoint. It renders the accepting state
as a broadened black circle overpainted by a white center stroke, which reads
as two black outlines. TikZKit already has a generic double-node overlay, so
this slice maps `accepting` onto that renderer-neutral node metadata.

## Visual Result

Before this change the driver produced ordinary circles only: no initial
arrows, no default `start` text, no directional initial placement, and no
accepting inner outline. The comparison sheet now shows all four initial
directions, a longer `5ex` lower arrow, the default labels, the explicit
`entry` label, and the accepting double ring. The JavaScript and tikztosvg
panels agree on node centers, arrow direction, arrow-to-boundary contact, and
label side; the 1cm grid makes the shared geometry visible.

The second change in this slice fixes the shared cached-text renderer: it now
honors `svgTextAnchor` as left/right alignment instead of always centering a
cached payload. Without that correction, the left/right initial labels were
centered on their arrow starts rather than ending or beginning there.

## Commands And Parameters

Implemented:

- `state`, `state without output`, `every state`
- `accepting`, `accepting by double`
- `initial`, `initial above`, `initial below`, `initial left`, `initial right`
- `initial distance=<dimension>`
- `initial text=<text>` including an empty value to suppress the default label
- picture-level `>=Stealth` for the generated initial arrow tip

Still unimplemented:

- `state with output` / `circle split`
- `accepting by arrow`, `accepting above/below/left/right`, `accepting text`,
  `accepting distance`, and `every accepting by arrow`
- `initial by diamond` and `every initial by arrow` custom style expansion

## Verification

Passed:

```sh
node --test test/automata.test.js test/library-modules.test.js
node scripts/render-example-fixtures.js --fixtures test/fixtures/examples \
  --output /private/tmp/qa-automata-initial \
  --only automata-initial-accepting-states --preserve-output
```

The full renderer suite was not used as an acceptance claim because this dirty
worktree has unrelated, pre-existing failures. The focused tests pass with no
diagnostics, and the native, JS, and tikztosvg images were inspected directly.
