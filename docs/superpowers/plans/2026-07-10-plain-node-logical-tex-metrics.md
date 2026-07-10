# Plain Node Logical TeX Metrics Implementation Plan

> **Goal:** Separate TeX node-box measurement from SVG text paint bounds for normal, single-line, unwrapped plain text, then verify the resulting node anchors and connected paths against MacTeX.

## Context and Oracle

TikZ constructs unwrapped node text in a real TeX `\hbox`; PGF shapes then use `\wd`, `\ht`, and `\dp` plus inner separation. TikZKit currently feeds `estimatePlainTextRenderBounds()` back into semantic node sizing. That renderer estimate applies the SVG-only horizontal paint scale and CSS-like line height, making the real `concatenate` node about `47.49pt x 18.17pt` instead of the native `58.109pt x 12.879pt`. Connected paths therefore resolve against the wrong border.

MacTeX is authoritative:

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex` around `\tikz@do@fig` constructs the text box and uses a minipage only when `text width` is present.
- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduleshapes.code.tex` rectangle anchors use `\wd + 2*inner xsep` and `\ht + \dp + 2*inner ysep`.
- `node_modules/katex/src/fontMetricsData.js` is generated from TeX TFM data. Its `Main-Regular` records contain `[depth, height, italic, skew, width]` in em units. TikZKit must embed only the small browser-safe metric table/helper it owns; browser runtime must not import a filesystem-only KaTeX source path.
- `test/fixtures/examples/output/tikztosvg-svg/latex-examples-aggregation-blocks.svg` exposes the native rectangle and path endpoints.

## Global Constraints

- Semantic measurement belongs in `src/tikz/textMetrics.js` and the text-engine adapter. Do not change parser, node evaluator, SVG paint scale, or renderer shape geometry.
- Keep SVG paint bounds and logical TeX box metrics separate. Cached payload/viewBox sizing continues to use render bounds so glyphs are not clipped; `measure()` returns logical metrics to node layout.
- Apply the new path only to normal, single-line, unwrapped plain text supported by the embedded Main-Regular metrics. Wrapped/minipage text, mixed inline math, multiline text, non-default font families, bold/italic, and arbitrary TeX macros stay on the existing partial path.
- Font size scaling must follow the request's TeX point size. A 10pt `concatenate` box is approximately `51.666pt` wide, `6.151pt` high, and `0pt` deep before inner separation.
- Unsupported characters must fall back safely; no NaN, zero box, or silent clipping.
- Do not embed or copy MacTeX font binaries in this slice. The existing browser-served KaTeX font remains the paint font; this task calibrates logical TFM metrics only.
- No fixture-ID branches or hardcoded node names in production.
- Generated QA artifacts stay under `outputs/qa-plain-node-logical-metrics/` and are not committed.
- The worktree contains pre-existing uncommitted architecture work. Use before/after snapshots and focused diffs; do not stage or commit dirty implementation/capability files.

## Task 1: Add logical TeX box metrics to the SVG text-engine boundary

**Files:**
- Modify: `src/tikz/textMetrics.js`
- Modify: `src/renderers/svg/textEngine.js`
- Modify: `test/svg-renderer.test.js`
- Modify: `test/interpreter.test.js`
- Modify: `test/example-fixtures.test.js`

**Interfaces:**
- Produces: `measurePlainTextTeXBoxPt(text, options) -> { width, height, depth } | null` for supported plain Main-Regular text.
- Consumed by: `createSvgTextEngine().measure()` for semantic node metrics; cached SVG payload continues to use render bounds.

- [ ] **Step 1: Write failing metric and node tests**

Add tests that require:

1. `measurePlainTextTeXBoxPt("concatenate", { fontSizePt: 10 })` to be near `{ width: 51.666, height: 6.151, depth: 0 }`;
2. the SVG text engine to return those logical dimensions while its cached payload retains a viewBox large enough for the existing paint bounds;
3. `\node[draw,dashed]{concatenate};` to produce a semantic/background rectangle near `58.11pt x 12.88pt` after default inner separation;
4. the real aggregation fixture to keep the six explicit `3cm x 1cm` boxes unchanged while `concatenate.south` and its incoming anchors resolve to the enlarged, shorter node border.

