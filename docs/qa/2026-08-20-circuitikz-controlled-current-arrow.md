# Circuitikz controlled-current arrow

## Scope

This focused slice covers the American controlled-current source (`cI`) only:
the diamond, its internal shaft, the filled `currarrow` polygon, and the
`current arrow scale` setting. It does not claim the broader Circuitikz source
catalogue.

## Local source review

Reviewed the local TeX Live 2025 files:

- `pgfcircbipoles.tex`, lines 3559-3586: American `cisource` draws a local
  shaft from `-.7` to `.7` source radii, then places `currarrow` at `.5` source
  radii along the element direction.
- `pgfcircshapes.tex`, lines 413-450: `currarrow` is a closed, filled polygon
  with tail `-.7 * Rlen/current arrow scale`, tip `+1 * Rlen/current arrow
  scale`, and lateral corners at `+/- .8` of the same unit.
- `pgfcirc.defines.tex`, line 1147: `current arrow scale` defaults to `16`.
- `circuitikzmanual.tex`, lines 3946-3964: larger current-arrow-scale values
  make the arrow smaller.

## Visual QA

Real fixtures:

- `test/fixtures/examples/circuitikz/controlled-sources.tex`
- `test/fixtures/examples/circuitikz/controlled-sinusoidal-sources.tex`

Artifacts are generated under
`outputs/qa-circuitikz-controlled-sources-2026-08-20-after/`:

- `tikzkit-svg/` and `tikzkit-png/`
- `tikztosvg-svg/` and `tikztosvg-png/`
- `native-png/`
- `diff/` and the comparison sheets

`/Library/TeX/texbin/tikztosvg` was used as the SVG reference and its output
was rasterized with `/opt/homebrew/bin/rsvg-convert`.

Before this change, TikZKit used a large generic `latex` SVG marker inside the
American controlled current source. The MacTeX and tikztosvg outputs instead
use a compact filled quadrilateral situated in the upper half of the diamond.
The implementation now follows that source-defined geometry and has a
regression test for the default placement and `current arrow scale=8`.

For `controlled-sources`, registered TikZKit-to-tikztosvg changed pixels fell
from `2698` (`6.1777%`, mean absolute RGBA `0.015659`) to `2676`
(`6.1274%`, `0.015329`). Against the MacTeX PNG, the same panel fell from
`2726` (`6.2418%`) to `2704` (`6.1915%`). The sinusoidal companion is retained
as a no-regression case; it does not use the American controlled-current
`currarrow` branch.

## Remaining limits

The controlled-source family remains partial: nonstandard custom source
symbols, all source-specific fill overrides, and controlled square/triangular
waveforms are outside this slice.
