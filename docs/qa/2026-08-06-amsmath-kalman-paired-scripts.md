# amsmath paired script fallback - Kalman filter

## Scope

This slice covers the SVG-text fallback for paired superscripts and
subscripts inside a node-local `align*` display, driven by
`latex-examples-kalman-filter`. It does not claim complete `amsmath` support.

## Local TeX study

Read `/usr/local/texlive/2025/texmf-dist/tex/latex/amsmath/amsmath.sty`:

- `align*` invokes `\start@align\@ne\st@rredtrue\m@ne`.
- `\align@` measures the complete rows, then builds the alignment table with
  `\align@preamble`.
- The preamble right-aligns the first cell and starts the second cell after
  the relation, while `\spread@equation` supplies opened-up display spacing.

The key implementation consequence is that a paired script is one completed
math list before `align` lays out its columns. An SVG fallback cannot let a
converter choose an implicit cursor after `super` then `sub` and expect that
to agree with TeX.

## Change

`src/renderers/svg/mathScriptFallback.js` now places paired scripts with
explicit upper/lower `dy` offsets. It rewinds by the measured Computer Modern
superscript width, advances by the wider script, and emits an empty tspan to
restore the parent baseline. Ordinary single superscripts/subscripts retain
the existing SVG behavior.

## Real-case audit

Source: `test/fixtures/examples/latex-examples/kalman-filter.tex`.

Implemented and exercised:

- `\newcommand*{\tran}{\top}` expansion;
- `\begin{align*}` / `&=` / `\\` row handling;
- `\mathbf`, grouped paired scripts such as `x_{k+1}^{(P)}` and
  `P_k^{(P)}`, `\left...\right`, scoped `\color`, node `text width`,
  labels, and orthogonal paths.

The fixture rendered with zero diagnostics. Remaining partial behavior:

- equation tags, `\intertext`, `split`, `gathered`, `multline`, and arbitrary
  TeX macro expansion;
- exact glyph outlines and every atom spacing in the non-HTML SVG fallback.

## References and visual inspection

`tikztosvg` was found at `/Library/TeX/texbin/tikztosvg`; `rsvg-convert` was
found at `/opt/homebrew/bin/rsvg-convert`.

Final artifacts are in
`/private/tmp/tikzkit-qa-amsmath-kalman-paired-scripts-2026-08-06/`:

- `mactex-png/latex-examples-kalman-filter.png`;
- `tikztosvg-svg/latex-examples-kalman-filter.svg` and PNG;
- `tikzkit-svg/latex-examples-kalman-filter.svg` and PNG;
- `diff/latex-examples-kalman-filter-native-sheet.png`.

The native and `tikztosvg` panels agree on the two-column equation layout and
the relative script positions. Before the fix, TikZKit's portable SVG fallback
let paired scripts collide or stack tightly after converter-dependent cursor
movement. After the fix, the `x_{k+1}^{(P)}` and `P_k^{(P)}` clusters have
separate upper/lower baselines and subsequent atoms start after the wider
script. Its glyph spacing is still less exact than native TeX, especially for
the long inverse expression in the innovation block.

## Verification

```bash
node --test --test-name-pattern='renders scripts on grouped math nuclei|keeps a bold math nucleus when it carries a script|uses calibrated TeX advances and explicit baseline restoration|uses script-cluster widths when aligning SVG text equations|uses amsmath' test/renderer.test.js
npm run gallery:audit -- --only latex-examples-kalman-filter
npm run examples:render -- --output /private/tmp/tikzkit-qa-amsmath-kalman-paired-scripts-2026-08-06 --only latex-examples-kalman-filter --native-reference --strict-tikztosvg --comparison-grid-mode svg
node scripts/diff-example-pngs.js --output /private/tmp/tikzkit-qa-amsmath-kalman-paired-scripts-2026-08-06 --register
```