Run:

```bash
node --test --test-name-pattern="logical TeX box|aggregation concatenate" test/svg-renderer.test.js test/interpreter.test.js test/example-fixtures.test.js
```

Expected: fail because the text engine currently returns SVG paint bounds as semantic metrics.

- [ ] **Step 2: Implement a browser-safe logical metric helper**

In `src/tikz/textMetrics.js`, add a small Main-Regular metric map derived from KaTeX's generated TFM data for the supported plain characters. Sum widths, take maximum height and maximum depth, and scale the em values by `fontSizePt`. Return `null` when the input is outside this slice instead of inventing metrics. Keep `texTextWidthCm()` behavior intact for existing callers.

- [ ] **Step 3: Separate semantic metrics from paint bounds**

In `measurePlainTextRequest()`:

- always compute the existing render bounds for payload/viewBox and paint;
- use logical TeX metrics only when the request is one supported, unwrapped, normal Main-Regular line;
- return logical width and total height `(height + depth)` in SVG text-engine units;
- derive `baselineY` from logical height rather than a fixed `0.62` ratio;
- keep cache identity render-affecting and stable;
- retain the old measurement path for wrapped, multiline, styled, mixed-math, and unsupported text.

- [ ] **Step 4: Run focused and regression tests**

```bash
node --test test/svg-renderer.test.js test/interpreter.test.js test/example-fixtures.test.js test/convert.test.js
```

Expected: all tests pass. Existing paint snapshots must remain unchanged unless their semantic node box legitimately changes.

- [ ] **Step 5: Generate and inspect the real-case gate**

```bash
npm run examples:render -- --fixtures test/fixtures/examples --output outputs/qa-plain-node-logical-metrics --only latex-examples-aggregation-blocks --strict-tikztosvg --comparison-grid-mode svg --external-timeout-ms 120000
npm run examples:diff -- --output outputs/qa-plain-node-logical-metrics
```

Actually inspect native/tikztosvg, TikZKit, and diff panels. Acceptance requires:

- `concatenate` rectangle within `0.25pt` of native width and height;
- three incoming endpoints and outgoing start within `0.5pt` of native and touching the border without penetrating it;
- six convolution boxes, outer dashed rectangle, arrows unrelated to `concatenate`, and approximately `332.05pt x 227.57pt` raw SVG size remain unchanged;
- no missing text/path/layer and zero diagnostics;
- a visible improvement in node geometry and connected paths. Diff percentage is secondary.

## Task 2: Record the verified plain-node metric slice

**Files:**
- Modify: `src/capabilities/matrix.js`
- Modify: `test/capabilities.test.js`

- [ ] **Step 1: Add a failing capability assertion**

Require `node_text_measurement` to remain partial, include the aggregation fixture and `outputs/qa-plain-node-logical-metrics`, mention verified logical TeX metrics for normal single-line unwrapped Main-Regular nodes, and retain wrapped paragraph, mixed inline-math, styled-font, glyph-paint, and broader shaping gaps.

- [ ] **Step 2: Verify RED**

```bash
node --test --test-name-pattern="plain node logical metric visual gate" test/capabilities.test.js
```

- [ ] **Step 3: Update the existing row only**

Add the real fixture and artifact directory without duplicate rows or a new feature ID. Keep parser stable and semantic/SVG partial. Record the exact supported boundary and remaining gaps.

- [ ] **Step 4: Run capability and focused suites**

```bash
node --test test/capabilities.test.js test/svg-renderer.test.js test/interpreter.test.js test/example-fixtures.test.js
```

- [ ] **Step 5: Preserve the dirty-worktree boundary**

Record before/after SHA-256 hashes and focused diffs for review. Do not stage or commit dirty capability/implementation files.
