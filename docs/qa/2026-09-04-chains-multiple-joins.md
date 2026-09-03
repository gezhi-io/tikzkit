# TikZ chains multi-source join QA

## Slice and acceptance boundary

- Library slice: `chains` nodes that receive more than one `join` action.
- Priority: repeatable TikZ options were stored as one object value, so all but
  the last join disappeared. This visibly broke converging workflows, proof
  chains, and signal-flow diagrams.
- In scope: ordered repeated `join`, `join=with ... by {...}`, named chain-end
  aliases, `every on chain`, `every join`, local arrow-direction replacement,
  and inherited plus explicit joins on `\chainin`.
- Out of scope: curved/bent join edges, arbitrary `after node path` programs,
  and arbitrary path continuation after `\chainin`.

## Local source review

Reviewed these MacTeX 2025 files:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarychains.code.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-chains.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex`

Implementation points learned from the executable source and manual:

- Each `join` is executable `.code`; it appends an independent edge through
  `after node path`. The manual explicitly permits several joins on one node.
- A bare `join` uses `\tikzchainprevious`; `join=with <node>` uses its named
  source. A first-chain-node bare join therefore emits no edge.
- Every edge receives `every join` before its local `by {...}` options. A local
  arrow specification resets both arrow ends rather than adding a second tip.
- `chain-begin`, `chain-end`, and `chain-N` are aliases of the real node. Their
  anchors and border clipping must therefore use the same node record.
- `every on chain` runs after the node has been recognized as belonging to a
  chain, including when `on chain` is inherited from `every node`.
- `\chainin` applies `every chain in` and then explicit options. Since `join` is
  executable, joins from both layers accumulate in that order; the inserted
  node's real width and height seed placement of the next chain node.

## Reference artifacts

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`.
- SVG rasterizer: `/opt/homebrew/bin/rsvg-convert`.
- Native engine: `/Library/TeX/texbin/pdflatex`.
- Final QA directory: `outputs/qa-chains-multiple-joins-2026-09-04-final/`.
- TikZKit SVG/PNG: `tikzkit-svg/` and `tikzkit-png/`.
- tikztosvg SVG/PNG: `tikztosvg-svg/` and `tikztosvg-png/`.
- MacTeX PNG: `mactex-png/`.
- 1cm grid overlays: `tikzkit-grid-svg/`, `tikzkit-grid-png/`,
  `tikztosvg-grid-svg/`, and `tikztosvg-grid-png/`.
- Inspected four-way sheets:
  - `diff/chains-multiple-joins-flowchart-native-sheet.png`
  - `diff/chains-multiple-joins-proof-chain-native-sheet.png`
  - `diff/chains-multiple-joins-signal-merge-native-sheet.png`

The sheets place MacTeX top-left, tikztosvg top-right, TikZKit bottom-left, and
the pixel diff bottom-right. The browser workbench was also inspected at
`http://127.0.0.1:5174/` with only TikZKit and tikztosvg shown over matching 1cm
grids. All three cases reported zero diagnostics and no console errors.

The tikztosvg SVGs use TeX glyph paths in `defs` plus `use`, matrix transforms,
butt line caps, miter joins, and independent filled arrow-tip paths. TikZKit
keeps live SVG text and renderer-scale viewBoxes, and emits its arrow tips as
independent transformed paths. Both use butt/miter stroke geometry and clip the
join endpoints to the same node borders. MacTeX remains authoritative where
text rasterization differs.

## Visual result

Before this slice, option parsing retained only the final `join` value. Each
new driver lost its blue upper-source edge and retained only the red dashed
lower-source edge. Running the three regression fixtures against unmodified
HEAD failed 3/3 for exactly that missing-edge condition.

After this slice:

- Flowchart: `Brief -> Implementation` and `Test plan -> Verification` use the
  shared chain hook; blue solid and red dashed arrows both converge on Release.
  Node clipping, colors, arrow direction, and line weights match. TikZKit is
  `304x142px` and tikztosvg is `305x142px`.
- Proof chain: both premise chains and both joins into `P(n), n >= 0` are present.
  Formula width and node centering visually match. TikZKit is `308x142px` and
  tikztosvg is `309x142px`.
