# TikZ `topaths` Explicit Cubic Controls

Date: 2026-09-04

## Scope

This slice implements explicit cubic controls for ordinary `to`/`edge` paths
and `chains` joins:

- `out control=<coordinate>`
- `in control=<coordinate>`
- `controls=<out coordinate> and <in coordinate>`
- absolute and endpoint-relative `+(...)`/`++(...)` control coordinates
- independent explicit or automatic computation for each control arm
- source-order switching when a later looseness or distance key replaces an
  explicit control on the same side
- cubic-tangent node-border clipping and arrow orientation

The slice does not claim arbitrary custom `to path` callbacks or preservation
of repeated identical option keys after options have been reduced to an
object.

## Local TeX Live Review

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarytopaths.code.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-edges.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.meta.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/shapes/pgflibraryshapes.geometric.code.tex`

The source registers separate start and end compute callbacks. `out control`
replaces only the start callback, `in control` replaces only the end callback,
and `controls` installs the incoming value before the outgoing value. A later
same-side looseness or distance key restores the automatic callback. The
ordinary branch inserts the selected values into `.. controls A and B ..`.
The relative branch instead computes both controls from the chord-relative
angles and looseness, so explicit controls are intentionally not used there.

The manual confirms that `+(...)` for `out control` is relative to the start
coordinate while `+(...)` for `in control` is relative to the end coordinate.
For node endpoints, the first and last cubic tangents determine border
intersection and arrow orientation.

## Reference Tools And Artifacts

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`
- `rsvg-convert`: `/opt/homebrew/bin/rsvg-convert`
- `pdflatex`: `/Library/TeX/texbin/pdflatex`
- Before: `outputs/qa-to-path-controls-2026-09-04-before-v2`
- Accepted: `outputs/qa-to-path-controls-2026-09-04-final`
- TikZKit SVG/PNG: `tikzkit-svg/`, `tikzkit-png/`
- tikztosvg SVG/PNG: `tikztosvg-svg/`, `tikztosvg-png/`
- MacTeX PNG: `mactex-png/`
- Four-panel sheets and diffs: `diff/`, `diff-png/`

The tikztosvg output uses cubic `C` path data, `stroke-linecap="butt"`,
`stroke-linejoin="miter"`, transformed TeX coordinates, and separate filled
arrow-tip paths. TikZKit now emits the same cubic topology and terminal
tangents, with live SVG text instead of tikztosvg's outlined TeX glyphs. In
the flowchart, for example, the upper controls are the same 1.45cm vertical
offsets after accounting for TikZKit's 100-units-per-centimeter scene scale.

## Visual Results

### Flowchart

Before, both explicit return routes collapsed onto straight edges and their
`verify` and `repair` labels overlapped the main row. After the fix, the upper
and lower loops match MacTeX/tikztosvg in direction, peak, endpoint tangent,
diamond/rectangle border clipping, and label placement. TikZKit is 323x132px;
both references are 324x133px. The changed-pixel ratio against tikztosvg fell
from 47.11% to 8.62%.

### Mathematics

Before, `g` and `h \circ f` collapsed onto the straight `f` arrow, producing
one merged line and overlapping labels. After the fix, the absolute upper
control pair and endpoint-relative lower pair form three distinct morphisms
with the same Latex-tip tangents as both references. TikZKit is 241x136px;
both references are 241x138px. The changed-pixel ratio fell from 35.51% to
6.37%.

### Physics

Before, `p_+` and `p_-` were both straight and overlapped the dashed optical
axis, lens, and phase annotation. After the fix, the symmetric upper controls
and asymmetric lower controls route around the lens; labels and arrows are
again distinct. TikZKit is 323x127px; both references are 324x124px. The
remaining height difference is the live-text phase-label box, not missing
path geometry. The changed-pixel ratio fell from 43.55% to 9.88%.

## Source Audit

### `to-path-control-flowchart`

Dependencies: `tikz`; libraries `arrows.meta`, `shapes.geometric`, and
`topaths`. Commands/environments: `documentclass`, `usepackage`,
`usetikzlibrary`, `begin`, `end`, `document`, `tikzpicture`, `node`, and
`path` with `edge` and inline edge nodes.

Options: standalone `border`; local `stage`, `gate`, and `flow` styles;
`draw`, `rounded corners`, `minimum width`, `minimum height`, `align`,
`diamond`, `aspect`, `Stealth[length]`, `thick`, `fill`, `controls`,
`out control`, `in control`, `above`, and `below`.

Numbers: 2pt border and corner radius; 20mm x 8mm stage; 18mm x 10mm gate;
aspect 2; tip length 2mm; color mixes 8, 18, and 10 percent; node coordinates
0, 3.2, and 6.4cm; upper control offsets `(0,1.45)`; lower offsets
`(0,-1.25)`.

### `to-path-control-math`

Dependencies: `tikz`; libraries `arrows.meta` and `topaths`.
Commands/environments: the same document shell, `node`, and `path` with
`edge`; math content includes `\circ`.

Options: `object` and `morphism` styles; `draw`, `circle`,
`minimum size=12mm`, `inner sep=1pt`, `Latex[length=2mm]`, `thick`, `fill`,
`controls`, `out control`, `in control`, `above`, and `below`.

Numbers: 2pt border; object size 12mm; inner separation 1pt; tip length 2mm;
color mixes 8 and 10 percent; node coordinates 0 and 5cm; absolute controls
`(1.2,1.6)` and `(3.8,1.6)`; relative controls `(1,-1.35)` and
`(-1,-1.35)`.

### `to-path-control-physics`

Dependencies: `tikz`; libraries `arrows.meta` and `topaths`.
Commands/environments: the document shell, `node`, `path`, and `draw`;
math content includes `\Delta` and `\phi`.

Options: `device` and `ray` styles; `draw`, `minimum width=20mm`,
`minimum height=9mm`, `align`, `Stealth[length=2mm]`, `very thick`, `circle`,
`minimum size=10mm`, `fill`, `controls`, `out control`, `in control`, `above`,
`below`, `densely dashed`, and `gray`.

Numbers: 2pt border; device size 20mm x 9mm; lens size 10mm; tip length 2mm;
color mixes 10, 8, and 10 percent; node coordinates 0, 3.2, and 6.4cm;
upper controls `(1.25,1.55)` and `(-1.25,1.55)`; lower controls
`(1.1,-1.2)` and `(-1.5,-0.8)`; phase-label offset 2mm.

All listed dependencies, commands, environments, options, and numeric values
are covered by focused tests, strict semantic reviews, and saved visual
artifacts. All three renders emit zero diagnostics.

## Verification

- `node --test test/to-path-controls.test.js` (11 passed)
- `node scripts/render-example-fixtures.js --output outputs/qa-to-path-controls-2026-09-04-final --only to-path-control-flowchart --only to-path-control-math --only to-path-control-physics --native-reference --strict-tikztosvg`
- `node scripts/diff-example-pngs.js --output outputs/qa-to-path-controls-2026-09-04-final`
- `node scripts/case-semantic-audit.js <fixture> --review <review> --strict`
- `npm run extension-registry`
- `node --test test/web-server.test.js` (5 passed)
- `npm test` (1949 tests: 1812 passed, 123 existing baseline failures,
  14 skipped; no failure increase)

Acceptance: passed for this bounded explicit-control family.
