# tkz-fct Independent Axis Labels QA

## Scope

This slice implements the native `tkz-base` separation between independent
axis drawing and numeric graduations:

- `\tkzLabelX[...]` and `\tkzLabelY[...]`
- the thin wrappers `\tkzAxeX[...]` and `\tkzAxeY[...]`

It deliberately does not change `\tkzAxeXY`, general pgfplots axes, or the
global `xlabel style` / `ylabel style` configuration hooks.

## Local MacTeX Reading

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-base/tkz-obj-axes.tex`
  (`\tkzLabelX`, `\tkzLabelY`, `\tkzAxeX`, `\tkzAxeY`)
- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-base/tkz-base.cfg`
- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-base/tkz-tools-print.tex`
  (`\tkzPrintFrac`, `\tkzPrintFracWithPi`)
- `/usr/local/texlive/2025/texmf-dist/doc/latex/tkz-base/TKZdoc-base-axes.tex`

The source puts labels at the tick endpoint, not at the mathematical axis
origin. A label value is `localPosition * xstep + xorigin` (or the y
equivalent). `step` is expressed in source units. The bare `orig` key has
`.default=false`, so it hides the zero label when the range crosses zero and
hides the local minimum on same-sign ranges. Fraction and trigonometric labels
are reduced rational forms.

## Implemented Commands And Options

`\tkzLabelX` and `\tkzLabelY` implement `step`, `trig`, `frac`, `orig`,
`color`, `text`, `tickwd`, `tickup`, `tickdn`, `ticklt`, `tickrt`, and normal
TikZ node placement/font options such as `below=...`, `left=...`,
`below right=...`, `text=...`, and `node font=...`.

`\tkzAxeX` lowers to `LabelX` followed by `DrawX`; `\tkzAxeY` lowers to
`DrawY` followed by `LabelY`, matching the installed wrapper order.

Still partial: `np off` does not reproduce the TeX `numprint` package's number
formatting; configured `xlabel style` / `ylabel style` hooks are not evaluated;
and arbitrary TeX label macros remain dependent on the shared TeX-lite layer.

## Visual Evidence

Source: `outputs/qa-tkz-axis-labels/numeric-only.tex`.

Generated artifacts (ignored by Git):

- MacTeX: `outputs/qa-tkz-axis-labels/numeric-native.png`
- TikZKit: `outputs/qa-tkz-axis-labels/numeric-tikzkit.svg` and `.png`
- tikztosvg: `outputs/qa-tkz-axis-labels/tikztosvg.svg` and
  `tikztosvg-white.png`
- panel and diff:
  `outputs/qa-tkz-axis-labels/sheet-native-tikztosvg-before-after.png` and
  `diff-native-after.png`

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg` and ran as
`tikztosvg -p tkz-fct`. It accepts a single `tikzpicture` snippet per SVG, so
the source-unit, pi, and fraction variants were additionally inspected in the
combined MacTeX/TikZKit sheet at `outputs/qa-tkz-axis-labels/after/tikzkit.png`.

Before this change TikZKit drew axis lines and tick strokes but emitted no
numeric labels at all. Afterward the real numeric example shows blue x labels
below the red tick endpoints, y labels left of their ticks, and `orig` omits
only the y-axis zero. The combined case additionally confirms `-\pi`,
`-\pi/2`, `\pi/2`, `3\pi/2`, and reduced thirds. Compared with MacTeX and
tikztosvg, the remaining visible difference is the browser math/font outline
and its slightly different text bounds; the numeric locations and tick spacing
are now aligned.

The tikztosvg SVG uses a `166.587pt × 136.29pt` viewBox, path-outline glyphs,
`matrix(1,0,0,-1,...)` coordinate transforms, miter joins, and filled path
arrow tips. TikZKit emits its browser text/math elements plus explicit
`tikz-arrow-latex` paths, with butt caps and miter joins. Those renderer
differences explain the remaining font-shape diff rather than a lost label or
a coordinate mismatch.

## Verification

```bash
node --test test/tkz-fct.test.js test/web-qa-grid.test.js
npm run extension-registry
```

The registry command regenerates its files locally. They are intentionally not
staged in this change because the worktree already contains unrelated registry
edits.
