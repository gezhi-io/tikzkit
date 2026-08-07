# `arrows.meta` Stealth Open, Harpoon, and Reversed Variants

## Scope

This is one bounded `arrows.meta` slice: capitalized `Stealth` with the
source-defined `open`, `harpoon`, `swap`, and `reversed` options. It does not
claim composite tips, arbitrary arrow declarations, bending/flex keys, or the
full arrows.meta setup-code interface.

The real regression driver is
`test/fixtures/examples/arrows/meta-stealth-variants.tex`:

```tex
\usetikzlibrary{arrows.meta}
\begin{tikzpicture}[ultra thick]
  \draw[blue,-{Stealth[open]}] (0,0) -- (4,0);
  \draw[red,-{Stealth[harpoon]}] (0,-0.9) -- (4,-0.9);
  \draw[green!60!black,-{Stealth[harpoon,swap]}] (0,-1.8) -- (4,-1.8);
  \draw[purple,-{Stealth[reversed]}] (0,-2.7) -- (4,-2.7);
  \draw[orange,-{Stealth[reversed,open,scale=.8]}] (0,-3.6) -- (4,-3.6);
\end{tikzpicture}
```

It covers every option in this slice and includes an option combination with
the existing `scale` support.

## Local MacTeX Study

Read these installed TeX Live 2025 sources and manual sections:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/libraries/pgflibraryarrows.meta.code.tex`,
  Stealth declaration around lines 945-1060. The declaration makes `open`
  select `qstroke`; `harpoon` omits the final outer vertex and adds a harpoon
  miter to `tip end`; `swap` changes the transverse side; and `reversed`
  calculates a different `line end` while the point faces back toward the
  path.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorearrows.code.tex`,
  lines 779-833. Path shortening consumes the semantic `tip end`, `back end`,
  and `line end` values rather than a generic marker rectangle.
- `/usr/local/texlive/2025/texmf-dist/doc/generic/pgf/pgfmanual-en-tikz-arrows.tex`,
  the `reversed`, `harpoon`/`swap`, and `open` descriptions around lines
  653-718 and 825-832.

TikZKit keeps the parsed options with the arrow tip, derives the same miter
geometry in `src/tikz/metrics.js`, and renders the resulting three- or
four-corner path in `src/renderers/svg/paths.js`. `src/engine/evaluate.js`
reuses that geometry for decoration shortening.

## Three-Way Visual Evidence

`tikztosvg` is available at `/Library/TeX/texbin/tikztosvg`, with PNG
conversion by `/opt/homebrew/bin/rsvg-convert`. The MacTeX reference uses the
installed TeX Live 2025 `pdflatex` pipeline.

Artifacts are local and intentionally ignored by Git:

- `outputs/qa-arrows-meta-variants-before-2026-08-08/`
- `outputs/qa-arrows-meta-variants-after-2026-08-08/tikzkit-svg/`
- `outputs/qa-arrows-meta-variants-after-2026-08-08/tikztosvg-svg/`
- `outputs/qa-arrows-meta-variants-after-2026-08-08/{tikzkit,tikztosvg,mactex}-png/`
- `outputs/qa-arrows-meta-variants-after-2026-08-08/diff/arrows-meta-stealth-variants-native-sheet.png`

I inspected the native PNG, TikZKit PNG, tikztosvg PNG, and registered diff.
MacTeX and tikztosvg are pixel-identical for this fixture. The tikztosvg SVG
confirms the implementation details: open Stealth is a stroked four-point
path, harpoon is a filled/stroked three-point path, swapped harpoon changes
only its transverse orientation, and reversed Stealth has a left-facing
four-point local path. No SVG marker is involved.

## Visible Improvement

Before this change, all five rows were painted as the same solid,
right-facing full Stealth head. The blue row was incorrectly filled; both
harpoon rows had the missing half restored; the purple row ignored its reverse
direction; and the orange row ignored reverse plus open.

After the change, the inspected TikZKit panel has a hollow blue outline, an
upper red half-head, a lower green swapped half-head, a left-facing filled
purple tip, and a smaller left-facing hollow orange tip. Those five visible
forms agree with the MacTeX and tikztosvg panels. The registered changed-pixel
ratio improved from `0.074627` to `0.070153`; this is supporting evidence
only. The remaining red pixels are mostly horizontal stem anti-aliasing and a
two-pixel canvas-height discrepancy, not a missing variant.

## Verification

```bash
node --test --test-name-pattern='Stealth miter geometry|Stealth open, harpoon' test/renderer.test.js
node --test test/library-modules.test.js
npm run case:audit -- test/fixtures/examples/arrows/meta-stealth-variants.tex \
  --output outputs/qa-arrows-meta-variants-after-2026-08-08/audit.md \
  --init-review outputs/qa-arrows-meta-variants-after-2026-08-08/review.json
npm run examples:render -- --only arrows-meta-stealth-variants \
  --output outputs/qa-arrows-meta-variants-after-2026-08-08 \
  --native-reference --strict-tikztosvg
npm run examples:diff -- --output outputs/qa-arrows-meta-variants-after-2026-08-08 --register
```

Both focused renderer tests pass; the library module suite passes 7/7. The
real-case render creates 1/1 TikZKit SVG/PNG, tikztosvg SVG/PNG, and MacTeX
PNG artifacts with zero TikZKit diagnostics and zero external-renderer
failures. The semantic audit inventories all commands, options, and numeric
literals; its generic review template remains incomplete for unrelated
document-shell semantics, so it is not used as a claim of full-document
coverage.

## Remaining Boundary

Repeated `reversed` toggles, `left`/`right` aliases beyond the direct harpoon
mapping, `round`, `flex`, `bend`, `quick`, composite tips, padding/separation,
and custom declaration/setup-code behavior remain outside this slice. The next
arrow pass should choose one of those as a separate native fixture.
