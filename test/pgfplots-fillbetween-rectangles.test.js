import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { explicitFillBetweenClipBox, fillBetweenClipSelector } from "../src/pgfplots/fillBetweenClipSelectors.js";

const forceDistance = readFileSync(new URL("./fixtures/examples/latex-examples/force-distance-diagram.tex", import.meta.url), "utf8");

function forceArea(selector) {
  const r = tikzToSvg(forceDistance.replace("soft clip={domain=1:3}", "soft clip={" + selector + "}"));
  assert.deepEqual(r.diagnostics, []);
  return r.ir.items.find(p => p.style?.fillOpacity === .3 && p.commands?.some(c => c.type === "closePath"));
}

test("the force-distance example's two numeric cutoffs can be written as a clip rectangle", () => {
  const expected = forceArea("domain=1:3");
  const xs = expected.commands.filter(c => c.type !== "closePath").map(c => c.x);
  assert.ok(Math.abs(Math.min(...xs) - 2.105) < .01 && Math.abs(Math.max(...xs) - 6.314) < .01);
  for (const selector of [
    "(axis cs:1,-1) rectangle (axis cs:3,4)",
    "path={(axis cs:1,-1) rectangle (axis cs:3,4)}",
    "path={(axis cs:{max(0,1)},-1) rectangle (axis cs:3,4)}"
  ]) {
    const commands = forceArea(selector)?.commands;
    assert.equal(commands?.length, expected.commands.length, selector);
    commands.forEach((c, i) => assert.deepEqual(c, expected.commands[i], selector + " vertex " + i));
  }

  // MacTeX's actual fill path ends at PDF x=200.039,81.137 for the
  // forward window, but 81.137,200.039 for the reversed window. Only the
  // baseline is a single segment with two tied intersections; keep that order.
  const reversed = forceArea("path={(axis cs:3,4) rectangle (axis cs:1,-1)}");
  const path = expected.commands;
  assert.deepEqual(reversed?.commands,
    [...path.slice(0, -3), path.at(-2), path.at(-3), path.at(-1)]);
});

test("a rectangle missing either input leaves no fill even when the other input crosses it", () => {
  assert.ok(!forceArea("(axis cs:1,.5) rectangle (axis cs:3,4)"));
});

test("the rendered fill uses the rectangle bound at that point in the axis", () => {
  const save = String.raw`\path[name path=window] (axis cs:1,-1) rectangle (axis cs:3,4);`;
  const line = String.raw`\path[name path=window] (axis cs:1,-1) -- (axis cs:3,4);`;
  const fillStart = String.raw`\addplot[fill=green`;
  const source = forceDistance.replace("soft clip={domain=1:3}", "soft clip={name=window}");
  const area = r => r.ir.items.find(p => p.style?.fillOpacity === .3 && p.commands?.some(c => c.type === "closePath"));
  const bound = source.replace(fillStart, save + "\n" + fillStart);
  for (const input of [bound, bound.replace("soft clip={name=window}", "soft clip={window}")]) {
    const r = tikzToSvg(input);
    assert.deepEqual(r.diagnostics, []);
    assert.deepEqual(area(r)?.commands, forceArea("domain=1:3").commands);
  }
  for (const input of [source, source.replace("\\end{axis}", save + "\n\\end{axis}"),
    bound.replace(fillStart, line + "\n" + fillStart)]) {
    const r = tikzToSvg(input);
    assert.deepEqual(r.diagnostics.map(d => d.code), ["pgfplots-soft-clip-unresolved"]);
    assert.equal(area(r), undefined);
    assert.ok(r.ir.items.some(p => p.style?.stroke === "blue"), "keep the original curve");
  }
});

test("soft clip assignments select a contour; they do not intersect earlier assignments", () => {
  assert.deepEqual(fillBetweenClipSelector("window one"), { kind: "name", value: "window one" });
  assert.deepEqual(fillBetweenClipSelector("domain=1:4, name={window two}"), { kind: "name", value: "window two" });
  assert.deepEqual(fillBetweenClipSelector("name=old, /tikz/soft clip assign/y domain y=-2:3"),
    { kind: "domain", value: "domain y=-2:3" });
});

test("rectangle corners share the plotted and axis-description coordinate systems", () => {
  const ranges = { xMin: 2, xMax: 8, yMin: 0, yMax: 3 };
  const geometry = { mapPoint: ({ x, y }) => ({ x: 30 - 2 * x, y: 10 + y }),
    mapAxisDescriptionPoint: ({ x, y }) => ({ x: 14 + x * 12, y: 10 + y * 3 }) };
  const rect = "(axis cs:\\pgfkeysvalueof{/pgfplots/xmin},2) rectangle (axis description cs:.25,1)";
  assert.deepEqual(explicitFillBetweenClipBox(rect, ranges, geometry),
    { minX: 17, minY: 12, maxX: 26, maxY: 13, flipX: true });
  for (const path of ["(axis cs:3,2) -- (axis cs:5,4)", "(3,2) rectangle (4,3) -- cycle",
    "(unknown cs:3,2) rectangle (4,3)", "(axis cs:1,2,3) rectangle (4,3)"]) {
    assert.equal(explicitFillBetweenClipBox(path, ranges, geometry), null, path);
  }
});
