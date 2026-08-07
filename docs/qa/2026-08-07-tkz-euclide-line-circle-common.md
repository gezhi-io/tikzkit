# tkz-euclide `common` Line-Circle Result Ordering

## Scope And Acceptance Target

This slice implements only the result ordering of
`\tkzInterLC[common=<point>]`. It does not broaden the line-circle solver or
add new construction forms. The acceptance target is local MacTeX; local
`tikztosvg` is an additional SVG reference.

The regression source is
[`test/fixtures/examples/tkz-euclide/line-circle-common-result.tex`](../../test/fixtures/examples/tkz-euclide/line-circle-common-result.tex).
It starts with a known contact `C`, calls
`\tkzInterLC[common=C](C,H)(M,B)`, then binds its results as
`{Other}{Common}`. The required visible result is blue `common C` at the upper
contact and orange `other` at the lower contact.

## Local MacTeX Reading

- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-euclide/tkz-tools-eu-intersections.tex`
  calculates the `common` point's distance to `tkzSecondPointResult`; it swaps
  the two aliases only when that distance is not below `1pt`. Therefore the
  requested common contact is intentionally the second result.
- `/usr/local/texlive/2025/texmf-dist/doc/latex/tkz-euclide/TKZdoc-euclide-intersection.tex`
  documents `common=pt` as returning the *other* contact through
  `\tkzFirstPoint`, while `near` returns the first contact nearest the first
  line point. These selectors are not interchangeable.
- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-euclide/tkz-obj-eu-points.tex`
  supplies the named construction points consumed by the intersection module.

## Implemented Source Surface

| Source construct | Verified behavior |
| --- | --- |
| `\usepackage{tikz}` | Ordinary path, fill, node, color, and scale lowering |
| `\usepackage{tkz-euclide}` | Preprocess extension enabled |
| `\tkzDefPoint(x,y){name}` | Named source-coordinate construction point |
| `\tkzInterLC(line)(circle)` | Two line-circle contacts |
| `\tkzInterLC[common=C]` | Keeps `C` as `tkzSecondPointResult` |
| `\tkzGetPoints{Other}{Common}` | First name receives the other contact; second receives `C` |
| `tikzpicture[scale=1.25]` | Paint geometry scales without changing result identity |
| `gray!60`, `blue`, `orange` | Path/node color options |
| `2cm`, `1pt`, `1.3pt`, `2pt`, `1.25` | Circle radius, mark sizes, document border, and picture scale |

The fixture's strict semantic review is
[`line-circle-common-result.review.json`](../../test/fixtures/examples/tkz-euclide/line-circle-common-result.review.json).
It explicitly records every discovered command, option, and numeric literal.

## tikztosvg And Visual Evidence

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`.

Artifacts are under
[`outputs/qa-tkz-euclide-common/`](../../outputs/qa-tkz-euclide-common/):

- MacTeX: `mactex-png/tkz-euclide-line-circle-common-result.png`
- TikZKit: `tikzkit-svg/` and `tikzkit-png/`
- tikztosvg: `tikztosvg-svg/` and `tikztosvg-png/`
- Comparison sheet: `diff/tkz-euclide-line-circle-common-result-sheet.png`

The tikztosvg output uses a `161.88pt` by `167.85pt` viewBox, paints the circle
and construction line as transformed SVG paths, and stores TeX labels as glyph
outline groups. Its blue and orange fill groups locate `common C` and `other`
at the same two contacts as MacTeX. TikZKit uses its browser/SVG text path, so
its canvas is `214x221px` against tikztosvg's `216x224px`; the remaining diff
is crop/font rasterization, not a geometric or ordering change.

Before this patch, TikZKit applied the `near` rule to `common`: the named common
point became the first result, visibly swapping the blue and orange labels.
After the patch all three panels place blue `common C` at the upper contact and
orange `other` at the lower contact. Rendering completed with zero TikZKit,
tikztosvg, or MacTeX diagnostics.

## Verification

```bash
node --test test/case-semantic-audit.test.js test/tkz-euclide.test.js
npm run case:audit -- test/fixtures/examples/tkz-euclide/line-circle-common-result.tex \
  --review test/fixtures/examples/tkz-euclide/line-circle-common-result.review.json \
  --strict
npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-tkz-euclide-common \
  --only tkz-euclide-line-circle-common-result \
  --native-reference --comparison-grid-mode svg
npm run examples:diff -- --output outputs/qa-tkz-euclide-common
```

All commands pass for this slice. Remaining `tkz-euclide` construction families
remain partial as listed in the extension registry.
