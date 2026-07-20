# Default CMU Font Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make TikZKit's default SVG text use a self-named Computer Modern Unicode font layer in the browser and the PNG comparison pipeline, then verify a visible font improvement for `latex-examples-activation-functions`.

**Architecture:** Package four CMU Serif OpenType assets from the local MacTeX installation under `web/fonts/`. A renderer-owned SVG style declares the browser-facing `TikZKitCMUSerif` family, while text keeps a `CMU Serif` fallback so the existing `rsvg-convert` + Fontconfig pipeline selects the same asset family. The rendering script copies the assets beside generated output and asks the SVG renderer for relative URLs, so generated comparisons remain viewable outside the workbench route.

**Tech Stack:** ESM JavaScript, SVG `@font-face`, MacTeX 2025 CM Unicode OpenType assets, Node test runner, local `rsvg-convert`, local `tikztosvg`.

## Global Constraints

- Do not add a runtime dependency.
- Do not use `KaTeX` or `KaTeX_Main` as the default TikZ text family name.
- Preserve the existing scoped formula HTML layer; this slice changes default SVG text and SVG-text formula fallbacks only.
- Use only these MacTeX assets, which are SIL OFL 1.1: `cmunrm.otf`, `cmunti.otf`, `cmunbx.otf`, and `cmunbi.otf` from `/usr/local/texlive/2025/texmf-dist/fonts/opentype/public/cm-unicode/`.
- Default SVG output must declare `TikZKitCMUSerif` first and `CMU Serif` second; the latter is the PNG Fontconfig fallback.
- Generated output must place the four assets in `<outputRoot>/fonts/`; TikZKit SVGs under `<outputRoot>/tikzkit-svg/` must use `../fonts/` URLs.
- Workbench SVGs must use `/fonts/` URLs served by `web/server.js`.
- Test-first: observe each new behavioral test fail before production changes.
- Acceptance is visual, not only numeric: activation-functions must retain all five curves, labels, ticks, grid, legend geometry, and zero diagnostics while text visibly moves toward the native Computer Modern outlines.
- Do not claim full TeX mathematical glyph parity. Remaining formula-layout differences are out of scope.
- The current worktree already contains unrelated and uncommitted source changes. Stage and commit only the standalone plan document; for production files record SHA-256 snapshots and do not create a mixed commit.

---

## Native Findings

- `/usr/local/texlive/2025/texmf-dist/tex/generic/pgfplots/pgfplots.code.tex:1038-1042` leaves `every tick label` empty, so default tick labels inherit the active LaTeX font.
- `pgfplots.code.tex:1095-1103` defines legend padding, shape, fill, border, and placement without assigning a legend font.
- `pgfplots.code.tex:4251-4255` gives the `normalsize` axis profile physical dimensions, not a substitute font family.
- `tikztosvg-svg/latex-examples-activation-functions.svg` contains glyph paths, including classic Computer Modern outlines, rather than browser text.
- Current TikZKit SVG uses `KaTeX_Main, 'Times New Roman', Times, serif` and a horizontal serif scale, which is the proven default-font mismatch.

## Task 1: Package And Render The Default CMU Family

**Files:**

- Create: `web/fonts/TikZKitCMUSerif-Roman.otf`
- Create: `web/fonts/TikZKitCMUSerif-Italic.otf`
- Create: `web/fonts/TikZKitCMUSerif-Bold.otf`
- Create: `web/fonts/TikZKitCMUSerif-BoldItalic.otf`
- Create: `src/renderers/svg/defaultFontCss.js`
- Modify: `src/tikz/metrics.js:6`
- Modify: `src/renderers/svg/renderSvg.js:1-65`
- Modify: `web/server.js:42-105`
- Modify: `test/renderer.test.js:185-220,2320-2340`
- Modify: `test/web-server.test.js:1-45`

**Interfaces:**

- `renderDefaultFontStyleDef(options?: { fontUrlPrefix?: string }): string` returns one SVG `<style>` element with four `@font-face` rules.
- `TIKZ_FONT_FAMILY` is exactly `"TikZKitCMUSerif, 'CMU Serif', serif"`.
- `renderSvg(ir, { fontUrlPrefix })` passes `fontUrlPrefix || "/fonts/"` to `renderDefaultFontStyleDef`.

- [x] **Step 1: Write the failing renderer test**

Add a test immediately after the existing basic SVG rendering test:

```js
test("embeds the namespaced CMU default font layer for SVG text", () => {
  const svg = renderSvg(
    { items: [{ type: "textNode", x: 0, y: 0, text: "A", style: { fill: "black" } }], coordinates: {} },
    { margin: 0, fontUrlPrefix: "../fonts/" }
  );

  assert.match(svg, /class="tikzkit-default-font-style"/);
  assert.match(svg, /font-family:TikZKitCMUSerif/);
  assert.match(svg, /url\('\.\.\/fonts\/TikZKitCMUSerif-Roman\.otf'\)/);
  assert.match(svg, /font-family="TikZKitCMUSerif, 'CMU Serif', serif"/);
  assert.doesNotMatch(svg, /font-family="KaTeX_Main/);
});
```

