# `pgfgantt` Numeric Bar Progress QA (2026-08-07)

## Scope

This pass implements one bounded `pgfgantt` feature family: numeric
`\ganttbar[progress=P]` for `0 <= P <= 100`, with completed/incomplete bar
fills and the default progress label. It includes chart-level and row-local
`bar/.append style` and `bar incomplete/.append style` precedence, plus
`progress label text` and `bar progress label font` for the simple textual
label case.

It deliberately excludes `progress=today`, group/milestone progress,
progress-label node styles, date/calendar calculations, and custom element
shapes.

The real driver is `test/fixtures/examples/pgfgantt/bar-progress.tex`, adapted
from the local manual. It displays a 100% completed bar, a 37% in-progress bar,
and a 0% queued bar, using chart-level green completed and red incomplete fills.

## Local MacTeX Study

Read locally:

- `/usr/local/texlive/2025/texmf-dist/tex/latex/pgfgantt/pgfgantt.sty`;
- `/usr/local/texlive/2025/texmf-dist/doc/latex/pgfgantt/pgfgantt-doc.pdf`.

The source behavior implemented here is specific:

- lines 823-833 define `progress=none` and the default label format
  `P% complete`;
- lines 901-935 distinguish `none`, zero, partial, and complete progress;
- lines 936-968 calculate a left-to-right clip point and draw completed style
  on the left, incomplete style on the remaining right area;
- lines 970-975 attach the progress label to the element's east anchor;
- manual text around the documented incomplete styles states that P percent of
  each element starts at the left in base style, while the remainder uses the
  corresponding incomplete style.

TikZKit applies those rules to numeric bars: a partial value preserves the
base filled rectangle up to `P/100`, paints the remaining right rectangle with
the incomplete fill, redraws its visible border/divider, and places the default
scriptsize label at the right. Chart styles are read before row-local styles,
so a row can override a chart default as pgfgantt does.

## Three-Renderer Evidence

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; PNG conversion used
`/opt/homebrew/bin/rsvg-convert`.

The detached baseline from commit `eb97059` is in
`outputs/qa-pgfgantt-bar-progress-before-2026-08-07/`. Its TikZKit panel shows
three identical empty bars: there is no green completed segment, red remaining
segment, or percentage label. MacTeX and tikztosvg clearly show the three
distinct progress states.

After implementation, the artifacts are in
`outputs/qa-pgfgantt-bar-progress-after-2026-08-07/`:

- MacTeX PNG: `mactex-png/pgfgantt-bar-progress.png`;
- TikZKit SVG/PNG: `tikzkit-svg/pgfgantt-bar-progress.svg` and
  `tikzkit-png/pgfgantt-bar-progress.png`;
- tikztosvg SVG/PNG: `tikztosvg-svg/pgfgantt-bar-progress.svg` and
  `tikztosvg-png/pgfgantt-bar-progress.png`;
- comparison sheets: `diff/pgfgantt-bar-progress-native-sheet.png` and
  `diff/pgfgantt-bar-progress-sheet.png`.

The inspected after panels visibly agree on behavior: Completed is entirely
green and labelled `100% complete`; In progress changes from green to red at
37% of its physical bar width and is labelled `37% complete`; Queued is
entirely red and labelled `0% complete`. The remaining variation is text
rasterization and a few pixels of canvas crop, not a missing state or incorrect
progress-side orientation.

The tikztosvg SVG shows completed and incomplete bar paths as separate filled
objects under clipping paths. Its completed fill is `rgb(45%,100%,45%)`, the
incomplete fill is `rgb(100%,55%,55%)`, and the 37% clipping boundary is
visible before its red remainder. TikZKit emits one green base rectangle, one
red remaining rectangle, a shared border, and the progress divider; the
renderer keeps these as ordinary SVG paths rather than encoding Gantt-specific
SVG instructions.

## Changes And Verification

- `src/frontend/latex-shell.js` adds chart/row style precedence for Gantt
  element fills, numeric progress clipping, incomplete fills, borders/dividers,
  and default progress labels.
- `test/walmes-compat.test.js` checks base/incomplete fills and the label.
- `test/fixtures/examples/pgfgantt/bar-progress.tex` and its manifest entry
  provide the real visual regression.
- `src/packages/pgfgantt.js`, generated registry files, and README record the
  currently supported numeric-progress boundary.

```bash
node --test --test-name-pattern='pgfgantt' test/walmes-compat.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output outputs/qa-pgfgantt-bar-progress-after-2026-08-07 \
  --only pgfgantt-bar-progress --native-reference \
  --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-pgfgantt-bar-progress-after-2026-08-07 \
  --register --alignment-radius 3
npm run extension-registry
```

The focused regression passes and all three renderers produce the test case
without TikZKit diagnostics. Acceptance is the visible restoration of the
three native progress states, not the aggregate PNG number alone.

## Remaining Work

The next `pgfgantt` progress slice should derive `progress=today` from source
calendar slots and support progress rendering for groups/milestones. That work
depends on a separate date/time-slot capability and should not be folded into
this numeric bar implementation.
