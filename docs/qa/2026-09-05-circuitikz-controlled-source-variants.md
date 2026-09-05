# Circuitikz empty and cute controlled-source variants

## Scope

- Library slice: the public empty and cute European controlled-source bodies.
- Implemented aliases: `ecsource`, `empty controlled source`, `cvsourceC`, `cceV`, `cute european controlled voltage source`, `cisourceC`, `cceI`, and `cute european controlled current source`.
- Implemented parameters: `csources/scale`, path stroke color and width, component `fill`, `l=` labels, horizontal and vertical placement.
- Out of scope: general controlled-source style dispatch, tripoles, custom source bodies, and source types not listed by Circuitikz 1.8.3. In particular, no controlled square/triangle aliases were invented because the installed upstream package does not define them.

## Local source review

- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircbipoles.tex:3385` defines `ecsource` as a closed, draw-or-fill diamond with no internal symbol.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircbipoles.tex:3602` defines `cvsourceC`: the internal horizontal line runs from `0.6 * left` to `0.6 * right`, uses round caps, and has width `3 * bipoles/thickness * pgfstartlinewidth`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircbipoles.tex:3624` gives `cisourceC` the corresponding vertical internal line from `0.6 * up` to `0.6 * down`.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/circuitikz/pgfcircbipoles.tex:3844`, `:3908`, and `:3966` declare the short and long public aliases.
- `/usr/local/texlive/2025/texmf-dist/doc/latex/circuitikz/circuitikzmanual.tex:2950` lists the seven controlled-source body families and confirms the empty/cute names used by the fixture.

The implementation therefore reuses the shared controlled-source diamond and lead geometry. It adds only the source-defined empty/cute dispatch and the local-axis internal line calculation; no fixture coordinates are copied into the evaluator.

## Reference artifacts

- `tikztosvg`: `/Library/TeX/texbin/tikztosvg`
- native engine: `/Library/TeX/texbin/pdflatex`
- SVG rasterizer: `/opt/homebrew/bin/rsvg-convert`
- fixture: `test/fixtures/examples/circuitikz/controlled-source-variants.tex`
- artifact root: `outputs/qa/2026-09-05-circuitikz-controlled-source-variants/`
- TikZKit SVG/PNG: `tikzkit-svg/` and `tikzkit-png/`
- tikztosvg SVG/PNG: `tikztosvg-svg/` and `tikztosvg-png/`
- MacTeX PNG: `mactex-png/`
- three-way and diff sheets: `diff/`

The tikztosvg SVG uses dvisvgm path transforms and glyph outlines. TikZKit emits direct scene-graph paths and SVG text. Both now use the same diamond coordinates, local-axis orientation, explicit body fill, 0.6 internal-line span, round line caps, and miter-joined exterior. The canvas is `368 x 220` pixels for all three outputs, with registered offset `(0,0)`.

## Visual result

Before the change, all eight public names were unrecognized as Circuitikz bodies: the path reduced to plain leads, so the empty diamonds and the cute voltage/current symbols were absent.

After the change, the fixture visibly contains six controlled-source diamonds. The two empty aliases have no interior mark. The two voltage aliases have a thick horizontal stroke, and the two current aliases have a thick vertical stroke in component-local coordinates, so vertical components rotate correctly. The red `fill=red!10`, blue/green/red strokes, three math labels, lead lengths, and `csources/scale=1.15` are all preserved. The internal lines are now three times the component outline width rather than the initial incorrect 1.5 ratio.

As auxiliary evidence, TikZKit versus MacTeX differs on 3.519% of pixels with mean absolute RGBA 0.00525; TikZKit versus tikztosvg differs on 3.524% with mean 0.00359. The remaining visible difference is mostly text glyph rasterization and browser path antialiasing. There are no missing components, coordinate offsets, or diagnostic regressions in the focused case.

## Command and parameter audit

| Source item | Status | Implementation |
| --- | --- | --- |
| `\documentclass[border=2pt]{standalone}` | accepted wrapper | document extraction and border-aware fixture tooling |
| `\usepackage{circuitikz}` | implemented for this slice | package registry and `circuitikz` environment alias |
| `\begin{circuitikz}` | implemented | TikZ picture evaluation |
| `\ctikzset{csources/scale=1.15}` | implemented | shared controlled-source size calculation |
| `\draw[color] ... to[...] ...` | implemented | path evaluator, leads, component-local transforms |
| `ecsource`, `empty controlled source` | implemented | empty draw-or-fill diamond |
| `cvsourceC`, `cceV`, long voltage alias | implemented | cute voltage body and horizontal local symbol |
| `cisourceC`, `cceI`, long current alias | implemented | cute current body and vertical local symbol |
| `fill=red!10` | implemented | component fill without leaking into the internal line |
| `l=$...$` | implemented | Circuitikz component labels and math text |

No command or parameter used by the focused fixture is silently ignored. Circuitikz remains `partial` for the unsupported families recorded in the extension registry.

## Verification

```sh
node --test test/circuitikz-controlled-source-variants.test.js test/circuitikz-controlled-sinusoidal-sources.test.js test/circuitikz-controlled-sources.test.js
node scripts/render-example-fixtures.js --only circuitikz-controlled-source-variants --output outputs/qa/2026-09-05-circuitikz-controlled-source-variants --native-reference --continue-on-external-failure --strict-tikztosvg --tikztosvg-engine pdflatex --math-renderer svg-text
node scripts/diff-example-pngs.js --output outputs/qa/2026-09-05-circuitikz-controlled-source-variants --register
```

Focused result: 6 tests passed, 0 failed. Full regression result: 2422 tests,
2279 passed, 129 failed, and 14 skipped. Compared with the preceding baseline
(2421 total, 2278 passed, 129 failed, 14 skipped), this slice adds one passing
test and no failures or skips. The existing failures include the pre-existing
`circuitikz-varcap-diodes` manifest entry without a semantic owner; this slice's
new manifest entry resolves to concrete evaluator functions.