Update the two existing renderer assertions that require `KaTeX_Main` so they require the new exact `TIKZ_FONT_FAMILY` string.

- [x] **Step 2: Run the renderer test red**

Run:

```sh
node --test --test-name-pattern='CMU default font|KaTeX font stack' test/renderer.test.js
```

Expected: the new test fails because no `tikzkit-default-font-style` or `TikZKitCMUSerif` output exists.

- [x] **Step 3: Write the failing workbench-font route test**

In the first `workbench server exposes browser assets` test, request:

```js
const cmuFont = await fetch(`http://127.0.0.1:${port}/fonts/TikZKitCMUSerif-Roman.otf`);
assert.equal(cmuFont.status, 200);
assert.equal(cmuFont.headers.get("content-type"), "font/otf");
```

- [x] **Step 4: Run the server test red**

Run:

```sh
node --test --test-name-pattern='workbench server exposes browser assets' test/web-server.test.js
```

Expected: FAIL because `/fonts/TikZKitCMUSerif-Roman.otf` is not currently allowlisted.

- [x] **Step 5: Add the CMU assets and renderer-owned CSS**

Copy the four source OTF files exactly once:

```text
cmunrm.otf -> web/fonts/TikZKitCMUSerif-Roman.otf
cmunti.otf -> web/fonts/TikZKitCMUSerif-Italic.otf
cmunbx.otf -> web/fonts/TikZKitCMUSerif-Bold.otf
cmunbi.otf -> web/fonts/TikZKitCMUSerif-BoldItalic.otf
```

Implement `src/renderers/svg/defaultFontCss.js`:

```js
const DEFAULT_FONT_URL_PREFIX = "/fonts/";

export function renderDefaultFontStyleDef(options = {}) {
  const prefix = normalizedFontUrlPrefix(options.fontUrlPrefix);
  return `<style class="tikzkit-default-font-style"><![CDATA[
@font-face{font-family:TikZKitCMUSerif;font-style:normal;font-weight:400;src:url('${prefix}TikZKitCMUSerif-Roman.otf') format('opentype')}
@font-face{font-family:TikZKitCMUSerif;font-style:italic;font-weight:400;src:url('${prefix}TikZKitCMUSerif-Italic.otf') format('opentype')}
@font-face{font-family:TikZKitCMUSerif;font-style:normal;font-weight:700;src:url('${prefix}TikZKitCMUSerif-Bold.otf') format('opentype')}
@font-face{font-family:TikZKitCMUSerif;font-style:italic;font-weight:700;src:url('${prefix}TikZKitCMUSerif-BoldItalic.otf') format('opentype')}
]]></style>`;
}

