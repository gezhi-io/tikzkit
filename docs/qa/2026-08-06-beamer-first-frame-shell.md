# Beamer First-Frame Shell QA

## Scope

Shared TeX-shell handling for multi-frame Beamer documents. The browser emits
one SVG, so this slice preserves the source preamble and selects the first
`frame`, matching the native reference pipeline's page-1 rasterization. It
also removes the non-geometric `figure` and `center` wrappers around that
frame's TikZ content. It does not attempt slide pagination, overlays, or full
Beamer layout.

## Driver Case And Source Inventory

- Fixture: `latex-examples-bellman-ford-algorithm`
- Source: `test/fixtures/examples/latex-examples/bellman-ford-algorithm.tex`
- Shell syntax: `\documentclass{beamer}`, three `frame` environments, and
  `figure` wrappers.
- TikZ syntax retained by this slice: `\pgfdeclarelayer`, `\pgfsetlayers`,
  `\tikzset`, `\tikzstyle`, `tikzpicture[scale=2.5,auto,swap]`, `\foreach`,
  `\node`, and `edge[->,...]`.

The change is deliberately shell-only: the existing TikZ commands, values,
styles, coordinate pairs, and arrow geometry are evaluated by their shared
implementations after frame selection.

## Local MacTeX Reading

Read `/usr/local/texlive/2025/texmf-dist/tex/latex/beamer/beamerbaseframe.sty`.
Its `beamer@frameslide` environment records the first and final page for each
frame and boxes each slide independently; the frame setup also resets the
frame title/subtitle before it emits that slide. The local native job produced
a three-page PDF, while the QA rasterizer selected page 1. That establishes
the correct browser policy for a single-output renderer: do not concatenate
independent frames.

`beamer` is a document class rather than a package or TikZ library, so it is
not an entry in the package/library-only extension registry. The implementation
is recorded in the shared TeX shell and in this QA evidence instead.

## Third-Party Reference

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg` (0.3.0); PNG conversion
uses `/opt/homebrew/bin/rsvg-convert`. The generated third-party wrapper fails
for this legacy Beamer source at `\begin{figure}` with `Missing \endcsname
inserted`, so no third-party SVG or PNG is available for this case. The exact
input and log are retained in the QA directory; MacTeX is the visual reference
for this slice.

## Visual Review

Artifacts: `outputs/qa-beamer-first-frame-2026-08-06/`.

- `mactex-native.png`: page 1 of the local three-page Beamer PDF.
- `tikzkit.svg` and `tikzkit.png`: the browser render after the fix.
- `tikzkit-grid.svg` and `tikzkit-grid.png`: the same browser render with the
  1cm QA grid.
- `tikztosvg-input.tex` and `tikztosvg-failure.log`: reproducible failed
  third-party reference attempt.
- `comparison-sheet.png` and `tikzkit-vs-mactex-diff.png`: native/JS/diff
  review panel.

Before the fix, all three frame drawings overlapped and literal residue such as
`\end{figure}` and `\end{frame}` appeared in the browser result. After the
fix, the JS image contains just the nine-node Bellman-Ford graph from native
page 1: its arrows, curved `b`/`e` pair, labels, and weights are present. The
remaining diff is expected canvas/layout noise: MacTeX rasterizes a full Beamer
page with navigation controls, while TikZKit produces a tight graphic SVG.
The geometry itself is visibly aligned in `comparison-sheet.png`.

## Verification

```bash
node --test test/frontend.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --output /private/tmp/tikzkit-qa-beamer-frame-after \
  --only latex-examples-bellman-ford-algorithm \
  --native-reference --comparison-grid-mode svg
```

- Frontend regression suite: 13/13 passed.
- Bellman-Ford render: one TikZKit SVG/PNG, one MacTeX PNG, zero diagnostics.
- `tikztosvg`: unavailable for this source because its wrapper compilation
  fails, recorded rather than treated as a passing comparison.

## Remaining Work

Support explicit frame selection and emitting one SVG per frame. Do not infer
full Beamer theme/layout behavior from this slice; it is intentionally limited
to isolating the one frame that the existing native reference accepts.
