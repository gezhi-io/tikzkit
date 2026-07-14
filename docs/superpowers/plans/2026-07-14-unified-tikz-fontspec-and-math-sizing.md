# Unified TikZ FontSpec And Math Sizing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ordinary TikZ text, PGFPlots, datavisualization, circuitikz, browser math, SVG math fallback, node measurement, anchors, and bounding boxes share MacTeX-compatible physical font sizes.

**Architecture:** Add a renderer-neutral `FontSpec` layer under `src/tex/`, with the 10pt LaTeX profile and semantic library-role policies separated into focused files. Source parsing and library lowering resolve a `FontSpec` before creating text IR; SVG text and math renderers consume that resolved physical size and expose one shared measured box. Legacy `fontScale` remains readable through one compatibility adapter while migrated code stops introducing raw font constants.

**Tech Stack:** ESM JavaScript, Node.js built-in test runner, existing TikZKit AST/IR/SVG pipeline, local MacTeX 2025, local `tikztosvg`, `rsvg-convert`, Python Pillow visual sheets.

---

## File Structure

- Create `src/tex/fontProfiles.js`: immutable LaTeX document-class font profiles and exact 10pt size table.
- Create `src/tex/fontSpec.js`: FontSpec construction, merging, command parsing, and legacy scale conversion.
- Create `src/tex/fontPolicies.js`: library-role policy registry for TikZ core, PGFPlots, datavisualization, and circuitikz.
- Create `test/font-spec.test.js`: canonical size, parsing, precedence, validation, and compatibility tests.
- Create `test/font-policies.test.js`: role-policy and explicit-override tests.
- Modify `src/tikz/text.js`: delegate named-size parsing to `fontSpec.js`; remove its duplicate size table.
- Modify `src/tikz/textMetrics.js`: consume physical `sizePt` through FontSpec and remove its duplicate named-size table.
- Modify `src/interpreter.js`: resolve and attach normalized `font` data to text-bearing IR while preserving legacy fields during migration.
- Modify `src/renderers/svg/textEngine.js`: accept FontSpec and measure/render plain text and math from the same `sizePt`.
- Modify `src/renderers/svg/textLayout.js`: prefer `item.font.sizePt` and use the legacy adapter only when FontSpec is absent.
- Modify `src/renderers/svg/plainTextNode.js`: derive SVG font size and line baselines from FontSpec.
- Modify `src/renderers/svg/mathNode.js`: expose a physical formula box contract and keep the internal 1.21 KaTeX compensation private.
- Modify `src/pgfplots/ticks.js`: resolve tick font roles instead of defaulting boxed axes to `scriptsize`.
- Modify `src/pgfplots/axis3d.js`: resolve 3D tick and colorbar roles through the same PGFPlots policy.
- Modify `src/pgfplots/legend.js`: resolve legend role and size geometry from FontSpec.
- Modify `src/frontend/latex-shell.js`: apply datavisualization role policies in its current focused lowering path.
- Modify `src/packages/circuitikz.js`: register package font-role metadata.
- Modify `src/renderers/svg/circuitikzNodes.js`: consume circuitikz absolute symbol roles through FontSpec.
- Create `scripts/render-font-visual-gates.js`: generate native, tikztosvg, TikZKit, diff, and comparison sheets for four fixed gates.
- Create `test/fixtures/font-visual-gates/manifest.json`: deterministic case IDs and source locations.
- Modify `package.json`: add `font:gates` command.
- Modify `docs/architecture.md`: document the FontSpec boundary and library-role extension contract.

### Task 1: Canonical 10pt Font Profile

**Files:**
- Create: `src/tex/fontProfiles.js`
- Create: `src/tex/fontSpec.js`
- Create: `test/font-spec.test.js`

- [ ] **Step 1: Write the failing canonical-profile tests**

```js
// test/font-spec.test.js
import test from "node:test";
import assert from "node:assert/strict";
import {
  createFontSpec,
  fontSpecFromSizeCommand,
  fontSpecFromLegacyScale,
  mergeFontSpec
} from "../src/tex/fontSpec.js";

test("matches the MacTeX size10.clo font table", () => {
  const expected = {
    tiny: [5, 6], scriptsize: [7, 8], footnotesize: [8, 9.5], small: [9, 11],
    normalsize: [10, 12], large: [12, 14], Large: [14.4, 18],
    LARGE: [17.28, 22], huge: [20.74, 25], Huge: [24.88, 30]
  };
  for (const [name, [sizePt, baselineSkipPt]] of Object.entries(expected)) {
    assert.deepEqual(fontSpecFromSizeCommand(`\\${name}`), {
      ...createFontSpec(), sizePt, baselineSkipPt, source: "content-command"
    });
  }
});

test("merges property patches without resetting inherited size", () => {
  const small = fontSpecFromSizeCommand("\\small", { source: "library-role" });
  assert.deepEqual(mergeFontSpec(small, { weight: 700, source: "node-option" }), {
    ...small, weight: 700, source: "node-option"
  });
});

test("converts legacy scales through the canonical 10pt profile", () => {
  assert.equal(fontSpecFromLegacyScale(0.5).sizePt, 5);
  assert.equal(fontSpecFromLegacyScale(1).sizePt, 10);
});
```

