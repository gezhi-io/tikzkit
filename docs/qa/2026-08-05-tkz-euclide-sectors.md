# tkz-euclide Sector Visual QA

## Scope

This slice implements `\tkzDrawSector` in `tkz-euclide`, not the broader
family of fill/clip-sector commands. The accepted command forms are:

- `\tkzDrawSector[<TikZ styles>](O,A)(B)` (`towards`, including its default)
- `\tkzDrawSector[rotate,<TikZ styles>](O,A)(angle)`
- `\tkzDrawSector[R,<TikZ styles>](O,radius)(start angle,end angle)`
- `\tkzDrawSector[R with nodes,<TikZ styles>](O,radius)(A,B)`

The real driver is the original
`LaTeX-examples-master/tikz/thales-circle-triangle` source. Its
`\tkzDrawSector[thick](M,B)(A)` previously had no extension lowering, so the
browser could not emit the defining semicircle. It now emits a closed ordinary
TikZ path: center, radial line, circular arc, then `cycle`.

## Local TeX Review

Read the installed TeX Live 2025 implementation:

- `/usr/local/texlive/2025/texmf-dist/tex/latex/tkz-euclide/tkz-draw-eu-sectors.tex`
- `/usr/local/texlive/2025/texmf-dist/doc/latex/tkz-euclide/TKZdoc-euclide-drawing.tex`

The implementation dispatches the four public modes to one `RAngles` drawing
routine. That routine computes the two bearings/radius, normalizes a wrapping
sweep by subtracting or adding 360 degrees, then draws the native path
`center -- (start:radius) arc (start:end:radius) -- cycle`. TikZKit follows
that geometry and preserves all ordinary drawing options while removing only
the mode selectors. `towards` and `R with nodes` derive bearings from named
points; `rotate` preserves clockwise/anticlockwise ordering; `R` accepts a
numeric macro-resolved radius and two expressions.

## Artifacts and Reference Structure

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg` and generated:

- TikZKit SVG/PNG: `outputs/qa-tkz-euclide-sector/tikzkit-svg/tkz-euclide-thales-circle-triangle.svg` and `outputs/qa-tkz-euclide-sector/tikzkit-png/tkz-euclide-thales-circle-triangle.png`
- tikztosvg SVG/PNG: `outputs/qa-tkz-euclide-sector/tikztosvg-svg/tkz-euclide-thales-circle-triangle.svg` and `outputs/qa-tkz-euclide-sector/tikztosvg-png/tkz-euclide-thales-circle-triangle.png`
- 1cm-grid panels: `outputs/qa-tkz-euclide-sector/{tikzkit-grid-png,tikztosvg-grid-png}/tkz-euclide-thales-circle-triangle.png`
- visual sheet/diff: `outputs/qa-tkz-euclide-sector/diff/tkz-euclide-thales-circle-triangle-sheet.png`
- MacTeX native PNG: `outputs/qa-tkz-euclide-sector/mactex-png/tkz-euclide-thales-circle-triangle.png`

The tikztosvg SVG has a `221.77pt x 139.28pt` viewBox, path transforms that
flip the TeX y-axis, and the sector as a closed path with a `0.79701pt`
stroke. It uses native butt/miter defaults for that path. TikZKit carries a
closed arc path with the same center-to-endpoint radius and picture scale;
the two viewed grid panels agree on the semicircle endpoints, crown, triangle,
angle labels, and the three `r` labels. The remaining JS/tikztosvg comparison
has a different outer raster canvas (275x155 versus 296x186) and sparse text/
stroke antialiasing; it does not lose or displace the sector.

MacTeX was generated with `/Library/TeX/texbin/pdflatex` and converted using
`/opt/homebrew/bin/pdftoppm`. The historical source's `\usetkzobj{all}` had to
be removed only in the disposable native-reference copy because TeX Live 2025
no longer defines that legacy loader. Its current `\tkzMarkAngle` behavior
also draws circular-looking old-style marks for this historical input, so its
angle decorations differ from both browser/tikztosvg panels. The new sector
itself still has the same `A -> B` diameter, upper semicircular arc, and
`thick` stroke. This is a source-version compatibility issue outside the
sector slice, not a reason to call the whole historical figure an exact native
match.

## Verification

Passed focused tests:

```sh
node --test --test-name-pattern='(expands tkz-euclide sectors through their four documented draw modes|renders the full thales circle triangle including tkzDrawSector)' test/tkz-euclide.test.js
node --test test/snake-arrow-lengths.test.js
```

The full `test/tkz-euclide.test.js` remains unsuitable as an acceptance gate
in this dirty working tree: concurrent frontend/parser changes currently make
pre-existing midpoint/circle/intersection tests lose their coordinate map.
The focused sector expansion and real rendered-fixture tests pass with no
diagnostics. No unrelated files were changed to mask that existing failure.

## Deferred

`\tkzFillSector`, `\tkzClipSector`, macro-heavy arbitrary point expressions,
and the broader tkz-euclide compatibility/version migration remain outside
this accepted slice. The next focused tkz-euclide candidate is sector fill and
clip reuse of the same normalized geometry.
