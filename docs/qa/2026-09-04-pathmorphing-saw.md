# Pathmorphing Saw QA, 2026-09-04

## Scope

This slice implements the `saw` decoration from `decorations.pathmorphing` for straight, polyline, and cubic paths. It covers `amplitude`, `segment length`, `pre length`, `post length`, signed amplitude, `mirror`, `raise`, and explicit `path has corners`. It does not claim the other pathmorphing decorations.

## Local PGF Review

Reviewed these installed TeX Live 2025 files:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/decorations/pgflibrarydecorations.pathmorphing.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduledecorations.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/tikzlibrarydecorations.code.tex`
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcoretransformations.code.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-decorations.tex`

The installed declaration advances one `segment length` per full state. It draws first to local `(segment length, amplitude)` and then to `(segment length, 0)`. When less than one segment remains, `auto end on length` draws the remaining distance without another tooth. `auto corner on length` is active only when `path has corners` is explicitly enabled; it finishes at the input-segment corner and restarts the state in the next segment's tangent frame. PGF applies `mirror` and `raise` as an additional transform after installing that local frame. Amplitude is signed rather than clamped to a nonnegative value.

## Reference Pipeline

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`
- Rasterizer: `/opt/homebrew/bin/rsvg-convert`
- Before artifacts: `/private/tmp/qa-pathmorphing-saw-before`
- Accepted artifacts: `outputs/qa-pathmorphing-saw-2026-09-04`
- Browser fixtures: `test/fixtures/examples/output/decorations-pathmorphing-saw-*`

The reference SVGs encode saw teeth directly as one path containing line segments. They do not use an SVG marker. Stroke line caps and joins are inherited from the path style. On a curved source path, each tooth is transformed by the tangent and normal at its PGF state origin. The final short state remains on the transformed baseline, while an explicit post section returns to the undecorated source endpoint.

## Visual Findings

Before the change, TikZKit rendered only the original straight or cubic path; all teeth were absent. MacTeX and `tikztosvg` both showed matching tooth phase, tooth direction, and undecorated pre/post sections.

After the change:

- The flowchart has the same tooth count and phase as MacTeX, including the mirrored and raised red transition and its terminal arrow connection.
- The mathematics example matches the straight signed-amplitude orientation and the local-normal orientation along a cubic path.
- The physics example follows the incline tangent with the same mirrored rough-contact teeth, spacing, and endpoints.
- Remaining raster differences are TeX glyph outlines, antialiasing, and a one-pixel crop-height variation. No saw geometry is missing or displaced.

## Implemented Syntax

- `decorate`
- `decoration={saw,...}`
- `amplitude=<dimension>`, including negative values
- `segment length=<dimension>`
- `pre length=<dimension>`
- `post length=<dimension>`
- `mirror`
- `raise=<dimension>`
- `path has corners`
- Straight, polyline, and cubic input paths

## Remaining Work

`random steps`, `bent`, `bumps`, `straight zigzag`, and expanding-wave decorations are not part of this slice. Text-decoration behavior and decoration markings are owned by separate libraries.
