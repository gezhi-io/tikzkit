# PGFPlots Patchplots Line QA

## Scope

This slice implements only the core linear form of
`\addplot3[patch,patch type=line] ... coordinates {...}`. Each consecutive
pair of finite 3D vertices becomes one projected, open `A -> B` segment. It
is shared PGFPlots lowering in `src/pgfplots/surface.js`, not a special-case
for the fixture.

The real driver is `test/fixtures/examples/pgfplots/patchplots-line.tex`:

```tex
\addplot3[patch,patch type=line,line width=1.2pt]
  coordinates {(0,0,0) (2,2,2)};
```

## Local MacTeX Study

Read the installed sources:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotsmeshplothandler.code.tex`;
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`;
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/libs/tikzlibrarypgfplots.patchplots.code.tex`.

The core mesh handler defines `line` as a two-vertex patch: it stores `A`,
then `B`, and its fill-path callback emits an *open* `A -> B` path. The
patchplots library supplies higher-order classes but does not redefine this
linear primitive. `pgfplots.code.tex` defines the default `hot` colormap as
blue -> yellow -> orange -> red and gives faceted faces a `mapped color!80!black`
outline. Therefore the fixture midpoint at `z=1` uses orange `#ffbf00`; it is
not an arbitrary browser orange.

## Command And Option Inventory

| Item | Status | Meaning in this slice |
| --- | --- | --- |
| `\usepgfplotslibrary{patchplots}` | partial | resolves to the dedicated library module |
| `\begin{axis}` + `view={45}{30}` | supported | existing 3D axis projection |
| `xmin/xmax`, `ymin/ymax`, `zmin/zmax` | supported | finite range and frame mapping |
| `\addplot3` + `coordinates` | supported | keeps finite input pairs in source order |
| `patch` | supported | selects a linear mesh primitive |
| `patch type=line` | supported | consumes each pair as one open segment |
| `line width=1.2pt` | supported | preserves the requested stroke width |
| default `hot` mapped color | supported | maps the pair midpoint on the default colormap |
| `fill` / faceted outline | not applicable | an open line neither fills nor closes; faceted outlines remain face-only |

Not implemented: tables, point-meta streams, per-vertex interpolation,
`shader=interp`, explicit `faceted color` overrides, quadratic/biquadratic/
Coons patches, PDF shading, and user-defined patch classes.

## References And Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; its SVG was
rasterized with `/opt/homebrew/bin/rsvg-convert`. Native output used local
`/Library/TeX/texbin/pdflatex`.

The baseline is in `outputs/qa-pgfplots-patchplots-line-before-2026-08-06/`.
The inspected after artifacts are in
`outputs/qa-pgfplots-patchplots-line-2026-08-06/`:

- MacTeX native PNG: `mactex-png/pgfplots-patchplots-line.png`;
- TikZKit SVG/PNG: `tikzkit-svg/pgfplots-patchplots-line.svg` and
  `tikzkit-png/pgfplots-patchplots-line.png`;
- tikztosvg SVG/PNG: `tikztosvg-svg/pgfplots-patchplots-line.svg` and
  `tikztosvg-png/pgfplots-patchplots-line.png`;
- grid SVG/PNG: `tikzkit-grid-svg/`, `tikzkit-grid-png/`,
  `tikztosvg-grid-svg/`, and `tikztosvg-grid-png/`;
- four-panel comparison sheets: `diff/pgfplots-patchplots-line-native-sheet.png`
  in each output directory.

The tikztosvg SVG is one `M A L B` path with `fill="none"`,
`stroke-linecap="butt"`, `stroke-linejoin="miter"`, and a `1.19553` stroke
width. It has no `Z` close command and no filled area. Its stroke is the
orange `rgb(100%, 74.848938%, 0%)`, confirming both the path topology and the
default mapped-colour interpretation.

## Visual Result

Before the fix, the TikZKit panel drew only the 3D frame, ticks, and labels:
the reference orange diagonal from the origin to the projected `(2,2,2)`
corner was entirely missing.

After the fix, the TikZKit panel visibly contains the same single orange,
open diagonal in the same projected direction and between the same axis
corners as MacTeX and tikztosvg. It does not close into a triangular face and
does not add a fill. The three-way sheets still show a global canvas/axis and
glyph-metric difference, which is deliberately left outside this narrow
linear-patch acceptance boundary.

