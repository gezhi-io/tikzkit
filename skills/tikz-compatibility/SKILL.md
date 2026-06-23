---
name: tikz-compatibility
description: Use when fixing this project's TikZ/PGF/PGFPlots compatibility against MacTeX/native output, reviewing real gallery cases, adding extension support, or deciding whether a case is actually complete.
metadata:
  short-description: TikZ native-compatibility workflow and acceptance gates
---

# TikZ Compatibility

## Prime Directive

Do not treat a case as complete because it has zero diagnostics. A case is complete only when parser coverage, semantic IR, SVG output, and native visual comparison all agree closely enough for the supported feature set.

If a user asks whether a case is fixed, you must answer from actual native-vs-JS evidence, not from tests alone. Tests prove regressions are guarded; they do not prove visual compatibility.

If native/JS comparison grid lines are present, use them. A mismatch that is visible on the grid is a real bug even when `meanAbsDiff` looks small. Do not claim progress from diff metrics alone.

## Completion Gates

For each case or feature batch:

1. **Understand the source**
   - Identify packages and libraries: `\usepackage`, `\usetikzlibrary`, `\usepgflibrary`.
   - List TikZ commands/options used by the case.
   - Decide whether each feature belongs in core TikZ, a built-in library, or `src/extensions`.

2. **Compare against native**
   - Generate or inspect MacTeX native PNG when available.
   - Generate JS SVG/PNG.
   - Generate a native/JS/diff contact sheet with `npm run gallery:sheet -- <ids...>` or an equivalent script.
   - Open or screenshot the native image, JS image, and diff image before making a completion claim.
   - Read the affected row from `outputs/real-gallery/diff/report.json` when it exists.
   - Record visible differences: missing elements, wrong coordinates, font/size drift, line width, dash style, color, layer order, arrow tip, anchor clipping, text placement.
   - If any obvious geometry, text, arrow, color, layer, or clipping mismatch remains visible on the sheet, do not say the case is fixed even if tests pass.
   - If the diff row is `ok: false`, do not say the case is fixed unless you inspected the sheet and the only remaining difference is known noise explicitly accepted by the user. Say it is improved, list the remaining differences, and keep working unless the user explicitly stops.

3. **Find the shared root cause**
   - Prefer shared fixes in coordinate transforms, node metrics, shape anchors, arrow tips, style parsing, color handling, text rendering, or extension preprocessing.
   - Avoid one-off coordinate nudges unless the TikZ package itself defines a special layout rule.

4. **Write a failing test first**
   - The test must fail for the missing semantic behavior, not just snapshot incidental output.
   - Prefer IR assertions for semantics and SVG assertions for renderer-specific marker/path/text output.

5. **Implement minimally**
   - Core TikZ behavior goes in parser/interpreter/renderer/shared metrics.
   - TikZ libraries that are standard PGF/TikZ behavior should be built in.
   - Third-party packages should be implemented as `src/extensions/<package>.js`.

6. **Verify**
   - Run the focused test.
   - Run `npm test` when practical.
   - Run `npm run gallery:audit` for gallery-wide diagnostics.
   - For visual work, regenerate JS/native/diff artifacts for the affected case when practical.
   - Run `npm run gallery:sheet -- <ids...>` after regeneration and inspect the generated sheet.
   - Open the refreshed native, JS, and diff images. The final response must mention whether the visual comparison was inspected and whether visible differences remain.

7. **Record status**
   - Update the relevant worklog, especially `docs/pgfplots-compatibility.md` when PGFPlots is involved.
   - Record supported commands/options, missing commands/options, test evidence, and remaining visual risk.

## Native-Likeness Checklist

Check these before marking a visual case done:

- **Coordinate system**: data/user coordinates, transforms, slants, shifts, and unit conversions are applied once, in the correct order.
- **Node metrics**: text/formula width, height, inner sep, outer sep, minimum size, shape border, and anchor position are coherent.
- **Arrow clipping**: node-to-node paths stop at shape borders and account for arrow tip length.
- **Arrow catalogue**: requested arrow tips are represented distinctly in IR and SVG, not silently mapped to a generic arrow.
- **Arrow command semantics**: package commands such as `tikz-cd` `\arrow[...]` must have a dedicated option mapping for direction, labels, swap/description, hook/two-heads/tail/mapsto/no-head, bend, dashed/dotted, and endpoint clipping.
- **Font system**: text and math use the KaTeX/TikZ-like font stack and size scale consistently.
- **Color system**: named colors, defined colors, color mixes, opacity, fill/stroke inheritance, and text colors survive to SVG.
- **Line styles**: TikZ line width presets, custom `line width`, dash/dot patterns, caps, and joins match native intent.
- **Layer order**: backgrounds, fills, grids, axes, edges, nodes, labels, and foreground decorations render in the right order.
- **Extension boundary**: package macros are expanded without hiding unsupported syntax; missing features become diagnostics or worklog entries.

## Case Review Template

Use this shape in the worklog:

```md
### Case NNN - title

- Source packages/libraries:
- Commands/options used:
- Native vs JS differences:
- Root cause:
- Fix:
- Tests:
- Verification:
- Remaining gaps:
```

## Done Means

A feature/case can be called done only when:

- Focused tests pass.
- No new diagnostics are introduced.
- Existing broad tests pass, or any skipped broader check is explicitly explained.
- The real gallery still renders.
- The native/JS/diff images have been inspected after the latest change.
- The affected contact sheet has no visible mismatch in geometry, text, arrows, colors, line styles, layer order, or clipping.
- The affected diff row is within threshold, or the user explicitly accepts the remaining visual difference after seeing/being told the visible remainder.

If the last bullet is not true, do not use words like "fixed", "done", "complete", or "delivered" for that case. Use "improved" and continue with the next concrete root cause.
