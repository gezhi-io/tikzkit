# PGFPlots Open Axes And `unit vector ratio*` QA

## Scope

This slice corrects one shared 2D PGFPlots rule: an open left/bottom axis with
`unit vector ratio*` must use the final enlarged transform interval when it
fits its physical x/y units. It also separates edge axes from genuine
zero-centered middle axes during surveyed-range expansion.

The real driver is
`test/fixtures/examples/latex-examples/countable-sets.tex`, copied from the
LaTeX examples corpus. The accepted boundary is the combination below:

```tex
axis lines*=left,
enlarge y limits=false,
enlarge x limits={upper,abs=0.02},
unit vector ratio*={1 1 1},
width=6cm
```

This is not a claim of complete PGFPlots equal-axis support. Non-star
`unit vector ratio`, macro/expression-valued components, custom basis vectors,
logarithmic equal-unit fitting, and 3D `axis equal image` keep their existing
partial boundaries.

## Command And Option Inventory

The fixture was audited rather than reduced to a hand-written coordinate
example. Its relevant surface is:

| Item | Status in this driver | Notes |
| --- | --- | --- |
| `\usepackage{pgfplots}` | partial | owns this axis/addplot subset |
| `\usepackage{sansmath}` | partial | existing browser sans-math subset |
| `\begin{tikzpicture}` / `\begin{axis}` | supported in this slice | normal picture and 2D axis lowering |
| `compat=newest` | accepted | no version-specific layout switch here |
| `font=\sansmath\sffamily` | partial | existing font subset |
| `xlabel`, `ylabel`, `xmin=0`, `ymin=0` | supported | standard 2D labels and lower bounds |
| `axis lines*=left` | supported | left and bottom only, never a center axis |
| `enlarge y limits=false` | supported | disables the y reserve |
| `enlarge x limits={upper,abs=0.02}` | supported in this slice | one absolute upper transform reserve |
| `unit vector ratio*={1 1 1}` | supported in this slice | equal x/y physical tick distance after fitting |
| `width=6cm`, `try min ticks=5`, `tick align=center` | supported | 2D plot-box/tick planning subset |
| `legend style={draw=none,at={(1,1)},anchor=north}` | partial | this top-right placement works; full legend matrix layout is separate |
| `\addplot table {function.data}` | supported | local `filecontents` table is resolved |
| `mark=square*`, `mark size=0.5em` | supported | filled square marks |
| `nodes near coords`, `\coordindex`, `\pgfmathparse`, `\pgfmathresult` | partial | the tested integer label template is lowered |
| `every node near coord/.style` | partial | tested font/color/center anchor subset |
| `\addlegendentry` | supported in this driver | single legend row |

## Local MacTeX Study

Reviewed local TeX Live 2025 sources:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.scaling.code.tex`,
  the axis scaling and plot-box fit path around lines 2450-2700 and 2849-2912.
  The important rule is that basis/unit scaling uses the actual transformed
  coordinate range; the star form may reduce the requested box to preserve
  physical units.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`,
  lines 887-916. `xlabel near ticks`/`ylabel near ticks` anchor descriptions
  through tick-label coordinates, rather than treating open axes as a box.

The implementation follows only the first rule for literal
`unit vector ratio*`; it deliberately leaves `axis equal image` on its earlier
3D-oriented range semantics.

## References And Artifacts

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`. Native compilation uses the local MacTeX
`pdflatex` installation.

The inspected artifact root is
`/private/tmp/tikzkit-qa-pgfplots-open-left-axis-after-2026-08-06/`:

- MacTeX PNG:
  `mactex-png/latex-examples-countable-sets.png`;
- TikZKit SVG/PNG:
  `tikzkit-svg/latex-examples-countable-sets.svg` and
  `tikzkit-png/latex-examples-countable-sets.png`;
- tikztosvg SVG/PNG:
  `tikztosvg-svg/latex-examples-countable-sets.svg` and
  `tikztosvg-png/latex-examples-countable-sets.png`;
- matched 1cm-grid variants:
  `tikzkit-grid-png/` and `tikztosvg-grid-png/`;
- inspected native/JS/tikztosvg/diff sheet:
  `diff/latex-examples-countable-sets-native-sheet.png`.

The tikztosvg SVG has a `154.99pt` by `135.32pt` viewBox and separate tick
paths. Its horizontal unit steps are `20.373pt` and its vertical steps are
`20.372pt`, which confirms equal physical units after the `x=5.02` transform
range is established. It uses transformed path/glyph geometry, not an SVG
equal-scale attribute.

## Visual Result

Before the change, `axis lines*=left` was incorrectly classified as a middle
axis. Range survey added a default 10% x expansion and geometry then added the
requested absolute reserve: the transform became `0..5.52`. The JS plot box
was 3.953cm wide by 3.593cm high, so its x ticks were visibly farther apart;
the final column and upper-right legend were pushed right compared with both
references.

After the change, left/bottom edge axes retain the surveyed range `0..5`; the
absolute reserve produces exactly `0..5.02`, and the star unit ratio fits a
5.02:5 plot box. In the inspected four-panel sheet the JS, tikztosvg, and
MacTeX point lattice has matching square cells, while the top-right legend and
the final `x=5` column occupy the same grid region. TikZKit's final canvas is
208x181px versus tikztosvg's 207x181px, a one-pixel tight-crop/antialiasing
residual rather than the former horizontal geometry error.

The registered TikZKit-vs-MacTeX residual is 10.22% changed pixels with mean
absolute RGBA 0.02395; tikztosvg-vs-MacTeX is 9.18% and 0.01531. These values
are supporting evidence only; the accepted improvement is the visibly
corrected physical scale and placement.

## Implementation And Verification

- `src/pgfplots/rangeResolver.js`: zero-preserving survey expansion now asks
  for a true `middle`/`center` axis, so `left`/`bottom` edge axes do not receive
  the unrelated 10% middle-axis expansion.
- `src/pgfplots/geometry.js`: literal `unit vector ratio*` calculates its
  fitted aspect from `axisTransformRanges`; `axis equal image` is intentionally
  unchanged.
- `test/pgfplots-csv-overlay.test.js`: the regression goes through
  `createAxisOptions()`, proves the public range is `0..5`, transformed x max
  is `5.02`, and verifies equal mapped x/y unit lengths.
- `README.md`, `src/packages/pgfplots.js`, and generated
  `docs/extension-registry.{md,csv}` document the supported subset and its
  limits.

```bash
node --test --test-name-pattern='absolute upper enlargement is applied once and preserves unit-scale axes' \
  test/pgfplots-csv-overlay.test.js
node --test --test-name-pattern='unit vector ratio|axis equal image' \
  test/extensions.test.js
npm run examples:render -- --output /private/tmp/tikzkit-qa-pgfplots-open-left-axis-after-2026-08-06 \
  --only latex-examples-countable-sets --native-reference --strict-tikztosvg \
  --comparison-grid-mode svg
node scripts/diff-example-pngs.js \
  --output /private/tmp/tikzkit-qa-pgfplots-open-left-axis-after-2026-08-06 --register
npm run extension-registry
```

The two focused regression tests pass. The real fixture generated all three
reference families without diagnostics and the artifacts were visually
inspected. Broad PGFPlots suites still include unrelated known layout failures,
so they are not presented as a green acceptance gate for this narrow slice.

## Next Work

1. Extend literal star-ratio coverage to logarithmic axes and non-1:1 values.
2. Audit the non-star ratio and custom PGFPlots basis-vector keys against the
   same MacTeX source path.
3. Continue legend matrix, arbitrary TeX label template, and final text/bbox
   calibration independently of axis-coordinate semantics.
