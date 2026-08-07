# tikztosvg Top-Level Crop and Preamble Isolation

## Scope

This is a visual-QA harness slice, not a claim of new Karnaugh rendering
semantics. It makes the disposable `tikztosvg` source preserve two document
boundaries shared by real TikZ documents:

- an explicit crop path belongs only to a top-level executable
  `tikzpicture`, never to one held in a `\newcommand` body; and
- source declarations from before `\begin{document}` must be loaded before
  `tikztosvg` opens its own document, rather than being replayed in its body.

The real driver is
`test/fixtures/examples/latex-examples/karnaugh-map.tex`. Its preamble loads
`kvmacros`, defines `\tikzmark` and `\DrawArrow`, then invokes
`\karnaughmap{4}` with a 4-by-4 bit table, six colored `\put`/`\oval`
overlays, and a curved `\DrawArrow` with `out`, `in`, `distance`, and negative
`shorten >=` options. The rendering owner remains
`src/extensions/kvmacros.js`; no per-case geometry is hard-coded here.

## Local Source Study

Read local TeX Live 2025 sources:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex`
  lines 534 and 1958: `use as bounding box` is an executable TikZ path mode.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/basiclayer/pgfcorepathusage.code.tex`
  line 41: PGF maps that path mode to its bounding-box update callback.
- `/usr/local/texlive/2025/texmf-dist/tex/latex/karnaugh/kvmacros.tex`
  lines 300-343: `\karnaughmap` creates nested LaTeX `picture` environments
  and executes the caller's final overlay argument inside them.
- `/Library/TeX/texbin/tikztosvg`: the local command creates its own
  `\documentclass[crop,tikz,multi=false]{standalone}`, loads requested packages
  and libraries, then appends the supplied input as document body.

The implementation consequence is that a global textual replacement of every
`\end{tikzpicture}` is wrong: it executes a crop path during macro definition.
The new scanner tracks TeX brace depth and comments, so it injects only before
top-level picture ends. It also writes a temporary `tikzkit-<case>-preamble.sty`
to load non-package source preamble declarations before the third-party wrapper
opens its document.

## Reference Outcome

`command -v tikztosvg` resolved to `/Library/TeX/texbin/tikztosvg`; PNG
conversion used `/opt/homebrew/bin/rsvg-convert`. Artifacts are ignored under:

- `outputs/qa-karnaugh-crop-top-level-2026-08-08/`
- `outputs/qa-tikztosvg-preamble-wrapper-regression-2026-08-08/`

Karnaugh's disposable input now leaves the macro-held inner picture untouched
and its preamble wrapper correctly loads `kvmacros` plus both macro
definitions. Native XeLaTeX also compiles the untouched source successfully.
However, the local `tikztosvg` executable still fails at `\DrawArrow` with
`Missing \endgroup inserted`: its mandatory `standalone[crop,tikz,multi=false]`
wrapper conflicts with the source's LaTeX `picture` map plus overlay TikZ.
The QA page consequently labels the rendered reference as **MacTeX native
fallback** and retains `tikztosvg-log/latex-examples-karnaugh-map.log`; it does
not present that fallback as a successful third-party SVG.

The inspected native sheet
`diff/latex-examples-karnaugh-map-native-sheet.png` now contains the full map,
dimension braces, colored ovals, and red curved arrow in both TikZKit and
MacTeX panels. TikZKit has no diagnostics. Its remaining visible differences
are a roughly `5x6px` larger outer canvas plus formula spacing/rasterization;
this QA-harness change does not claim to close those renderer differences.

The normal macro regression
`diff/latex-examples-feed-forward-perceptron-native-sheet.png` uses an actual
successful `tikztosvg` render. It confirms that moving source preamble styles,
`\newcommand{\dist}`, and `\tikzstyle` declarations into the temporary wrapper
does not lose the neural-network nodes, arrow routing, colors, or MacTeX
reference generation.

## Verification

```bash
node --test test/example-render-script.test.js
npm run examples:render -- --fixtures test/fixtures/examples \
  --only latex-examples-feed-forward-perceptron \
  --output outputs/qa-tikztosvg-preamble-wrapper-regression-2026-08-08 \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg
npm run examples:diff -- --output \
  outputs/qa-tikztosvg-preamble-wrapper-regression-2026-08-08
npm run examples:render -- --fixtures test/fixtures/examples \
  --only latex-examples-karnaugh-map \
  --output outputs/qa-karnaugh-crop-top-level-2026-08-08 \
  --native-reference --comparison-grid-mode svg --strict-tikztosvg \
  --continue-on-external-failure
npm run examples:diff -- --output outputs/qa-karnaugh-crop-top-level-2026-08-08
```

Focused tests pass; the feed-forward driver has all three references and zero
diagnostics. Karnaugh has zero TikZKit diagnostics and a complete MacTeX visual
panel, but `tikztosvg` remains unavailable for this source for the documented
third-party wrapper reason.

## Next Slice

Use the restored Karnaugh native panel to address the actual renderer residual:
shared outer bounding-box padding and mixed math text spacing. Keep that work
separate from this reference-generation repair.
