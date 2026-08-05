# PGFPlots Patchplots Rectangle QA

## Scope

This slice adds only the linear four-vertex form of
`\addplot3[patch,patch type=rectangle] ... coordinates {...}`. Each
consecutive stream of four finite 3D points becomes one projected, closed
`A -> B -> C -> D -> A` face. It is shared PGFPlots lowering in
`src/pgfplots/surface.js`; it does not infer a sampled surface grid and does
not special-case the fixture coordinates.

The driver is `test/fixtures/examples/pgfplots/patchplots-rectangle.tex`:

```tex
\addplot3[patch,patch type=rectangle,draw=black,fill=cyan!50]
  coordinates {(0,0,0) (2,0,1) (2,2,2) (0,2,1)};
```

## Local MacTeX Study

Read the local core implementation:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotsmeshplothandler.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`

The `rectangle` patch class documents its vertex order as `A -> B -> C -> D`.
Its `set next vertex` handler stores exactly four vertices, and `fill path`
issues one closed `A, B, C, D` path. Its `triangulate` branch is reserved for
triangle-only render paths and explicitly suppresses the shared diagonal; it
is not the normal faceted rectangle output. `pgfplots.code.tex` establishes
the default faceted outline as `mapped color!80!black`, independent from an
ordinary `draw=...` plot key.

The installed `patchplots` library source remains
`/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/libs/tikzlibrarypgfplots.patchplots.code.tex`.
It extends the core linear patch handler with high-order patch classes. There
is no dedicated installed patchplots manual under the TeX Live generic
PGFPlots documentation directory, so no nonexistent local document is
claimed.

## Command And Option Inventory

| Item | Status | Meaning in this slice |
| --- | --- | --- |
| `\usepgfplotslibrary{patchplots}` | partial | resolves to the dedicated library module |
| `\begin{axis}` + `view={45}{30}` | supported | existing 3D axis projection |
| `xmin/xmax`, `ymin/ymax`, `zmin/zmax` | supported | finite range and frame mapping |
| `\addplot3` + `coordinates` | supported | preserves finite 3D input order |
| `patch` | supported | activates a linear patch path |
| `patch type=rectangle` | supported | consumes each consecutive four points as one face |
| `fill=cyan!50` | supported | paints the face cyan |
| `draw=black` | parsed; native mesh rule used | generic plot draw does not replace the PGFPlots default faceted mesh rule |
| `opacity`, `z buffer=none` | supported | controls alpha and preserves source paint order; otherwise faces sort by depth |

The linear `patch type=line` follow-up is documented in
[the line-patch QA record](2026-08-06-pgfplots-patchplots-line.md). Tables,
point-meta input, per-vertex interpolation, `shader=interp`, explicit
`faceted color` fidelity, quadratic, biquadratic, and Coons patches, PDF
shading, and user-defined patch classes remain out of scope.

## References And Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; its SVG was rasterized
with `/opt/homebrew/bin/rsvg-convert`. Native output used local
`/Library/TeX/texbin/pdflatex`.

The baseline is in `outputs/qa-pgfplots-patchplots-rectangle-before-2026-08-06/`.
The inspected after artifacts are in
`outputs/qa-pgfplots-patchplots-rectangle-2026-08-06/`:

- MacTeX native PNG: `mactex-png/pgfplots-patchplots-rectangle.png`;
- TikZKit SVG/PNG: `tikzkit-svg/pgfplots-patchplots-rectangle.svg` and
  `tikzkit-png/pgfplots-patchplots-rectangle.png`;
- tikztosvg SVG/PNG: `tikztosvg-svg/pgfplots-patchplots-rectangle.svg` and
  `tikztosvg-png/pgfplots-patchplots-rectangle.png`;
- 1cm-grid variants: `tikzkit-grid-svg/`, `tikzkit-grid-png/`,
  `tikztosvg-grid-svg/`, and `tikztosvg-grid-png/`;
- four-panel MacTeX comparison sheet:
  `diff/pgfplots-patchplots-rectangle-native-sheet.png`.

The tikztosvg structure is one closed filled/stroked SVG path with
`stroke-linecap="butt"`, `stroke-linejoin="miter"`, `stroke-width="0.3985"`,
and `M A L B L C L D Z` geometry. There is no internal diagonal. This is the
direct evidence for using one Scene Graph fill plus one mesh-outline path.

## Visual Result

Before the fix, TikZKit passed the four coordinate points to generic surface
grid inference. That reordered the vertices and produced a visibly misplaced
cyan face: it spanned the wrong projected corners and failed to share the
reference parallelogram's upper and lower edges.

After the fix, MacTeX, tikztosvg, and TikZKit all show the same cyan
four-sided plane from the origin through the right-hand top corner and back
through the left mid-height corner. The 3D frame, labels, ticks, and the face
position now agree. The subsequent line-patch source study also corrected the
shared default mesh outline to the native darker mapped orange. Final canvas
bounds and TeX/browser glyph rasterization still differ and remain separate
bbox/font work, not hidden as full parity.

The registered changed-pixel ratio is not the acceptance metric here: it rose
from 23.93% to 24.85% because the corrected face covers the proper larger
projected area, while mean absolute RGBA residual improved from 0.04715 to
0.03869. The visual acceptance is the recovered ordered quadrilateral and
the removed bad grid reordering.

## Implementation And Verification

- `src/pgfplots/surface.js`: shared linear patch stream lowering for triangle
  and rectangle vertices.
- `src/pgfplots/addplotLowering.js`: routes rectangle patches before generic
  surface-grid inference.
- `src/pgfplots/libraries/patchplots.js`: records the expanded partial scope.
- `test/pgfplots-patchplots.test.js`: asserts a single four-edge fill and mesh
  loop; no implicit diagonal is generated.
- `test/fixtures/examples/pgfplots/patchplots-rectangle.tex` and manifest:
  preserve the real visual driver.
- `docs/extension-registry.{csv,md}`: generated registry now lists four
  patchplots cases and both implementation owners.

```bash
node --test test/pgfplots-patchplots.test.js test/pgfplots-library-modules.test.js
node scripts/gallery-audit.js --only pgfplots-patchplots-rectangle
npm run extension-registry
npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-pgfplots-patchplots-rectangle-2026-08-06 \
  --only pgfplots-patchplots-rectangle --native-reference \
  --comparison-grid-mode svg --strict-tikztosvg --external-timeout-ms 120000
npm run examples:diff -- --output outputs/qa-pgfplots-patchplots-rectangle-2026-08-06 \
  --register --alignment-radius 3
```

Focused regression tests pass, and the one-fixture semantic audit reports
`270/270 rendered, 0 diagnostics`.

## Next Slice

`patch type=line` and default mapped-color/faceted-outline semantics are now
covered by the follow-up [line QA record](2026-08-06-pgfplots-patchplots-line.md).
High-order patch classes, interpolation, and shading need their own
TeX-source-driven design and should not be folded into this linear path.