The registered changed-pixel ratio changed from 10.41% to 11.01% and mean
absolute RGBA residual from 0.03093 to 0.03150. Those global numbers are not
the acceptance measure here: adding a previously absent, high-contrast line
increases differing pixels while restoring the required object. Visual
acceptance is the recovered ordered open segment.

## Implementation And Verification

- `src/pgfplots/surface.js`: shared two-vertex line lowering and native default
  mapped-colour lookup; the same lookup now gives triangle/rectangle mesh
  outlines their native darkened mapped colour.
- `src/pgfplots/addplotLowering.js`: routes a line patch before generic surface
  grid inference.
- `src/pgfplots/index.js`, `src/internal.js`, and
  `src/pgfplots/libraries/patchplots.js`: expose and register the expanded
  partial library surface.
- `test/pgfplots-patchplots.test.js`: asserts exactly one open line, no fill or
  close path, the `hot` midpoint colour, and the TeX point width conversion.
- `test/fixtures/examples/pgfplots/patchplots-line.tex` plus manifest: keep the
  real source driver.
- `docs/extension-registry.{csv,md}`: generated metadata now has five
  patchplots cases and all three implementation owners.

```bash
node --test test/pgfplots-patchplots.test.js test/pgfplots-library-modules.test.js
node scripts/gallery-audit.js --only pgfplots-patchplots-line
npm run extension-registry
npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-pgfplots-patchplots-line-2026-08-06 \
  --only pgfplots-patchplots-line --native-reference \
  --comparison-grid-mode svg --strict-tikztosvg --external-timeout-ms 120000
npm run examples:diff -- --output outputs/qa-pgfplots-patchplots-line-2026-08-06 \
  --register --alignment-radius 3
```

Focused regression tests pass, and the one-fixture semantic audit reports
`271/271 rendered, 0 diagnostics`.

## Next Slice

Implement a separate high-order patch family or a narrowly scoped
per-vertex-mapped interpolation path. It needs the real ordered control-point
and shader semantics from the local patchplots sources; it should not be
hidden inside this open two-vertex primitive.

## 2026-09-06 Perspective Annotation Follow-up

The line itself was already present, but this fixture exposed a shared 3D
axis defect: the `x=2` and `y=0` labels at the lower projected corner were
only about `0.21cm` apart and appeared as `20` in the browser. This follow-up
keeps the acceptance boundary to boxed perspective annotation geometry and
the built-in `hot` color stops used by the line patch.

Additional local source review:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotscoordprocessing.code.tex`, especially `\pgfplotspointouternormalvectorofaxis` and the near-ticklabel anchor calculation;
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`, for the 3D `ticklabel cs` midpoint and `anchor=near ticklabel` defaults;
- `pgfplots.libs.patchplots.tex` inside `/usr/local/texlive/2025/texmf-dist/doc/latex/pgfplots/pgfplots.doc.src.tar.bz2`, confirming that the library adds high-order patch classes while the line class remains the base two-vertex handler.

PGFPlots computes an outer normal by taking the two fixed coordinate-axis
projection vectors, choosing each boundary's outward sign, normalizing the
two vectors independently, adding them, and normalizing the result. A simple
screen-space perpendicular to the visible edge is not equivalent under an
oblique 3D projection. TikZKit now follows the source algorithm. The shared
corner label centers are `0.349cm` apart in the focused regression and render
as separate `2` and `0` glyphs in the browser. The built-in `hot` colormap
also keeps explicit PGF RGB stops, producing `rgb(255 191.5 0)` at the
midpoint versus tikztosvg's rasterized `rgb(255 190.86 0)`.

The before and after directories both contain TikZKit SVG/PNG, tikztosvg
SVG/PNG, MacTeX PNG, registered diffs, and four-panel native sheets:

- `outputs/qa/2026-09-06-pgfplots-patchplots-line-before/`
- `outputs/qa/2026-09-06-pgfplots-patchplots-line-after/`

The after render has zero diagnostics. Visual inspection confirms that the
open diagonal, its endpoints, `1.2pt` stroke, butt linecap, miter join, and
clip behavior remain intact while the lower tick collision is removed.
Focused patchplots and 3D-label tests pass `10/10`; the full suite finishes
with `2361` passing, `134` existing failures, and `14` skipped, improving the
pre-change baseline by one passing test with no new failures.
