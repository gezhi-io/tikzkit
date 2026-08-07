# PGFPlots Axis Overlay Font Scope

## Scope

This slice makes retained user-authored statements inside a PGFPlots `axis`
inherit the active axis `font`. It covers `\node`, path nodes, and
`\draw`/`\fill`/`\filldraw` annotations that survive lowering. It does not
claim complete TeX font, macro, or metric compatibility.

The real driver is
`test/fixtures/examples/latex-examples/csv-2d-gaussian-multivarate-distributions.tex`.
It configures:

```tex
every axis/.append style={font=\large\sansmath\sffamily}
...
\filldraw ... node [label={... above left:$(65, 35)$}] {};
```

Before the change, the manual label was evaluated after the lowered axis scope
had ended, so it used document defaults: 10pt serif normal math. Generated
ticks already used the intended 12pt sans/sansmath axis context. The repair
wraps the lowered overlay statements in the saved axis font scope, leaving
their coordinates and path geometry unchanged.

## Local MacTeX Review

Reviewed local TeX Live 2025 sources:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex`
  lines 853-887 define `every axis`, and lines 8699-8713 install it while the
  axis is active. Axis labels are normal TikZ nodes made in that context.
- `/usr/local/texlive/2025/texmf-dist/tex/latex/sansmath/sansmath.sty` lines
  22-31 and 192-205 define the local `sans` math version. `\sansmath` changes
  math glyph selection while `\sffamily` changes ordinary text.

The implementation mirrors that scope behavior rather than assigning a
case-specific label font.

## Three-Way Visual QA

`tikztosvg` is available at `/Library/TeX/texbin/tikztosvg`; PNG conversion
uses `/opt/homebrew/bin/rsvg-convert`. Artifacts are in
`outputs/qa-pgfplots-axis-overlay-font-after-2026-08-07/`:

- TikZKit SVG and PNG with a 1cm comparison grid.
- tikztosvg SVG and PNG with the same grid.
- MacTeX native PNG plus native/JS/tikztosvg diff sheets.

The TikZKit SVG retains semantic `<text>`/`<tspan>` nodes; the repaired
`(65, 35)` annotation has a 12pt-equivalent size and Helvetica/Arial sans
fallback for math digits and parentheses. tikztosvg outlines text as glyph
`<defs>`/`<use>` paths, so it has no SVG `<text>` node to inspect directly.

Visually, the scatter field, dashed diagonal, three highlighted circles, axes,
ticks, and grid retain their prior positions. The manual `(65, 35)` label now
shares the larger sans/sansmath treatment of its axis instead of appearing as a
smaller default serif annotation. Remaining difference is glyph rasterization
and final TeX/browser metric calibration, not a shifted coordinate or missing
plot element.

Registered image metrics are supplemental only: TikZKit-to-native changed-pixel
ratio is 0.1953410 at alignment offset `(+2,+1)`, while tikztosvg-to-native is
0.2073089. Dense scatter marks dominate those values and do not measure the
font correction by themselves.

## Tests

```sh
node --test test/pgfplots-csv-overlay.test.js
npm run examples:render -- --output outputs/qa-pgfplots-axis-overlay-font-after-2026-08-07 --only latex-examples-csv-2d-gaussian-multivarate-distributions --tikztosvg --native-reference --grid
npm run examples:diff -- --output outputs/qa-pgfplots-axis-overlay-font-after-2026-08-07 --register --alignment-radius 3
```

The focused test suite passes all 30 tests. The new regression verifies no
diagnostics and checks that the real style is interpreted as 12pt,
`sans-serif`, and math version `sans`.

## Remaining Work

Complex TeX callback code, arbitrary macro expansion, every possible label or
pin placement, and final glyph/bounding-box calibration remain partial. The
next focused slice should audit axis-overlay `label`/`pin` placement against
TeX node metrics, rather than broadening the font wrapper indiscriminately.