- [ ] **Step 2: Run the test and verify it fails because the FontSpec module does not exist**

Run: `node --test test/font-spec.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/tex/fontSpec.js`.

- [ ] **Step 3: Add the immutable MacTeX 10pt profile**

```js
// src/tex/fontProfiles.js
export const LATEX_10PT_FONT_PROFILE = Object.freeze({
  tiny: Object.freeze({ sizePt: 5, baselineSkipPt: 6 }),
  scriptsize: Object.freeze({ sizePt: 7, baselineSkipPt: 8 }),
  footnotesize: Object.freeze({ sizePt: 8, baselineSkipPt: 9.5 }),
  small: Object.freeze({ sizePt: 9, baselineSkipPt: 11 }),
  normalsize: Object.freeze({ sizePt: 10, baselineSkipPt: 12 }),
  large: Object.freeze({ sizePt: 12, baselineSkipPt: 14 }),
  Large: Object.freeze({ sizePt: 14.4, baselineSkipPt: 18 }),
  LARGE: Object.freeze({ sizePt: 17.28, baselineSkipPt: 22 }),
  huge: Object.freeze({ sizePt: 20.74, baselineSkipPt: 25 }),
  Huge: Object.freeze({ sizePt: 24.88, baselineSkipPt: 30 })
});

export function documentFontProfile(name = "10pt") {
  if (name !== "10pt") throw new RangeError(`Unsupported document font profile: ${name}`);
  return LATEX_10PT_FONT_PROFILE;
}
```

- [ ] **Step 4: Implement FontSpec creation, merging, named-size lookup, and legacy conversion**

```js
// src/tex/fontSpec.js
import { documentFontProfile } from "./fontProfiles.js";

const DEFAULT_FONT_SPEC = Object.freeze({
  sizePt: 10, baselineSkipPt: 12, family: "serif", weight: 400,
  style: "normal", variant: "normal", mathStyle: "text", source: "document"
});

export function createFontSpec(patch = {}) {
  return validateFontSpec({ ...DEFAULT_FONT_SPEC, ...definedProperties(patch) });
}

export function mergeFontSpec(base = DEFAULT_FONT_SPEC, patch = {}) {
  return validateFontSpec({ ...createFontSpec(base), ...definedProperties(patch) });
}

export function fontSpecFromSizeCommand(command, options = {}) {
  const name = String(command || "").trim().replace(/^\\/, "");
  const size = documentFontProfile(options.profile || "10pt")[name];
  if (!size) return null;
  return createFontSpec({ ...size, source: options.source || "content-command" });
}

export function fontSpecFromLegacyScale(scale, base = DEFAULT_FONT_SPEC) {
  const value = Number(scale);
  return mergeFontSpec(base, {
    sizePt: base.sizePt * (Number.isFinite(value) && value > 0 ? value : 1),
    baselineSkipPt: base.baselineSkipPt * (Number.isFinite(value) && value > 0 ? value : 1),
    source: "legacy-scale"
  });
}

function definedProperties(value) {
  return Object.fromEntries(Object.entries(value || {}).filter(([, item]) => item !== undefined && item !== null));
}

function validateFontSpec(spec) {
  if (!(Number(spec.sizePt) > 0) || !(Number(spec.baselineSkipPt) > 0)) {
    throw new RangeError("FontSpec sizes must be finite positive TeX points");
  }
  return { ...spec, sizePt: Number(spec.sizePt), baselineSkipPt: Number(spec.baselineSkipPt) };
}
```

- [ ] **Step 5: Run the focused test and full baseline tests**

Run: `node --test test/font-spec.test.js test/svg-renderer.test.js`

Expected: all tests PASS.

- [ ] **Step 6: Commit the canonical profile**

```bash
git add src/tex/fontProfiles.js src/tex/fontSpec.js test/font-spec.test.js
git commit -m "Add canonical TeX FontSpec profile"
```

### Task 2: Font Commands And Resolution Precedence

**Files:**
- Modify: `src/tex/fontSpec.js`
- Modify: `src/tikz/text.js`
- Modify: `src/tikz/textMetrics.js`
- Modify: `test/font-spec.test.js`

- [ ] **Step 1: Add failing tests for command parsing and precedence**

