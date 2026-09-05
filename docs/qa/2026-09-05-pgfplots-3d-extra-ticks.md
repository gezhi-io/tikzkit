# PGFPlots 3D extra ticks QA

## Scope

This round implements one bounded PGFPlots family: `extra x ticks`, `extra y
ticks`, and `extra z ticks` on linear or logarithmic 3D axes. It includes
independent labels and templates, `extra <axis> tick style`, global `every
extra <axis> tick`, visible-box tick strokes, extra-only major grids, and
extra-label participation in the 3D parent bounds.

Symbolic coordinates, arbitrary executable TeX label callbacks, and exact
compound `shift` plus text-bbox calibration remain outside this slice.

## Local source review

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`
  - Lines 1044-1090 define independent `every extra x/y/z tick` defaults and
    keep obscured extra ticks visible.
  - Lines 1481-1526 register axis-specific extra values, labels, templates,
    and styles.
  - Lines 6696-6704, 10035-10039, and 10180-10184 show that extra data values
    pass through the same linear or logarithmic coordinate transforms as
    ordinary ticks.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotsticks.code.tex`
  - Lines 888-935 run a separate extra-tick pass on the current oriented
    surface after ordinary ticks.
  - The pass disables scaled/minor ticks, then independently emits major grid
    lines, tick strokes, and labels with the extra style scope.

## Commands and parameters

Implemented and exercised here: `\begin{axis}`, `\addplot3`, `\addplot3[surf]`,
`extra x/y/z ticks`, `extra x/y/z tick labels`, `extra x/y/z tick label`,
`extra x/y/z tick style`, `every extra x/y/z tick`, `tick style`, `tick label
style`, `grid=major`, `grid style`, `xmode/ymode/zmode=log`, `log basis x/y/z`,
`xtick/ytick/ztick`, `view`, `width`, and `height`.

Not fully implemented: symbolic extra coordinates, arbitrary executable TeX
callbacks inside label templates, and exact bounding boxes for combined
arbitrary shifts and complex formula nodes.

## Visual drivers

- `pgfplots-3d-extra-ticks-algorithm`: TikZKit previously omitted the 3D extra
  pass. It now shows the blue rotated `handoff` x annotation and red `budget`
  z annotation, with short strokes on the corresponding projected box edges.
- `pgfplots-3d-extra-ticks-math`: base-10 x values 5 and 50 and base-2 y value
  8 now occupy their logarithmically transformed positions while ordinary
  power ticks and minor ticks remain unchanged.
- `pgfplots-3d-extra-ticks-physics`: the red `alarm 10^1` z annotation appears
  between `10^0` and `10^2`; its dashed major grid is projected onto exactly
  two visible box faces and its 0.8pt tick style is independent of normal
  ticks.

All three TikZKit results contain every expected element with zero diagnostics.
The remaining visible difference is general 3D annotation/crop calibration,
most apparent in the physics panel; no extra-tick label or line is clipped.

## SVG structure

`/Library/TeX/texbin/tikztosvg` emits the physics extra grid as two separate
paths with butt caps, miter joins, a 0.3985pt stroke, and a 2.98883pt dash
pattern. Extra tick strokes use 0.79701pt. TikZKit emits the same two projected
face paths with semantic 0.4pt dashed grid styling and 0.8pt red tick strokes.
Both keep labels separate from path geometry; tikztosvg uses glyph definitions
and `use`, while TikZKit keeps semantic SVG text.

## Artifacts

All outputs are under
`outputs/qa/2026-09-05-pgfplots-3d-extra-ticks/`:

- TikZKit SVG/PNG: `tikzkit-svg/`, `tikzkit-png/`
- tikztosvg SVG/PNG/input: `tikztosvg-svg/`, `tikztosvg-png/`,
  `tikztosvg-input/`
- MacTeX PNG/log: `mactex-png/`, `mactex-log/`
- 1cm-grid panels: `tikzkit-grid-png/`, `tikztosvg-grid-png/`
- registered diffs and four-way sheets: `diff/`

Commands used: `/Library/TeX/texbin/tikztosvg`,
`/Library/TeX/texbin/pdflatex`, and `/opt/homebrew/bin/rsvg-convert`.

## Verification

The focused extra-tick/log/3D selection passes 25/25. This includes the
minimal missing z tick, three-axis composition, log projection, extra-only
grid, browser-level global z style, long-label parent bounds, and related 2D
and z-log regressions.

The repository-wide suite reports 2428 tests: 2285 pass, 129 fail, and 14 are
skipped. The failure count is unchanged from the pre-existing baseline; for
example, the manifest still reports the unrelated missing semantic owner for
`circuitikz-varcap-diodes`. This round adds six passing tests without adding a
regression. Documentation-link validation passes.

```sh
node --test test/pgfplots-3d-extra-ticks.test.js test/pgfplots-extra-ticks.test.js test/pgfplots-zlog-axes.test.js test/pgfplots-3d-tick-labels.test.js
node scripts/render-example-fixtures.js --output outputs/qa/2026-09-05-pgfplots-3d-extra-ticks --only pgfplots-3d-extra-ticks-algorithm --only pgfplots-3d-extra-ticks-math --only pgfplots-3d-extra-ticks-physics --native-reference --strict-tikztosvg --continue-on-external-failure --tikztosvg-engine pdflatex --math-renderer svg-text
node scripts/diff-example-pngs.js --output outputs/qa/2026-09-05-pgfplots-3d-extra-ticks --register --alignment-radius 8
npm test
npm run docs:links
```
