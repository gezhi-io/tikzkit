# Legacy Declared Arrow Aliases And Reversal

## Boundary

This slice implements `\pgfarrowsdeclarealias` and `\pgfarrowsdeclarereversed`
for arrow tips already accepted by TikZKit's legacy `\pgfarrowsdeclare` subset.
It does not include declaration combine/double/triple helpers, arbitrary TeX
branches, saved-register callbacks, hull callbacks, or clipping callbacks.

## Local Source Review

- `pgfcorearrows.code.tex`, lines 1096-1102: the compatibility declarations
  lower aliases through `means={target}` and reversed forms through
  `means={{target}[reversed]}`.
- `pgfmanual-en-base-arrows.tex`, reversing-arrow section: reversal reflects
  local x coordinates, exchanges and negates backend/tip end, negates line end,
  and reflects the x bounds while retaining y coordinates and paint semantics.
- `pgflibraryarrows.code.tex`: thirteen installed legacy arrow definitions use
  reversed declarations, so this is shared behavior rather than a named-tip fix.
- `pgfmanual-en-library-arrows.tex`: ordinary/reversed legacy tips and the TCS
  leaf declaration provide the visual reference families.

## Third-Party Reference

The local executable is `/Library/TeX/texbin/tikztosvg`. Its SVGs are under
`outputs/qa/2026-09-05-arrows-declared-aliases-after/tikztosvg-svg`, with PNGs
under `tikztosvg-png` and `tikztosvg-grid-png`. The SVG uses separate terminal
paths with local transform matrices, butt caps, and miter joins. TikZKit now
uses the same local-path model and resolves dimensions at the active line width.

## Visual Acceptance

- Flowchart: before the change all custom tips were absent. After the change,
  the blue normal tip, red reflected tip, and both green orthogonal tips are
  present with the same direction as MacTeX and tikztosvg.
- Mathematical map: inclusion/projection tips were previously missing on the
  two curves, vertical bidirectional map, and quotient map. All five terminal
  tips now appear and follow each curve's terminal tangent.
- TCS tree: branches previously ended as flat strokes. The twelve filled leaf
  tips and the reversed trunk tip now render.

The inspected four-panel sheets are in
`outputs/qa/2026-09-05-arrows-declared-aliases-after/diff`. Remaining text-width
and font-rasterization differences are outside this arrow-declaration slice.
