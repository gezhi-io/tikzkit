# Declared Arrow Point Expressions QA

## Scope

This slice covers recursive point expressions inside user-defined legacy arrows declared with `\pgfarrowsdeclare`. The accepted family is `\pgfpointadd`, quick `\pgfqpointpolar`, ordinary `\pgfpointpolar`, one-radius polar points, and elliptical `x radius and y radius` points. All point dimensions may depend on the declaration's temporary registers and the active `\pgflinewidth`.

Arbitrary TeX branches or macros, transformed/intersection/scaled point commands, hulls, clipping, and saved-register callbacks remain outside this slice.

The permanent visual drivers are:

- `arrows-declared-pointadd-flowchart`: source-derived angle-60 process transitions using nested Cartesian and quick-polar points.
- `arrows-declared-polar-math`: source-derived open-triangle inclusion arrows using quick polar points around `\pgfpointorigin`.
- `arrows-declared-polar-physics`: filled thrust vectors using ordinary elliptical polar radii.

## Local Source Review

Reviewed these installed MacTeX/TeX Live files:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorepoints.code.tex`: `\pgfpointadd` evaluates and saves the first point, evaluates the second point, then adds both x/y components. `\pgfqpointpolar` multiplies one radius by degree-angle cosine and sine. `\pgfpointpolar` detects `and`, duplicates a single radius when needed, and evaluates independent x/y radii for elliptical polar coordinates.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.code.tex`: angle 60, triangle 60/45, and open triangle 60/45 declarations repeatedly combine half-d Cartesian offsets with quick polar points. Their drawing dimensions are recomputed from the active line width.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex`: declaration setup extents control shaft shortening while drawing points are transformed at the terminal.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorepathusage.code.tex`: qstroke and qfillstroke preserve distinct open and filled arrow semantics.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcoregraphicstate.code.tex`: round-cap and miter-join setters alter the declaration-local path state.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-base-points.tex`: documents vector addition, degree-angle polar coordinates, and the optional elliptical radius pair.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-arrows.tex`: documents the public angle and triangle legacy arrow families.

Implementation consequence: point parsing must be recursive and must run only after the active path line width is known. A flat `\pgfpoint{x}{y}` parser cannot represent the local PGF declarations.

## Reference Tools And Artifacts

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`
- MacTeX: `/Library/TeX/texbin/pdflatex`
- SVG rasterizer: `/opt/homebrew/bin/rsvg-convert`
- Before artifacts: `outputs/qa/2026-09-05-arrows-declared-points-before`
- After artifacts: `outputs/qa/2026-09-05-arrows-declared-points-after`
- tikztosvg SVG/PNG: `outputs/qa/2026-09-05-arrows-declared-points-after/tikztosvg-svg` and `tikztosvg-png`
- Four-panel sheets: `outputs/qa/2026-09-05-arrows-declared-points-after/diff/*-native-sheet.png`

## Visual Review

Before the change, TikZKit emitted one `Unsupported pgfarrowsdeclare drawing program` warning per fixture. Nodes, labels, axes, colors, and arrow shafts remained visible, but every custom arrowhead was absent and the shafts ended without declaration-driven terminal shortening. MacTeX and tikztosvg both rendered all arrowheads.

After the change:

- The flowchart shows all three angle-60 transition tips. The `.4pt`, `1pt`, and `1.6pt` heads increase in aperture and length with the active line width, retain round caps and miter joins, and stop the shafts at the declaration extents.
- The inclusion map shows all three closed open-triangle outlines with `fill=none`. Their polar vertices are centered around the declaration origin and rotate with horizontal and vertical path terminals.
- The force diagram shows all three elliptical-polar thrust tips. Each tip is filled and stroked with its vector color, uses independent x/y radii, and scales with the active line width.
- Diagnostics fell from three warnings to zero.

Manual four-panel inspection found no missing elements, incorrect rotations, paint changes, or layer changes after the repair. Remaining differences are browser-font glyph rasterization, antialiasing, and one-to-two-pixel crop dimensions; they do not alter the declared point geometry.

## SVG Structure

tikztosvg emits each tip as a separate path with a terminal matrix transform. Angle and open-triangle tips are stroke-only; the thrust tip has nonzero fill and matching stroke. The source cap/join and active stroke width are retained, while TeX text is represented by glyph paths.

TikZKit emits one local `.tikz-arrow-tip` path per terminal with explicit translate/rotate transforms. The local path data now contains the recursively evaluated Cartesian/polar points. `fill`, `stroke`, `stroke-width`, `stroke-linecap`, and `stroke-linejoin` follow the declaration, and the shaft endpoint uses the resolved declaration extent. Text remains SVG text with bundled fonts.

## Semantic Coverage

Implemented and strictly audited:

- Commands: `\pgfarrowsdeclare`, `\pgfpointadd`, `\pgfpoint`, `\pgfqpoint`, `\pgfpointorigin`, `\pgfpointpolar`, `\pgfqpointpolar`, path move/line/close, qstroke/qfillstroke, temporary dimensions, `\advance`, extent setters, and cap/join setters.
- Parameters: degree angles, one and two polar radii, active line widths, nested point arguments, stroke/fill paint, colors, terminal arrow selection, node positioning, and node styles.
- Numeric semantics: the source 30/145/150-degree angles, independent x/y radius factors, register coefficients, declaration extents, and `.4pt`/`1pt`/`1.6pt` active widths.

Not implemented in this slice: arbitrary TeX conditionals or macro-generated point programs, `\pgfpointtransformed`, `\pgfpointintersectionoflines`, `\pgfpointscale`/`\pgfqpointscale`, arrow hull commands, clipping, and saved-register callbacks.

## Verification

- `node --test test/arrows-declared-points.test.js test/arrows-declared-sizing.test.js`: 9 passed, 0 failed.
- Three strict semantic audits using the adjacent `.review.json` files: all accepted with no TODOs or blockers.
- MacTeX, TikZKit, and tikztosvg SVG/PNG regeneration for all three fixtures.
- Manual inspection of all three four-panel native sheets.
- `node --test test/arrows*.test.js test/declared-arrow-extents.test.js`: 81 passed, 0 failed.
- `npm run docs:links`: passed.
- `npm test`: 2206 passed, 132 existing baseline failures, 14 skipped; the failure count did not increase.