```js
// append to test/font-spec.test.js
import { parseTikzFontPatch, resolveFontSpec } from "../src/tex/fontSpec.js";
import { fontScaleFromTikzFont, normalizeTikzText } from "../src/tikz/text.js";

test("resolves document scope library node and content layers in order", () => {
  const resolved = resolveFontSpec({
    document: createFontSpec(),
    scope: parseTikzFontPatch("\\sffamily"),
    libraryRole: parseTikzFontPatch("\\small"),
    nodeOption: parseTikzFontPatch("\\bfseries"),
    contentCommand: parseTikzFontPatch("\\fontsize{6}{7}\\selectfont")
  });
  assert.deepEqual(resolved, {
    sizePt: 6, baselineSkipPt: 7, family: "sans-serif", weight: 700,
    style: "normal", variant: "normal", mathStyle: "text", source: "content-command"
  });
});

test("uses the same tiny scale in normalization and metrics", () => {
  assert.equal(fontScaleFromTikzFont("\\tiny"), 0.5);
  assert.equal(normalizeTikzText("\\tiny x").scale, 0.5);
});
```

- [ ] **Step 2: Run the tests and verify the known tiny mismatch is red**

Run: `node --test test/font-spec.test.js`

Expected: FAIL because `parseTikzFontPatch` is missing and the current tiny scale is `0.42`.

- [ ] **Step 3: Implement named, family, weight, style, variant, and `fontsize` patches**

```js
// add to src/tex/fontSpec.js
export function parseTikzFontPatch(source, options = {}) {
  const text = String(source || "");
  const patch = { source: options.source || "node-option" };
  const sizes = [...text.matchAll(/\\(Huge|huge|LARGE|Large|large|normalsize|small|footnotesize|scriptsize|tiny)\b/g)];
  if (sizes.length) Object.assign(patch, documentFontProfile(options.profile || "10pt")[sizes.at(-1)[1]]);
  const explicit = [...text.matchAll(/\\fontsize\s*\{([^{}]+)\}\s*\{([^{}]+)\}\s*\\selectfont/g)].at(-1);
  if (explicit) {
    patch.sizePt = Number(explicit[1]);
    patch.baselineSkipPt = Number(explicit[2]);
  }
  if (/\\(?:sffamily|sf)\b/.test(text)) patch.family = "sans-serif";
  if (/\\(?:ttfamily|tt)\b/.test(text)) patch.family = "monospace";
  if (/\\(?:rmfamily|rm|normalfont)\b/.test(text)) patch.family = "serif";
  if (/\\(?:bfseries|bf)\b/.test(text)) patch.weight = 700;
  if (/\\(?:mdseries)\b/.test(text)) patch.weight = 400;
  if (/\\(?:itshape|slshape)\b/.test(text)) patch.style = "italic";
  if (/\\upshape\b/.test(text)) patch.style = "normal";
  if (/\\scshape\b/.test(text)) patch.variant = "small-caps";
  return definedProperties(patch);
}

export function resolveFontSpec(layers = {}) {
  return ["document", "scope", "libraryRole", "nodeOption", "contentCommand"]
    .reduce((font, key) => layers[key] ? mergeFontSpec(font, layers[key]) : font, createFontSpec());
}
```

- [ ] **Step 4: Replace duplicate named-size maps with the shared profile**

```js
// src/tikz/text.js
import { fontSpecFromSizeCommand } from "../tex/fontSpec.js";

export function fontScaleFromTikzFont(font) {
  const matches = [...String(font ?? "").matchAll(/\\(Huge|huge|LARGE|Large|large|normalsize|small|footnotesize|scriptsize|tiny)\b/g)];
  if (!matches.length) return 1;
  return fontSpecFromSizeCommand(`\\${matches.at(-1)[1]}`).sizePt / 10;
}
```

Change `readLeadingFontSize` in `src/tikz/text.js` and `leadingMathFontSize` in `src/tikz/textMetrics.js` to call `fontSpecFromSizeCommand()` and divide `sizePt` by 10. Delete `FONT_SIZE_SCALES` and `MATH_FONT_SIZE_SCALES` after all references use the shared profile.

- [ ] **Step 5: Run text, metrics, and renderer tests**

Run: `node --test test/font-spec.test.js test/svg-renderer.test.js test/renderer.test.js`

Expected: all tests PASS; `tiny` resolves to 5pt everywhere.

- [ ] **Step 6: Commit command parsing and duplicate-table removal**

```bash
git add src/tex/fontSpec.js src/tikz/text.js src/tikz/textMetrics.js test/font-spec.test.js
git commit -m "Unify TikZ font command resolution"
```

### Task 3: FontSpec On Text IR And Core Node Measurement

**Files:**
- Modify: `src/interpreter.js`
- Modify: `src/renderers/svg/textEngine.js`
- Modify: `src/renderers/svg/textLayout.js`
- Modify: `src/renderers/svg/plainTextNode.js`
- Modify: `test/interpreter.test.js`
- Modify: `test/svg-renderer.test.js`

- [ ] **Step 1: Add failing IR and measurement tests**

