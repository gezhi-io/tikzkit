# Declared Arrow Sizing QA

## Scope

This slice covers user-defined legacy arrows declared with `\pgfarrowsdeclare` when their geometry depends on the active path line width. It includes two dimension registers, assignment, `\advance`, `\pgflinewidth`, `\pgfpoint`/`\pgfqpoint`, dynamic backend/line-end/tip-end values, path construction, cap/join state, and qfill/qstroke/qfillstroke paint. Arbitrary TeX control flow, hulls, clipping, saved-register callbacks, point addition, and polar points are outside this slice.

The permanent visual drivers are:

- `arrows-declared-sizing-flowchart`: a filled cubic process arrow at `.4pt`, `1pt`, and `1.6pt`.
- `arrows-declared-sizing-math`: a stroke-only open map arrow with butt caps and miter joins.
- `arrows-declared-sizing-physics`: a fill-and-stroke force arrow with two working registers.

## Local Source Review

Reviewed these installed MacTeX/TeX Live files:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex`: `\pgfarrowsdeclare` maps legacy setup/drawing blocks to PGF arrow declarations; left/right extents become backend/tip-end dimensions, and setup is evaluated with the active graphic state.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.code.tex`: `latex'`, `open triangle 90`, and `triangle 90` assign temporary dimensions, advance them by fractions of `\pgflinewidth`, repeat the sizing calculation in drawing code, and use different paint/cap/join rules.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorepoints.code.tex`: `\pgfpoint` parses dimensions while `\pgfqpoint` directly assigns already-computed dimensions.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcoregraphicstate.code.tex`: declaration drawing code selects butt/round caps and miter/round joins in the current graphic state.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorepathusage.code.tex`: path paint is a distinct declaration decision: fill, stroke, or fillstroke.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-library-arrows.tex`: public legacy arrow names and their intended visible families.

Implementation consequence: declaration programs must remain renderer-neutral data until a path's line width is known. Precomputing geometry once at declaration time produces incorrect tip size and shaft shortening.

## Reference Tools And Artifacts

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`
- MacTeX: `/Library/TeX/texbin/pdflatex`
- SVG rasterizer: `/opt/homebrew/bin/rsvg-convert`
- Before artifacts: `outputs/qa/2026-09-05-arrows-declared-sizing-before`
- After artifacts: `outputs/qa/2026-09-05-arrows-declared-sizing-after`
- tikztosvg SVG/PNG: `outputs/qa/2026-09-05-arrows-declared-sizing-after/tikztosvg-svg` and `tikztosvg-png`
- Four-panel sheets: `outputs/qa/2026-09-05-arrows-declared-sizing-after/diff/*-native-sheet.png`

## Visual Review

Before the change, TikZKit emitted `Unsupported pgfarrowsdeclare drawing program` for all three cases. Nodes, axes, labels, and shafts rendered, but every custom arrowhead was absent.

After the change:

- The flowchart has three filled cubic process tips. Their visible size increases with `.4pt`, `1pt`, and `1.6pt`, matching the MacTeX/tikztosvg behavior instead of reusing one fixed tip.
- The mathematical map has three open triangular tips with stroke-only paint, butt caps, and miter joins. The shaft ends at the declaration's dynamic line end instead of crossing the open head.
- The force diagram has three filled-and-stroked tips. The second temporary register controls the rear extent, and each shaft is shortened to the active-width result.
- Diagnostics fell from one unsupported-program warning per case to zero.

The four-panel inspection still shows small text baseline/glyph-rasterization and node-border crop differences. These are text/bbox follow-ups, not missing or fixed-size arrow geometry. Raw whole-image pixel ratios are therefore only supporting data; the acceptance signal is the restored, correctly painted, line-width-dependent tips and shaft endpoints.

## SVG Structure

tikztosvg emits each arrow as a separate path with a transform and nonzero fill rule. Open-map tips are stroke-only; force tips use separate fill/stroke paint; its common state uses butt caps and miter joins unless the declaration changes them. Text is converted to TeX glyph paths in `<defs>`.

TikZKit keeps local arrow path data in the scene, then emits one translated/rotated `.tikz-arrow-tip` path per terminal. The generated path coordinates, stroke width, fill, cap, join, and route shortening now change with the active path line width. Text remains SVG text with bundled fonts, which explains the remaining raster differences.

## Semantic Coverage

Implemented and strictly audited in these cases:

- Commands: `\pgfarrowsdeclare`, `\advance`, `\pgfarrowsleftextend`, `\pgfarrowsrightextend`, `\pgfarrowssetbackend`, `\pgfarrowssetlineend`, `\pgfarrowssettipend`, `\pgfpathmoveto`, `\pgfpathlineto`, `\pgfpathcurveto`, `\pgfpathclose`, `\pgfusepathqfill`, `\pgfusepathqstroke`, `\pgfusepathqfillstroke`, cap/join setters, and temporary dimension registers.
- Parameters: active `line width`, declared arrow selection, colors, node positioning/styles, path paint, cap, and join.
- Numeric semantics: register base dimensions, multiplicative coefficients, `\advance` coefficients, path control points, declaration extents, and `.4pt`/`1pt`/`1.6pt` active widths.

Not implemented in this slice: arbitrary nested TeX macros or conditionals in declaration programs, `\pgfarrowshullpoint`, clipping, saved register callbacks, `\pgfpointadd`, and `\pgfqpointpolar`.

## Verification

- `node --test test/arrows*.test.js test/declared-arrow-extents.test.js`: 77 passed, 0 failed.
- Three strict semantic audits using the adjacent `.review.json` files: all accepted with no blockers.
- MacTeX, TikZKit, and tikztosvg regeneration for all three fixtures.
- Manual inspection of all three four-panel native sheets.
- `npm run docs:links`: passed.
- `npm test`: 2202 passed, 132 existing baseline failures, 14 skipped; the failure count did not increase.