function normalizedFontUrlPrefix(value) {
  const prefix = String(value || DEFAULT_FONT_URL_PREFIX);
  return prefix.endsWith("/") ? prefix : `${prefix}/`;
}
```

Set `TIKZ_FONT_FAMILY` to `"TikZKitCMUSerif, 'CMU Serif', serif"`. Insert the default font style at the start of SVG defs in `renderSvg`, keeping the scoped formula style behavior unchanged.

In `web/server.js`, add `["/fonts/", path.join(PROJECT_ROOT, "web", "fonts")]` before the root route and map `.otf` to `font/otf`.

- [x] **Step 6: Run focused tests green**

Run:

```sh
node --test --test-name-pattern='CMU default font|KaTeX font stack' test/renderer.test.js
node --test --test-name-pattern='workbench server exposes browser assets' test/web-server.test.js
```

Expected: all selected tests pass.

- [x] **Step 7: Record focused source and asset snapshots**

```sh
shasum -a 256 web/fonts/TikZKitCMUSerif-Roman.otf web/fonts/TikZKitCMUSerif-Italic.otf web/fonts/TikZKitCMUSerif-Bold.otf web/fonts/TikZKitCMUSerif-BoldItalic.otf src/renderers/svg/defaultFontCss.js src/tikz/metrics.js src/renderers/svg/renderSvg.js web/server.js test/renderer.test.js test/web-server.test.js
```

## Task 2: Preserve Font Assets In Generated Comparisons And Verify The Real Case

**Files:**

- Modify: `scripts/render-example-fixtures.js:1-40,280-330,529-560`
- Modify: `test/example-render-script.test.js:608-635`
- Create: `outputs/qa-default-cmu-font-layer/` generated artifacts
- Modify: `.superpowers/sdd/progress.md`

**Interfaces:**

- `ensureOutputFonts(outputRoot)` copies all four `web/fonts/TikZKitCMUSerif-*.otf` assets to `<outputRoot>/fonts/`.
- TikZKit render calls in `render-example-fixtures.js` pass `fontUrlPrefix: "../fonts/"`.
- Fontconfig for TikZKit PNG adds `/usr/local/texlive/2025/texmf-dist/fonts/opentype/public/cm-unicode`.

- [x] **Step 1: Write the failing output-asset test**

In the existing PNG conversion test, after the fixture renderer finishes, assert:

```js
assert.equal(await exists(path.join(outputRoot, "fonts", "TikZKitCMUSerif-Roman.otf")), true);
const svg = await readFile(path.join(outputRoot, "tikzkit-svg", "basic.svg"), "utf8");
assert.match(svg, /url\('\.\.\/fonts\/TikZKitCMUSerif-Roman\.otf'\)/);
```

Use the existing test's rendered fixture id instead of inventing a new fixture.

- [x] **Step 2: Run the output-asset test red**

Run the exact existing test name containing `converts SVG artifacts to PNG`:

```sh
node --test --test-name-pattern='converts SVG artifacts to PNG' test/example-render-script.test.js
```

Expected: FAIL because the output `fonts/` directory and relative SVG font URL do not exist.

- [x] **Step 3: Implement output-font copying and Fontconfig support**

Add a source-asset list based on `PROJECT_ROOT/web/fonts`. Before TikZKit SVG generation, copy all four OTFs into `outputRoot/fonts`; pass `fontUrlPrefix: "../fonts/"` into the TikZKit conversion options. Add the CM Unicode MacTeX directory to the generated Fontconfig `<dir>` list so `rsvg-convert` resolves the `CMU Serif` fallback.

- [x] **Step 4: Run output-asset tests green**

Run:

```sh
node --test --test-name-pattern='converts SVG artifacts to PNG|writes TikZKit and tikztosvg artifacts' test/example-render-script.test.js
```

Expected: all selected tests pass.

- [x] **Step 5: Regenerate and inspect activation-functions**

Run:

```sh
npm run examples:render -- --fixtures test/fixtures/examples --output outputs/qa-default-cmu-font-layer --only latex-examples-activation-functions --strict-tikztosvg --no-comparison-grid --external-timeout-ms 120000
npm run examples:diff -- --output outputs/qa-default-cmu-font-layer
```

Inspect these three images:

```text
outputs/qa-default-cmu-font-layer/tikzkit-png/latex-examples-activation-functions.png
outputs/qa-default-cmu-font-layer/tikztosvg-png/latex-examples-activation-functions.png
outputs/qa-default-cmu-font-layer/diff/latex-examples-activation-functions-sheet.png
```

Acceptance:

- both SVGs and PNGs render;
- TikZKit diagnostics are empty;
- all five curves, tick labels, `x/y` labels, grid, and legend remain visible;
- default text and basic math fallback visibly use a Computer Modern-shaped face instead of the old browser fallback;
- no clipping, bbox change greater than `1pt`, legend geometry loss, or formula line-wrap regression.

- [x] **Step 6: Add the visual regression assertion**

Keep the existing activation-function bbox assertion. Add a diagnostic/assertion that its generated TikZKit SVG includes `TikZKitCMUSerif` and a relative `../fonts/` source in the output artifact. Do not assert a guessed global pixel-diff threshold.

- [x] **Step 7: Run the focused regression gate**

Run:

```sh
node --test test/renderer.test.js test/web-server.test.js test/example-render-script.test.js test/pgfplots-seams.test.js
git diff --check
```

Expected: no new failures. Existing documented PGFPlots baselines may remain only if unchanged.

- [x] **Step 8: Record the generator-integration snapshots**

```sh
shasum -a 256 scripts/render-example-fixtures.js test/example-render-script.test.js test/pgfplots-seams.test.js .superpowers/sdd/progress.md
```

## Task 3: Independent Visual Review

**Files:**

- Create: `.superpowers/sdd/default-cmu-font-layer-task-1-report.md`
- Create: `.superpowers/sdd/default-cmu-font-layer-task-2-report.md`

- [x] **Step 1: Have an independent reviewer inspect the source/test diff**

The reviewer must verify that the CMU assets are from the stated MacTeX source, that no `KaTeX_Main` default-text family survives, and that scoped formula HTML remains isolated.

- [x] **Step 2: Have an independent reviewer inspect the three activation-functions images**

The reviewer must report actual visible changes in glyph face, tick labels, legend formulas, clipping, axis placement, curve/legend preservation, and diagnostics. A diff number alone is insufficient.

- [x] **Step 3: Record result and remaining boundary**

Append a progress entry that records the visual evidence, source asset paths, commands, checksums, and the remaining limitation: full TeX math glyph selection/layout remains a distinct capability.

## Plan Self-Review

- Coverage: Task 1 changes only default SVG font ownership and web delivery; Task 2 adds portable generated-output delivery and actual visual verification; Task 3 independently reviews both boundaries.
- Placeholder scan: no TBD/TODO or unspecified test commands remain.
- Type consistency: `fontUrlPrefix` is consumed by `renderSvg`, emitted by `renderDefaultFontStyleDef`, and passed by the fixture generator.