```js
// append focused tests to test/interpreter.test.js
test("attaches a resolved FontSpec to text nodes", () => {
  const result = tikzToSvg(String.raw`\begin{tikzpicture}[font=\small]\node[font=\bfseries] at (0,0) {A};\end{tikzpicture}`);
  const node = result.ir.items.find((item) => item.type === "textNode");
  assert.deepEqual(node.font, {
    sizePt: 9, baselineSkipPt: 11, family: "serif", weight: 700,
    style: "normal", variant: "normal", mathStyle: "text", source: "node-option"
  });
});

// append to test/svg-renderer.test.js
test("measures plain text and inline math at the same resolved physical size", () => {
  const engine = createSvgTextEngine({ unit: 100, mathRenderer: "svg-text" });
  const plain = engine.measure({ text: "x", font: createFontSpec({ sizePt: 9, baselineSkipPt: 11 }) });
  const math = engine.measure({ text: "$x$", font: createFontSpec({ sizePt: 9, baselineSkipPt: 11 }) });
  assert.ok(Math.abs(plain.height - math.height) <= 4);
  assert.equal(plain.fontSizePt, 9);
  assert.equal(math.fontSizePt, 9);
});
```

- [ ] **Step 2: Run the focused tests and verify FontSpec is absent from IR**

Run: `node --test test/interpreter.test.js --test-name-pattern="resolved FontSpec" && node --test test/svg-renderer.test.js --test-name-pattern="same resolved physical size"`

Expected: both focused tests FAIL before implementation.

- [ ] **Step 3: Resolve FontSpec when creating text-bearing IR**

```js
// helper added near text item creation in src/interpreter.js
import { createFontSpec, fontSpecFromLegacyScale, parseTikzFontPatch, resolveFontSpec } from "./tex/fontSpec.js";

function resolvedTextFont(style = {}, normalized = {}, context = {}) {
  const legacy = fontSpecFromLegacyScale(Number(style.fontScale) || 1, createFontSpec());
  return resolveFontSpec({
    document: context.documentFont || createFontSpec(),
    scope: parseTikzFontPatch(context.scopeFont || "", { source: "scope" }),
    nodeOption: {
      ...legacy,
      ...parseTikzFontPatch(style.font || "", { source: "node-option" }),
      ...(style.fontFamily ? { family: style.fontFamily } : {}),
      ...(style.fontWeight ? { weight: style.fontWeight } : {}),
      ...(style.fontStyle ? { style: style.fontStyle } : {})
    },
    contentCommand: parseTikzFontPatch(normalized.raw || "", { source: "content-command" })
  });
}
```

Attach `font: resolvedTextFont(...)` to every ordinary textNode creation point; keep legacy `style.fontScale`, `fontFamily`, `fontWeight`, and `fontStyle` unchanged during this task.

- [ ] **Step 4: Make the SVG text engine prefer FontSpec**

```js
// src/renderers/svg/textEngine.js
function requestFontSpec(request = {}) {
  if (request.font?.sizePt > 0) return createFontSpec(request.font);
  if (Number(request.fontSizePt) > 0) {
    return createFontSpec({ sizePt: Number(request.fontSizePt), baselineSkipPt: Number(request.fontSizePt) * 1.2 });
  }
  return createFontSpec();
}
```

Use `requestFontSpec(request).sizePt / 10` in `measureMathRequest`, `measurePlainTextRequest`, and `logicalPlainTextBox`. Include `fontSizePt` in returned metrics so callers and tests can verify the physical contract.

- [ ] **Step 5: Make layout and plain SVG text prefer `item.font`**

```js
// src/renderers/svg/textLayout.js
export function textFontScale(item = {}, normalized = {}) {
  if (Number(item.font?.sizePt) > 0) return Number(item.font.sizePt) / 10;
  const key = normalized?.explicitFontSize ? item.style?.fontSizeBaseScale : item.style?.fontScale;
  return Number(key) > 0 ? Number(key) : 1;
}
```

In `src/renderers/svg/plainTextNode.js`, calculate base line height from `item.font.baselineSkipPt / item.font.sizePt` when FontSpec exists; preserve the existing ratio for legacy items.

- [ ] **Step 6: Run core interpreter and renderer regressions**

Run: `node --test test/font-spec.test.js test/interpreter.test.js test/svg-renderer.test.js test/renderer.test.js`

Expected: all tests PASS and existing non-migrated IR remains renderable.

- [ ] **Step 7: Commit core FontSpec IR support**

```bash
git add src/interpreter.js src/renderers/svg/textEngine.js src/renderers/svg/textLayout.js src/renderers/svg/plainTextNode.js test/interpreter.test.js test/svg-renderer.test.js
git commit -m "Carry FontSpec through text IR"
```

### Task 4: Library Font-Role Registry And PGFPlots

**Files:**
- Create: `src/tex/fontPolicies.js`
- Create: `test/font-policies.test.js`
- Modify: `src/pgfplots/ticks.js`
- Modify: `src/pgfplots/axis3d.js`
- Modify: `src/pgfplots/legend.js`
- Modify: `test/pgfplots-seams.test.js`

