# Circular Shadows and Glow QA (2026-08-08)

## Scope

This slice implements the two documented `shadows` library styles that were
previously accepted as options but did not create a shadow preaction:

- `circular drop shadow`;
- `circular glow`.

The boundary is deliberately limited to those two styles and their standard
`circle with fuzzy edge 15 percent` path fading. It does not claim arbitrary
TikZ path-fading declarations or arbitrary `every shadow` TeX callbacks.

## Local PGF Review

Reviewed MacTeX source:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibraryshadows.code.tex`, lines 58-93;
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-shadows.tex`.

The local source defines both styles as `general shadow` preactions. The
important ordering is: style defaults, `every shadow`, then the caller's
argument. `circular drop shadow` uses `shadow scale=1.1`,
`shadow xshift=.3ex`, `shadow yshift=-.3ex`, `fill=black!50`, and
`path fading={circle with fuzzy edge 15 percent}`. `circular glow` uses scale
`1.25`, zero shifts, the same black fill, and the same fading. A shadow is
painted before the foreground and does not enlarge the picture bounding box.

TikZKit now lowers those declarations through the existing general-shadow
preaction path and registers radial fading defs from shadow styles as well as
foreground styles.

## Real Driver and Coverage Inventory

Maintained real-style fixture:
`test/fixtures/examples/shadows/circular-shadow-path.tex`.

Source inventory:

| Source construct | Result |
| --- | --- |
| `\\documentclass[border=2pt]`, `\\usepackage{tikz}`, `\\usetikzlibrary{shadows}` | Parsed without diagnostics; library registration is active. |
| `\\begin{tikzpicture}` / `\\end{tikzpicture}` | Implemented. |
| `\\draw[help lines,gray!35] (0,0) grid (5,3)` | Existing grid/path/style support. |
| `\\filldraw` with `circle` and `rectangle` geometry | Existing compound paint path support. |
| `circular drop shadow={opacity=.8}` | Implemented: source scale `1.1`, source `.3ex/- .3ex` offset, radial fading, then caller opacity. |
| `circular glow={fill=purple!70}` | Implemented: source scale `1.25`, zero offset, radial fading, then caller fill. |
| `fill=yellow!30`, `fill=white`, `draw=black`, `gray!35`, `purple!70` | Implemented color mixes and paint order. |
| Numeric geometry `(0,0)`, `(5,3)`, `(1.25,1.25)`, `.55`, `(3,.75)`, `(4.5,2.15)` | Implemented coordinate, radius, and rectangle geometry. |

Still partial: custom fading declarations and transforms, arbitrary fading
names, argumented or code-backed `every shadow` hooks, shading propagation,
marker-tip shadows, and arbitrary TeX preaction code.

## Three-way Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. Artifacts are intentionally ignored by Git:

`/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-shadows-circular-fading-after-2026-08-08/`

It contains all four reviewed artifact families:

- `mactex-png/shadows-circular-shadow-path.png`;
- `tikzkit-svg/` and `tikzkit-png/`;
- `tikztosvg-svg/` and `tikztosvg-png/`;
- grid panels in `tikzkit-grid-*` and `tikztosvg-grid-*`, plus
  `diff/shadows-circular-shadow-path-native-sheet.png` and
  `diff-png/shadows-circular-shadow-path-registered.png`.

The generated TikZKit SVG uses a named radial gradient and mask for the
documented fading. Each shadow is a `tikz-path-shadow` group: the circle is
translated by the `.3ex/- .3ex` canvas offset and scaled by `1.1` about its
own center, while the glow is scaled by `1.25` about the rectangle center.
This mirrors the local `general shadow` construction. The inspected
`tikztosvg` SVG uses its TeX-derived transformed path output; its PNG confirms
the same underneath-before-foreground fade and source geometry.

## Visual Acceptance

Before this slice, the two options did not lower to shadow preactions: the
yellow circle and white rectangle appeared with no soft offset shadow or glow.

After this slice, the inspected native sheet shows all three renderers with:

- a soft grey circle shadow behind and down-right of the yellow foreground;
- a larger purple radial glow under the white rectangle;
- foreground outlines and fills above the fading layer;
- matching shadow/glow centers, scale direction, and clipping behavior.

The registered TikZKit/tikztosvg comparison is 195x119px with 108 changed
pixels (about 0.00465) and mean absolute RGBA 0.000087. These figures only
support the visual review. The native comparison retains small shared
TeX/SVG fading and font rasterization differences, not a missing JS element or
a mismatched geometric preaction.

## Verification

```bash
node --test --test-name-pattern='circular drop shadows and glows|drop-shadow defaults|general shadows as path preactions' test/interpreter.test.js

npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-shadows-circular-fading-after-2026-08-08 \
  --only shadows-circular-shadow-path \
  --tikztosvg --native-reference --grid --strict-tikztosvg \
  --external-timeout-ms 120000

npm run examples:diff -- --output outputs/qa-shadows-circular-fading-after-2026-08-08 \
  --register --alignment-radius 3
```

All five focused tests passed. The real fixture rendered with zero TikZKit
diagnostics and all MacTeX, TikZKit, tikztosvg, grid, sheet, and diff artifacts
were generated and inspected.

## Files Changed

- `src/engine/evaluate.js`
- `src/renderers/svg/defs.js`
- `src/tikz/libraries/shadows.js`
- `test/interpreter.test.js`
- `test/fixtures/examples/shadows/circular-shadow-path.tex`
- `test/fixtures/examples/manifest.json`
- `docs/extension-registry.csv`
- `docs/extension-registry.md`