- Signal merge: voltage and current chains both enter the summing node, then the
  readout chain continues automatically. Both outputs are exactly `390x142px`.

All three cases render through TikZKit, tikztosvg, and MacTeX with zero
diagnostics and zero external-render failures. Changed-pixel ratios are 7.96%,
6.43%, and 5.40%; inspection shows those residuals are predominantly text and
antialiasing, not missing paths or displaced geometry.

## Command and parameter audit

| Source item | Values exercised | Status |
| --- | --- | --- |
| `\documentclass[border=2pt]{standalone}` | 2pt crop border | accepted by fixture/reference shell |
| `\usepackage{tikz}` | all three cases | implemented package registration |
| `\usetikzlibrary{arrows.meta,chains}` | named arrow tips and chains | implemented for the exercised slice |
| `\begin{tikzpicture}[...]` | scoped keys and styles | implemented |
| `node distance` | `5mm and 10mm` | implemented two-axis chain spacing |
| `start chain=<name> going right` | nine named chains | implemented named chain state and direction |
| `.style` | `stage`, `state`, `block` | implemented named style expansion |
| `every on chain/.style={join}` | direct and inherited on-chain nodes | implemented after chain recognition |
| `every join/.style` | `Stealth`/`Latex`, `1.8mm`/`2mm`, `thick`/`very thick` | implemented before local join style |
| `\node`, named nodes, `on chain=<name>` | automatic and explicit `at` placement | implemented |
| `join=with <chain>-end by {...}` | two joins on one target node | implemented in source order |
| local join styles | blue; red plus dashed; local `<-` regression | implemented with conflict override |
| chain aliases | `<name>-begin`, `<name>-end`, `<name>-N` | implemented as real-node aliases |
| `\chainin` | inherited red join plus explicit blue join | implemented as two ordered actions |
| node geometry | rectangles, rounded corners `2pt`, circle `9mm` | implemented for these cases |
| minimum dimensions | widths `18/19/20mm`, heights `8mm` | implemented |
| fills | `blue!8/10`, `red!8/10`, `green!12/15`, `gray!10` | implemented color mixing |
| coordinates | `(0,1.4)`, `(0,-1.4)`, `(6,0)` | implemented canvas coordinates |
| math labels | subscripts, parentheses, `\Sigma`, `\geq` | implemented in SVG-text fallback |

No command or parameter in the three permanent fixtures is silently ignored.
The original proof draft used `\forall`; it was removed from this chains-only
driver because that glyph belongs to a separate math fallback slice.

## Verification

```sh
node --test test/chains-multiple-joins.test.js test/options.test.js
node --test test/interpreter.test.js
node --test test/tikz-cd.test.js
npm test
node scripts/render-example-fixtures.js --only chains-multiple-joins-flowchart --only chains-multiple-joins-proof-chain --only chains-multiple-joins-signal-merge --output outputs/qa-chains-multiple-joins-2026-09-04-final --native-reference --math-renderer svg-text --strict-tikztosvg
node scripts/diff-example-pngs.js --output outputs/qa-chains-multiple-joins-2026-09-04-final --alignment-radius 12
node scripts/build-extension-registry.js
```

The focused chains/options tests pass 11/11. The broad interpreter file remains
at its existing baseline of 270 passing and 18 unrelated failures. The tikz-cd
adapter retains its existing purple-alias failure while its hook/two-heads test
passes. An elevated full-suite comparison changed from HEAD's 1781 passing, 123
failing, and 14 skipped to 1787 passing, 123 failing, and 14 skipped. The six
new tests account for all added passes, and the failing-test name sets are
identical. The registry records 375 core cases and 12 chains cases.

## Remaining limits and next slice

- Join paths are still lowered as straight line segments rather than full TikZ
  `edge` operations, so `bend left/right`, `out/in`, `looseness`, edge nodes,
  and custom `to path` need a dedicated chains-edge slice.
- `join=with ... by ...` still needs a brace-depth-aware keyword scanner for a
  source node name containing the token `by` inside a group.
- Arbitrary `after node path` programs and path continuation after `\chainin`
  remain unsupported.

The next `chains` round should implement real edge geometry for join actions and
drive it with bent process-flow, proof-dependency, and signal-routing cases.