- [ ] **Step 1: Write failing policy and PGFPlots-default tests**

```js
// test/font-policies.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { resolveLibraryFont } from "../src/tex/fontPolicies.js";

test("uses native PGFPlots role defaults and named profiles", () => {
  assert.equal(resolveLibraryFont("pgfplots", "tick").sizePt, 10);
  assert.equal(resolveLibraryFont("pgfplots", "tick", { profile: "small" }).sizePt, 8);
  assert.equal(resolveLibraryFont("pgfplots", "axisLabel", { profile: "small" }).sizePt, 9);
  assert.equal(resolveLibraryFont("pgfplots", "legend", { profile: "tiny" }).sizePt, 5);
  assert.equal(resolveLibraryFont("pgfplots", "title", { profile: "tiny" }).sizePt, 8);
});
```

```js
// append to test/pgfplots-seams.test.js
test("keeps boxed PGFPlots ticks at inherited normalsize by default", () => {
  const commands = renderAxisTicks({}, [], ranges, geometry);
  assert.ok(commands.some((command) => /axis tick label[^\n]*font=\\normalsize/.test(command)));
  assert.ok(!commands.some((command) => /axis tick label[^\n]*font=\\scriptsize/.test(command)));
});
```

- [ ] **Step 2: Run tests and verify the boxed-axis regression fails**

Run: `node --test test/font-policies.test.js test/pgfplots-seams.test.js --test-name-pattern="font|boxed PGFPlots"`

Expected: FAIL because the policy module is absent and boxed tick labels currently emit `scriptsize`.

- [ ] **Step 3: Add semantic library-role policies**

```js
// src/tex/fontPolicies.js
import { createFontSpec, fontSpecFromSizeCommand, mergeFontSpec, parseTikzFontPatch } from "./fontSpec.js";

const POLICIES = Object.freeze({
  pgfplots: Object.freeze({
    default: { tick: "normalsize", axisLabel: "normalsize", legend: "normalsize", title: "normalsize", colorbarTick: "normalsize" },
    small: { tick: "footnotesize", axisLabel: "small", legend: "footnotesize", title: "small", colorbarTick: "footnotesize" },
    footnotesize: { tick: "footnotesize", axisLabel: "small", legend: "footnotesize", title: "small", colorbarTick: "footnotesize" },
    tiny: { tick: "tiny", axisLabel: "tiny", legend: "tiny", title: "footnotesize", colorbarTick: "tiny" }
  }),
  datavisualization: Object.freeze({
    default: { tick: "footnotesize", axisLabel: "small", dataSetLabel: "small", insideLegend: "footnotesize" }
  }),
  circuitikz: Object.freeze({
    default: { label: "normalsize", annotation: "normalsize", tinySymbol: { sizePt: 6, baselineSkipPt: 7 }, normalSymbol: { sizePt: 10, baselineSkipPt: 12 }, largeSymbol: { sizePt: 12, baselineSkipPt: 14 } }
  })
});

export function resolveLibraryFont(library, role, options = {}) {
  const policy = POLICIES[library]?.[options.profile || "default"]?.[role]
    ?? POLICIES[library]?.default?.[role];
  const base = createFontSpec(options.inherited);
  const rolePatch = typeof policy === "string"
    ? fontSpecFromSizeCommand(`\\${policy}`, { source: "library-role" })
    : { ...policy, source: "library-role" };
  const explicit = parseTikzFontPatch(options.explicit || "", { source: "node-option" });
  return mergeFontSpec(mergeFontSpec(base, rolePatch || {}), explicit);
}
```

- [ ] **Step 4: Replace PGFPlots font guesses with policy lookups**

Add a helper that converts resolved size back to a canonical command while the PGFPlots lowerer still emits TikZ source:

```js
// src/tex/fontPolicies.js
export function fontSpecToTikzSizeCommand(font) {
  const names = [[5,"tiny"],[7,"scriptsize"],[8,"footnotesize"],[9,"small"],[10,"normalsize"],[12,"large"],[14.4,"Large"],[17.28,"LARGE"],[20.74,"huge"],[24.88,"Huge"]];
  const exact = names.find(([size]) => Math.abs(size - font.sizePt) < 1e-6);
  return exact ? `\\${exact[1]}` : `\\fontsize{${font.sizePt}}{${font.baselineSkipPt}}\\selectfont`;
}
```

In `src/pgfplots/ticks.js`, set `tickLabelFont` from the explicit option or `resolveLibraryFont("pgfplots", "tick", { profile })`; default profile is `default`, so both middle and boxed axes emit `normalsize`. Apply the same helper to 3D ticks, colorbar ticks, scale labels, and legends. Preserve explicit `axis tick label font` and `legend style={font=...}` as the final override.

- [ ] **Step 5: Run PGFPlots unit and real-case tests**

Run: `node --test test/font-policies.test.js test/pgfplots-seams.test.js test/pgfplots-docsrc.test.js`

