# tkz-fct Axis Label Styles QA

## Scope

This slice adds the normal `tkz-base` `xlabel style` and `ylabel style` hooks
to `tkz-fct` axis labels. It covers terminal labels from `\tkzDrawX` and
`\tkzDrawY` plus numeric graduation labels from `\tkzLabelX` and
`\tkzLabelY`. The wrapper commands `\tkzAxeX` and `\tkzAxeY` inherit the
same behavior.

It does not implement `xaxe style` / `yaxe style`, `\tkzSetUpAxis`, or the
`numprint`-specific `np off` switch.

## Local MacTeX Reading

Reviewed:

- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-base/tkz-base.cfg`
  defines the default `xlabel style={below=3pt,...}` and
  `ylabel style={left=3pt,...}`.
- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-base/tkz-obj-axes.tex`
  puts the named style in each `\tkzDrawX`, `\tkzDrawY`, `\tkzLabelX`, and
  `\tkzLabelY` node before applying the call-site keys.
- `/usr/local/texlive/2025/texmf-dist/doc/latex/tkz-base/TKZdoc-base-style.tex`
  documents global TikZ `.style` and `.append style` composition.
- `/usr/local/texlive/2025/texmf-dist/doc/latex/tkz-base/TKZdoc-base-axes.tex`
  shows `xlabel style/.append style={rotate=-30}` alongside local label keys.

The required precedence is: built-in node defaults, global named style, then
the current command's local options. A `.style` replacement can therefore
move `ylabel style` from left to right, while `.append style` retains defaults
and adds rotation or color.

## Implemented Commands And Options

Implemented:

- `\tikzset{xlabel style/.style=...}` and `.append style=...`
- `\tikzset{ylabel style/.style=...}` and `.append style=...`
- terminal labels from `\tkzDrawX` and `\tkzDrawY`
- graduations from `\tkzLabelX` and `\tkzLabelY`
- standard interpreted node keys inside those styles: placement (`below`,
  `left`, `right`, `below right`), `rotate`, `text`/color, `fill`, and the
  shared font keys.

Still partial: `xaxe style`, `yaxe style`, `\tkzSetUpAxis`, TeX-only
`numprint` formatting through `np off`, and unsupported TeX macros in a label
remain outside this slice.

## Visual Evidence

Source: `outputs/qa-tkz-axis-styles/tkz-axis-styles.tex`.

Generated artifacts (ignored by Git):

- MacTeX native PNG: `outputs/qa-tkz-axis-styles/native.png`
- TikZKit SVG/PNG: `outputs/qa-tkz-axis-styles/tikzkit.svg` and `.png`
- TikZKit before PNG: `outputs/qa-tkz-axis-styles/before.png`
- tikztosvg SVG/PNG: `outputs/qa-tkz-axis-styles/tikztosvg.svg` and `.png`
- four-way sheet and diff: `outputs/qa-tkz-axis-styles/`
  `sheet-native-tikztosvg-before-after.png` and `diff-native-after.png`

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg` and rendered the
equivalent snippet with `tikztosvg -p tkz-fct`.

Before the change, the TikZKit screenshot showed black, horizontal X labels
below the axis and black Y labels on its left, ignoring both configured style
definitions. Afterward, TikZKit has blue, -30-degree X values and endpoint
label below the axis, while Y values and the endpoint label are green on the
right. This matches the visible MacTeX and tikztosvg behavior. Command-local
keys retain priority: the regression test sets a local red X graduation on top
of the global blue style.

The visible residual is limited to text outline and crop-box differences.
MacTeX at 144 DPI has a larger raster than browser SVG at its default 96 DPI;
the comparison sheet rescales only for inspection. The coordinate frame,
grid, axis-arrow endpoints, and styled label placement agree.

## SVG Reference Notes

tikztosvg emits a `111.851pt × 140.939pt` viewBox, outlined glyph paths, and
`matrix(1,0,0,-1,...)` transforms. It uses butt caps and miter joins for the
grid and axes, while its label backgrounds are rotated path regions.
TikZKit emits a corresponding `114.1pt × 143.74pt` viewBox, butt/miter path
styles, `tikz-arrow-latex` arrow paths, and explicit rotated `<text>` groups.
Those structural choices preserve the style geometry even though browser
fonts are not the same outlines as TeX's.

## Verification

```bash
node --test test/tkz-fct.test.js test/web-qa-grid.test.js
npm run extension-registry
```

The registry command regenerates its files locally. They are intentionally not
staged here because the worktree already contains unrelated registry edits.
