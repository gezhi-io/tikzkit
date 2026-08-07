# pgfgantt Group Peak Geometry QA (2026-08-08)

## Scope

This slice makes `\ganttgroup` use pgfgantt's native eight-point group outline
and makes `\ganttlinkedgroup` use that same outline before adding its
previous-element dependency link. It covers chart- and row-level `group left
peak tip position`, `group right peak tip position`, `group left/right peak
width`, `group left/right peak height`, plus the documented shared `group peaks
...` aliases.

It does not claim support for group progress, `progress=today`, custom group
shapes, calendar/date slots, custom link declarations, or arbitrary
group-label node styles.

The real regression driver is
`test/fixtures/examples/pgfgantt/group-peaks-linked.tex`. It uses independent
left/right peak settings, an orange linked group, grid options, and a styled
dependency so that the feature is exercised as a chart, not as an isolated
path.

## Local pgfgantt Review

Reviewed MacTeX/TeX Live 2025:

- `/usr/local/texlive/2025/texmf-dist/tex/latex/pgfgantt/pgfgantt.sty`;
- `/usr/local/texlive/2025/texmf-dist/doc/latex/pgfgantt/pgfgantt-doc.pdf`.

The package defaults group left/right shift to `-.1`/`.1`, top shift to `.4`,
height to `.2`, each peak tip position to `.5`, width to `.4`, and height to
`.1` (lines 1025-1130). The `ganttgroup` shape implementation (lines
1190-1350) draws the top edge, then the right lower peak, then the left lower
peak, before closing the bottom edge. Its peak offsets are measured in the
chart x/y units, not in an unrelated SVG pixel coordinate. The linked group
macro is created by the generic linked-element expansion at lines 849-1025, so
it must preserve the normal group rendering and then link from the previous
element.

## Source Inventory

| Source construct | Result |
| --- | --- |
| `\begin{ganttchart}...\end{ganttchart}` | Existing partial chart support. |
| `\ganttgroup` | Native eight-point fill/outline contour implemented. |
| `\ganttlinkedgroup` | Same contour plus previous-element dependency implemented. |
| `group left/right peak tip position` | Implemented at chart and row scope. |
| `group left/right peak width`, `group left/right peak height` | Implemented at chart and row scope. |
| `group peaks tip position/width/height` | Implemented as the shared fallback aliases. |
| `group progress`, custom shapes, calendar slots | Still partial or unsupported. |

## Three-Way Visual QA

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; SVG rasterization
used `/opt/homebrew/bin/rsvg-convert`. The following directories contain
TikZKit JS SVG/PNG, tikztosvg SVG/PNG, native MacTeX PNG, 1cm grid panels,
diffs, and the comparison sheet:

- `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-pgfgantt-group-peaks-before-2026-08-08/`;
- `/Users/kaiwu/Documents/Codex/2026-06-20/ru/outputs/qa-pgfgantt-group-peaks-after-2026-08-08/`.

The tikztosvg SVG has the same eight-point peak path as MacTeX, which was used
as the structural reference. TikZKit's rendered path now follows that contour:
its `M ... L ...` data includes both lower peak tips instead of a four-corner
rectangle.

## Visual Result

Before this change, the black `Design` group and orange `Delivery` linked group
were visibly plain rectangles. Native MacTeX and tikztosvg both showed the
downward left/right group peaks, so the missing shape was obvious even though
the link and bars rendered.

After this change, both JavaScript group rows show their individual lower
peaks at the MacTeX-derived x/y-unit offsets, and the blue linked-group
dependency remains connected. The registered MacTeX comparison changed-pixel
ratio decreases from `0.155198` to `0.153117`. More importantly, direct review
of all three panels confirms the previously missing group geometry is present.
Residual differences are chart bounding-box width, grid-dot rasterization, and
text metrics; they are outside this bounded geometry slice.

## Verification

```bash
node --test test/walmes-compat.test.js

npm run examples:render -- --only pgfgantt-group-peaks-linked \
  --output outputs/qa-pgfgantt-group-peaks-after-2026-08-08 \
  --native-reference --strict-tikztosvg

npm run examples:diff -- --output outputs/qa-pgfgantt-group-peaks-after-2026-08-08 --register
```

The focused compatibility suite passes `28/28`. The three-way render has zero
TikZKit diagnostics. This visual group-shape slice is accepted; the excluded
pgfgantt behavior above remains partial.

## Files Changed

- `src/frontend/latex-shell.js`
- `src/packages/pgfgantt.js`
- `src/tikz/libraries/decorations.pathmorphing.js` (preserves a prior registry entry during regeneration)
- `test/walmes-compat.test.js`
- `test/fixtures/examples/pgfgantt/group-peaks-linked.tex`
- `README.md`
- `docs/extension-registry.md`
- `docs/extension-registry.csv`