Expected: all tests PASS; the activation-functions default tick and legend roles are 10pt.

- [ ] **Step 6: Commit PGFPlots font roles**

```bash
git add src/tex/fontPolicies.js test/font-policies.test.js src/pgfplots/ticks.js src/pgfplots/axis3d.js src/pgfplots/legend.js test/pgfplots-seams.test.js
git commit -m "Match native PGFPlots font roles"
```

### Task 5: Datavisualization And Circuitikz Font Roles

**Files:**
- Modify: `src/frontend/latex-shell.js`
- Modify: `src/packages/circuitikz.js`
- Modify: `src/renderers/svg/circuitikzNodes.js`
- Modify: `test/extensions.test.js`
- Modify: `test/circuitikz-real-cases.test.js`
- Modify: `test/font-policies.test.js`

- [ ] **Step 1: Add failing datavisualization and circuitikz role tests**

```js
// append to test/font-policies.test.js
test("uses native datavisualization and circuitikz roles", () => {
  assert.equal(resolveLibraryFont("datavisualization", "tick").sizePt, 8);
  assert.equal(resolveLibraryFont("datavisualization", "axisLabel").sizePt, 9);
  assert.equal(resolveLibraryFont("datavisualization", "insideLegend").sizePt, 8);
  assert.equal(resolveLibraryFont("circuitikz", "tinySymbol").sizePt, 6);
  assert.equal(resolveLibraryFont("circuitikz", "largeSymbol").sizePt, 12);
});
```

```js
// append to test/extensions.test.js
test("lowers datavisualization labels with native role sizes", () => {
  const result = tikzToSvg(String.raw`\usetikzlibrary{datavisualization.formats.functions}\tikz \datavisualization[scientific axes=clean,x axis={label=$x$},visualize as line=a,a={label in legend={text=$a$}}] data[format=function]{var x:interval[0:1];func y=x;};`);
  const labels = result.ir.items.filter((item) => item.type === "textNode");
  assert.ok(labels.some((item) => item.text.includes("x") && item.font?.sizePt === 9));
  assert.ok(labels.some((item) => item.text.includes("a") && item.font?.sizePt === 8));
});
```

- [ ] **Step 2: Run focused library tests and verify role sizes are not carried in IR**

Run: `node --test test/font-policies.test.js test/extensions.test.js --test-name-pattern="native.*roles|native role sizes"`

Expected: the IR assertion FAILS before lowering requests the role policies.

- [ ] **Step 3: Apply datavisualization role commands at its lowering boundary**

```js
// helper near expandDatavisualizationFunctions in src/frontend/latex-shell.js
import { fontSpecToTikzSizeCommand, resolveLibraryFont } from "../tex/fontPolicies.js";

function datavisualizationRoleFont(role, explicit = "") {
  return fontSpecToTikzSizeCommand(resolveLibraryFont("datavisualization", role, { explicit }));
}
```

Use `datavisualizationRoleFont("tick")` for generated tick nodes, `axisLabel` for axis labels, `dataSetLabel` for pins/data labels, and `insideLegend` for inside-legend labels. Append an explicit source style after the role command so source options retain precedence.

- [ ] **Step 4: Map circuitikz symbol roles to FontSpec**

```js
// src/packages/circuitikz.js
export const circuitikzFontRoles = Object.freeze({
  label: "label", annotation: "annotation", tiny: "tinySymbol",
  normal: "normalSymbol", large: "largeSymbol"
});
```

In `src/renderers/svg/circuitikzNodes.js`, replace absolute local font-size constants for those supported symbol classes with `resolveLibraryFont("circuitikz", circuitikzFontRoles[key])`; pass the resolved FontSpec to the generated text item and derive any SVG fallback size from `font.sizePt`.

- [ ] **Step 5: Run datavisualization, circuitikz, and extension regressions**

Run: `node --test test/font-policies.test.js test/extensions.test.js test/circuitikz-real-cases.test.js`

Expected: all tests PASS; source-explicit fonts override library roles.

- [ ] **Step 6: Commit library role migration**

```bash
git add src/frontend/latex-shell.js src/packages/circuitikz.js src/renderers/svg/circuitikzNodes.js test/extensions.test.js test/circuitikz-real-cases.test.js test/font-policies.test.js
git commit -m "Apply native library font policies"
```

### Task 6: One Physical Formula Box Contract

**Files:**
- Modify: `src/renderers/svg/mathNode.js`
- Modify: `src/renderers/svg/textEngine.js`
- Modify: `src/renderers/svg/bounds.js`
- Modify: `test/svg-renderer.test.js`

- [ ] **Step 1: Add failing formula-box contract tests**

