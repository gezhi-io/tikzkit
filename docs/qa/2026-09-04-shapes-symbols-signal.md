# PGF shapes.symbols signal QA

## Scope

- Library slice: the `signal` node family from `shapes.symbols`.
- Accepted directions: `signal to`, `signal from`, `nowhere`, aliases for the
  four cardinal directions, and opposite horizontal or vertical pointers.
- Accepted geometry: `signal pointer angle`, natural content size,
  `minimum width`, `minimum height`, and `minimum size`.
- Accepted routing: signal compass anchors, asymmetric bounds, border clipping,
  and `positioning` placement against inward `from` anchors.
- Out of scope: the other `shapes.symbols` shapes, arbitrary shape rotation,
  incircle mode, and the complete base/mid/radial anchor family.

## Local source review

Reviewed the installed TeX Live 2025 sources and manual:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.symbols.code.tex:1410-2110`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryshapes.symbols.code.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shapes.tex:1007-1065`

The implementation follows these source details:

1. PGF applies `signal from` before `signal to`. A horizontal direction clears
   vertical directions and a vertical direction clears horizontal directions,
   so only an opposite pair can coexist.
2. Pointer extent uses `tan(90-angle/2)`, or equivalently `cot(angle/2)`, times
   the perpendicular half-size.
3. PGF enforces minimum height before minimum width and recomputes the pointer
   extent after each growth step. This preserves the requested pointer angle.
4. A `to` pointer moves the cardinal anchor to an outward apex. A `from`
   pointer moves the adjacent shoulder anchors outward while its cardinal
   anchor remains at the inward notch.
5. `right=of` and related placement uses those named anchors, not the visual
   bounding-box extrema. This matters for `signal from=west`.

One geometry record now drives layout, SVG path construction, bounds, named
anchors, and ray-to-polygon border clipping.

## Reference artifacts

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`.
- Rasterizer: `/opt/homebrew/bin/rsvg-convert`.
- Native engine: `/Library/TeX/texbin/pdflatex`.
- Before: `outputs/qa-shapes-symbols-signal-2026-09-04-before/`.
- After: `outputs/qa-shapes-symbols-signal-2026-09-04-after/`.
- Four-way native sheets:
  - `diff/shapes-signal-manual-catalog-native-sheet.png`
  - `diff/shapes-signal-data-pipeline-native-sheet.png`
  - `diff/shapes-signal-control-system-native-sheet.png`
- Saved reference SVGs: `tikztosvg-svg/`.
- Saved TikZKit SVGs: `tikzkit-svg/`.

The tikztosvg output agrees closely with MacTeX. Its geometry is a closed
nonzero-fill polygon under a y-flipping transform with butt caps and miter
joins. TikZKit emits the same visible polygon in canvas coordinates, with
`stroke-linecap="butt"` and `stroke-linejoin="miter"`; text remains SVG text
rather than the reference's glyph-outline paths.

## Visual result

Before this change, every signal rendered as a rectangle. Horizontal points
and notches were absent, arrows stopped on rectangular borders, and the
vertical catalog collapsed from the native 276 px height to 117 px.

After this change:

- The manual catalog visibly matches the six PGF topologies: east `to`, east
  `from`, west-to-east, 120-degree horizontal, north-and-south, and
  north-from/south-to.
- The 60, 75, and 120 degree pointer angles preserve their correct slopes.
- The data-flow output uses its inward west anchor for `right=of`, reducing the
  rendered width to 537 px against the 538 px local reference.
- Control-system arrows and the orthogonal feedback path meet signal contours
  at their actual polygon borders.
- Text remains centered inside all concave and pointed nodes.
- All three TikZKit, tikztosvg, and MacTeX renders completed with zero
  diagnostics and were inspected in the native four-way sheets.

Remaining visible differences are small font rasterization/subpixel offsets
and about 4 px of vertical crop difference in the catalog. They do not hide a
missing shape, misplaced node, or incorrect connection.

## Command and parameter audit

| Source item | Status | Implementation |
| --- | --- | --- |
| `\documentclass[border=4pt]{standalone}` | accepted wrapper | document extraction and crop margin |
| `\usepackage{tikz}` | implemented | package registry |
| `\usetikzlibrary{shapes.symbols,positioning,arrows.meta}` | implemented for used slices | library registries |
| `\begin{tikzpicture}[>=Stealth]` | implemented | scoped default arrow tip |
| `every node/.style`, `io/.style`, `process/.style`, `block/.style`, `flow/.style` | implemented | style expansion |
| `\node[signal]` and `shape=signal` | implemented | signal layout and SVG renderer |
| `signal to`, `signal from`, `nowhere` | implemented | PGF-compatible direction precedence |
| `signal to=east and west`, `signal to=north and south` | implemented | opposite pointer pairs |
| `signal pointer angle=60/70/75/120` | implemented | source-derived pointer trigonometry |
| `minimum width`, `minimum height`, `minimum size` | implemented | signal-specific growth order |
| `draw`, `fill`, `rounded corners`, `align`, `inner sep` | implemented for fixture usage | shared node styles |
| `right=of`, `left=of`, `below=of`, `node distance` | implemented | named-anchor positioning |
| `\draw[->,thick]` and `--`, `-|`, `++(x,y)` | implemented | path builder and arrow renderer |
| `(node.south)` and automatic border endpoints | implemented | compass anchors and polygon clipping |
| inline `node[above]`, `node[pos=.25,below]` | implemented | path-node positioning |
| `$x'$`, `$\hat y$`, `$r(t)$`, `$K(s)$`, `$\sum$` | implemented | browser math text |

No command or parameter used by these three focused fixtures is silently
ignored. The library remains `partial` because the other symbols and the
out-of-scope signal modes are not complete.

## Verification

```sh
node --test test/shapes-symbols-signal.test.js test/shapes-geometric-cylinder.test.js test/library-modules.test.js
node scripts/render-example-fixtures.js --only shapes-signal-manual-catalog,shapes-signal-data-pipeline,shapes-signal-control-system --output outputs/qa-shapes-symbols-signal-2026-09-04-after --native-reference --strict-tikztosvg --continue-on-external-failure --math-renderer svg-text
node scripts/diff-example-pngs.js --output outputs/qa-shapes-symbols-signal-2026-09-04-after
npm run extension-registry
```

The focused geometry, renderer, positioning-anchor, and module-boundary suite
passes 13/13. The three real fixtures render through all three engines without
diagnostics. A broader 320-test renderer/interpreter run passes 308 tests; its
12 failures are pre-existing formula fallback, text wrapping, ball shading,
and legacy bounds expectations outside this signal slice.

## Next slice

Continue `shapes.symbols` with one complete, independently verifiable shape
family. The strongest candidates are `tape`/`magnetic tape` or `forbidden
sign`, selected by current corpus usage and visual severity.
