# PGFPlots extra ticks QA

## Scope

This round implements the linear 2D PGFPlots extra-tick family:
`extra x ticks`, `extra y ticks`, explicit and templated extra labels,
`extra tick style`, axis-specific extra tick styles, global
`every extra x/y tick` styles, tick/grid drawing, and label shifts.

3D and logarithmic extra ticks, symbolic coordinates, arbitrary TeX label
callbacks, and exact outside-label bounding-box expansion remain outside this
slice.

## Local source review

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`
  - Extra tick lists, labels, and styles are stored independently per axis.
  - `extra tick style` appends to the direction-specific extra tick styles.
  - Each oriented axis runs its ordinary pass before a separate extra-tick
    pass.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplotsticks.code.tex`
  - The extra pass disables scaled and minor ticks, replaces the regular label
    callback, filters values to the axis range, and uses positional explicit
    label lists.
  - Extra grids, major ticks, and labels are emitted in that order.
- `/usr/local/texlive/2025/texmf-dist/doc/latex/pgfplots/pgfplots.doc.src.tar.bz2`
  (`pgfplots.reference.tickoptions.tex`)
  - Extra ticks do not change automatic ordinary tick placement.
  - They are always major ticks and use the major tick length.
  - `grid=major` also applies to extra ticks; `every extra x/y tick` and the
    axis-specific style keys customize their pass.

## Visual drivers

`latex-examples-birthday-paradox` uses both `extra x ticks={23}` and
`extra y ticks={0.507297}`. Before the fix, TikZKit retained the two guide
lines but omitted the `23` and `0.51` labels and their short tick marks. After
the fix, both labels, ticks, and corresponding major grid lines are visible at
the same data positions as MacTeX and tikztosvg.

`latex-examples-landtagswahlen-in-bayern` uses an extra y tick to identify the
5 percent level. Before the fix, the axis jumped directly from 0 to 10. After
the fix, TikZKit visibly includes the `5 %` label, short y tick, and grid line,
matching the two references. The crowded earliest date labels are a separate
pre-existing date-axis issue and were not changed in this round.

Diagnostics remain at zero for both cases before and after the change.

## SVG structure

`/Library/TeX/texbin/tikztosvg` generated reusable glyph outlines in
`defs`/`use` elements and a point-sized `viewBox`; it did not use SVG marker
elements for these cases. TikZKit retains semantic SVG `text` nodes with
translation transforms. The birthday labels are positioned at the same data
coordinates in all three renderings; their remaining glyph-outline and
font-raster differences are renderer-level, not tick-placement differences.

## Artifacts

- Before: `outputs/qa/2026-09-05-pgfplots-extra-ticks-before/`
- After: `outputs/qa/2026-09-05-pgfplots-extra-ticks-after/`
- TikZKit SVG/PNG: `tikzkit-svg/`, `tikzkit-png/`
- tikztosvg SVG/PNG/input: `tikztosvg-svg/`, `tikztosvg-png/`,
  `tikztosvg-input/`
- MacTeX PNG/log: `mactex-png/`, `mactex-log/`
- Four-panel native/tikztosvg/TikZKit/diff sheets:
  `diff/latex-examples-birthday-paradox-native-sheet.png` and
  `diff/latex-examples-landtagswahlen-in-bayern-native-sheet.png`

## Verification

The focused set passes 10/10. It includes extra ticks at a middle-axis
crossing, explicit-minor-tick isolation, symmetric x/y minor tick styles, and
composition of global and local nested extra-label styles. A clean `HEAD`
archive and the working tree were
also run against the complete PGFPlots test selection: the baseline was
406 tests with 363 passing and 43 failing; the working tree is 415 tests with
372 passing and the same 43 failures. This slice therefore adds nine passing
tests without adding a PGFPlots regression. The repository-wide suite is not
currently clean (2254 of 2404 pass, 136 fail, and 14 are skipped), so it is not
reported as passing here. Documentation-link validation passes.

```sh
node --test test/pgfplots-extra-ticks.test.js test/birthday-paradox.test.js
node --test test/pgfplots-*.test.js test/birthday-paradox.test.js
npm test
npm run docs:links
node scripts/render-example-fixtures.js --output outputs/qa/2026-09-05-pgfplots-extra-ticks-after --only latex-examples-birthday-paradox --only latex-examples-landtagswahlen-in-bayern --native-reference --tikztosvg-engine pdflatex --math-renderer svg-text --comparison-grid-mode svg --strict-tikztosvg
node scripts/diff-example-pngs.js --output outputs/qa/2026-09-05-pgfplots-extra-ticks-after --only latex-examples-birthday-paradox --only latex-examples-landtagswahlen-in-bayern
```