```js
// append to test/svg-renderer.test.js
import { measureMathBoxPt, scopedMathHostFontSize } from "../src/renderers/svg/mathNode.js";

test("keeps KaTeX compensation private while exposing a 10pt formula box", () => {
  const box = measureMathBoxPt(String.raw`x_i^2`, { font: createFontSpec(), displayMode: false });
  assert.equal(box.fontSizePt, 10);
  assert.ok(box.widthPt > 0);
  assert.ok(box.heightPt > 0);
  assert.ok(box.depthPt >= 0);
  assert.equal(scopedMathHostFontSize(box.svgFontSize), box.svgFontSize / 1.21);
});

test("agrees between browser and SVG fallback formula boxes", () => {
  const font = createFontSpec({ sizePt: 9, baselineSkipPt: 11 });
  const browser = measureMathBoxPt(String.raw`A=\begin{pmatrix}2&1\\0&3\end{pmatrix}`, { font, renderer: "katex" });
  const fallback = measureMathBoxPt(String.raw`A=\begin{pmatrix}2&1\\0&3\end{pmatrix}`, { font, renderer: "svg-text" });
  assert.ok(Math.abs(browser.widthPt - fallback.widthPt) <= 0.1);
  assert.ok(Math.abs((browser.heightPt + browser.depthPt) - (fallback.heightPt + fallback.depthPt)) <= 0.1);
});
```

- [ ] **Step 2: Run the focused tests and verify `measureMathBoxPt` is missing**

Run: `node --test test/svg-renderer.test.js --test-name-pattern="formula box|KaTeX compensation"`

Expected: FAIL because the physical box API does not exist.

- [ ] **Step 3: Implement the renderer-neutral physical formula box**

```js
// src/renderers/svg/mathNode.js
const TEX_PT_PER_CM = 28.4527559;

export function measureMathBoxPt(tex, options = {}) {
  const font = createFontSpec(options.font);
  const displayMode = Boolean(options.displayMode);
  const unit = TEX_PT_PER_CM;
  const scale = font.sizePt / 10;
  const svg = estimateMathBox(normalizeKatexTex(tex), displayMode, unit, scale);
  const totalHeightPt = svg.height;
  const depthPt = Math.max(0, totalHeightPt * 0.2);
  return {
    widthPt: svg.width,
    heightPt: totalHeightPt - depthPt,
    depthPt,
    baselinePt: totalHeightPt - depthPt,
    fontSizePt: font.sizePt,
    svgFontSize: svg.fontSize
  };
}
```

Refactor `renderMathNode`, `measureMathRequest`, and `src/renderers/svg/bounds.js` so browser foreignObject, SVG fallback, node measurement, and bbox derive from this returned box. Keep `KATEX_ROOT_FONT_SCALE` and `scopedMathHostFontSize()` inside `mathNode.js`; remove caller-side compensation.

- [ ] **Step 4: Use FontSpec baseline in both browser and fallback paths**

Return `baselineY` from `measureMathRequest` using `box.baselinePt`, and position fallback SVG text using the same baseline. Size foreignObject from `widthPt` and `heightPt + depthPt`, converted once at the renderer boundary.

- [ ] **Step 5: Run formula, node, and bbox regressions**

Run: `node --test test/svg-renderer.test.js test/renderer.test.js test/interpreter.test.js`

Expected: all tests PASS; matrices, scripts, and inline formulas remain visible without clipping.

- [ ] **Step 6: Commit formula box unification**

```bash
git add src/renderers/svg/mathNode.js src/renderers/svg/textEngine.js src/renderers/svg/bounds.js test/svg-renderer.test.js
git commit -m "Unify browser and SVG math boxes"
```

### Task 7: Four Visual Gates With Native And tikztosvg References

**Files:**
- Create: `test/fixtures/font-visual-gates/manifest.json`
- Create: `scripts/render-font-visual-gates.js`
- Modify: `package.json`
- Create output at runtime: `outputs/font-visual-gates/`

- [ ] **Step 1: Add a manifest for the four fixed visual gates**

```json
{
  "cases": [
    { "id": "activation-functions", "sourceId": "latex-examples-activation-functions" },
    { "id": "3d-function-9", "sourceId": "latex-examples-3d-function-9" },
    { "id": "datavisualization-functions", "sourceId": "datavisualization-002" },
    { "id": "circuitikz-labels", "sourceId": "circuitikz-font-gate" }
  ],
  "tolerances": { "visibleBoxPt": 1, "anchorPt": 1 }
}
```

- [ ] **Step 2: Write the artifact generator using existing render helpers**

```js
// scripts/render-font-visual-gates.js
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { tikzToSvg } from "../src/index.js";

const root = path.resolve("outputs/font-visual-gates");
const manifest = JSON.parse(await fs.readFile("test/fixtures/font-visual-gates/manifest.json", "utf8"));
await fs.mkdir(root, { recursive: true });

for (const entry of manifest.cases) {
  const source = await loadFixtureSource(entry.sourceId);
  const caseDir = path.join(root, entry.id);
  await fs.mkdir(caseDir, { recursive: true });
  const js = tikzToSvg(source, { mathRenderer: "katex" });
  await fs.writeFile(path.join(caseDir, "tikzkit.svg"), js.svg);
  run("rsvg-convert", [path.join(caseDir, "tikzkit.svg"), "-o", path.join(caseDir, "tikzkit.png")]);
  run("tikztosvg", ["--input", path.join(caseDir, "source.tex"), "--output", path.join(caseDir, "tikztosvg.svg")]);
  run("rsvg-convert", [path.join(caseDir, "tikztosvg.svg"), "-o", path.join(caseDir, "tikztosvg.png")]);
  await renderNativeMacTeX(source, caseDir);
  await writeComparisonArtifacts(caseDir, manifest.tolerances);
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr}`);
}
```

Implement `loadFixtureSource`, `renderNativeMacTeX`, and `writeComparisonArtifacts` by importing the existing source lookup and native/diff helpers already used by `scripts/render-example-fixtures.js` and `scripts/diff-example-pngs.js`; keep source loading, MacTeX invocation, and Pillow sheet generation in those existing helper boundaries instead of duplicating shell parsing.

- [ ] **Step 3: Add the package command**

```json
{
  "scripts": {
    "font:gates": "node scripts/render-font-visual-gates.js"
  }
}
```

- [ ] **Step 4: Generate all native, tikztosvg, TikZKit, diff, and sheet artifacts**

Run: `npm run font:gates`

Expected for each case directory: `source.tex`, `native.png`, `tikztosvg.svg`, `tikztosvg.png`, `tikzkit.svg`, `tikzkit.png`, `diff.png`, `sheet.png`, and `metrics.json`.

- [ ] **Step 5: Inspect all four sheets visually**

Open these exact files and record findings in `outputs/font-visual-gates/summary.md`:

```text
outputs/font-visual-gates/activation-functions/sheet.png
outputs/font-visual-gates/3d-function-9/sheet.png
outputs/font-visual-gates/datavisualization-functions/sheet.png
outputs/font-visual-gates/circuitikz-labels/sheet.png
```

Acceptance for each sheet: no missing or clipped glyphs, scripts, delimiters, tick labels, legends, or axis labels; supported visible text/formula boxes differ by at most 1pt from native; anchor centers differ by at most 1pt. A failing case returns to the responsible task and is regenerated before this task passes.

- [ ] **Step 6: Commit the reproducible visual gates**

```bash
git add test/fixtures/font-visual-gates/manifest.json scripts/render-font-visual-gates.js package.json
git commit -m "Add native font visual gates"
```

### Task 8: Architecture Documentation And Final Regression

**Files:**
- Modify: `docs/architecture.md`
- Modify: `docs/superpowers/specs/2026-07-11-tikz-font-spec-and-math-sizing-design.md`

- [ ] **Step 1: Document the extension contract**

Add this section to `docs/architecture.md`:

```markdown
## FontSpec Boundary

All text-bearing IR carries a physical TeX-point FontSpec. Commands and libraries resolve fonts before rendering; renderers never guess TikZ library defaults. A library adds semantic roles in `src/tex/fontPolicies.js`, requests a role while lowering, and lets explicit source font options override the role. The SVG renderer converts `sizePt` once at its boundary. Browser math owns its internal KaTeX compensation and returns the same physical box used by SVG fallback, node anchors, and bounding boxes.
```

- [ ] **Step 2: Run the complete automated suite**

Run: `npm test`

Expected: PASS with no new diagnostics in the four visual-gate cases.

- [ ] **Step 3: Re-run and inspect the visual gates after the full suite**

Run: `npm run font:gates`

Expected: all four `metrics.json` files report visible-box and anchor deltas within the manifest limits, and all four `sheet.png` files satisfy the visual checklist.

- [ ] **Step 4: Record implementation status in the design spec**

Append a dated implementation note listing the completed tasks, the four artifact directories, the full test command, and any unsupported NFSS behavior that remains outside the approved scope. Do not mark unsupported behavior as implemented.

- [ ] **Step 5: Commit final documentation**

```bash
git add docs/architecture.md docs/superpowers/specs/2026-07-11-tikz-font-spec-and-math-sizing-design.md
git commit -m "Document FontSpec rendering boundary"
```

## Plan Self-Review

- Spec coverage: canonical table, resolution order, library policies, IR boundary, shared metrics, browser/SVG math, error validation, unit gates, library gates, and four visual gates each map to a numbered task.
- Placeholder scan: implementation steps provide concrete file paths, APIs, commands, expected failures, and acceptance criteria; no unresolved placeholder is used.
- Type consistency: every task uses the same `FontSpec` fields (`sizePt`, `baselineSkipPt`, `family`, `weight`, `style`, `variant`, `mathStyle`, `source`) and the same public helpers (`createFontSpec`, `mergeFontSpec`, `parseTikzFontPatch`, `resolveFontSpec`, `resolveLibraryFont`).
