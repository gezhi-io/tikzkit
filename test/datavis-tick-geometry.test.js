import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tikzToSvg } from "../src/index.js";

const pt = 72.27 / 2.54;
const load = name => readFileSync(new URL(`./fixtures/datavis-tick-geometry/${name}.tex`, import.meta.url), "utf8");
const render = source => {
  const result = tikzToSvg(source);
  assert.deepEqual(result.diagnostics, []);
  return result.ir.items;
};
const ticks = (items, axis) => items.filter(item => item.subtype === "axis-tick" &&
  Math.abs(item.commands[0][axis] - item.commands.at(-1)[axis]) < 1e-6);
const lengthPt = tick => Math.hypot(tick.commands[0].x - tick.commands.at(-1).x,
  tick.commands[0].y - tick.commands.at(-1).y) * pt;
const near = (a, b, tolerance = .003) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

test("school-book major ticks extend 2pt on each side, with no mark at either origin", () => {
  const items = render(readFileSync(new URL("./fixtures/datavis-failure-audit/school-book-ticks.tex", import.meta.url), "utf8"));
  const all = items.filter(item => item.subtype === "axis-tick");
  assert.equal(all.length, 12);
  for (const tick of all) near(lengthPt(tick), 4);
  const xTicks = ticks(items, "x");
  assert.equal(xTicks.length, 6);
  assert.equal(items.filter(item => item.type === "textNode" && item.text === "0").length, 1);
});

test("manual low-side options change tick endpoints and label paint, not only text content", () => {
  const items = render(load("manual-low"));
  const xTicks = ticks(items, "x");
  assert.equal(xTicks.length, 5);
  near(lengthPt(xTicks[1]), 5);
  // PGF evaluates 1ex in the outer 10pt CM font, before the 8pt tick node.
  near(lengthPt(xTicks[2]), 2 + 4.30554);
  assert.equal(xTicks[2].style.stroke, "red");
  const label = items.find(item => item.type === "textNode" && item.text === "1");
  assert.equal(label.style.fill, "blue");
  assert.equal(items.find(item => item.type === "textNode" && item.text === "$p$").style.fill, "red");
  assert.ok(!items.some(item => item.type === "textNode" && item.text === "3"));
});

test("high-side padding extends only the high endpoint and moves its label by the same amount", () => {
  const source = load("manual-high");
  const padded = render(source), plain = render(source.replace("tick text padding=4pt", "tick text padding=0pt"));
  const a = ticks(padded, "x"), b = ticks(plain, "x");
  near(lengthPt(a[1]), 8);
  near(lengthPt(a[2]), 6);
  near(a[1].commands[0].y, b[1].commands[0].y);
  near((a[1].commands.at(-1).y - b[1].commands.at(-1).y) * pt, 4);
  const label = items => items.find(item => item.type === "textNode" && item.text === "$a$");
  near((label(padded).y - label(plain).y) * pt, 4);
});

test("stack padding alternates by the native one-based tick ordinal", () => {
  const items = render(load("stacked-ticks"));
  const xTicks = ticks(items, "x");
  assert.equal(xTicks.length, 5);
  for (const [index, tick] of xTicks.entries()) near(lengthPt(tick), index % 2 ? 5 : 2);
  const yTicks = ticks(items, "y");
  assert.equal(yTicks.length, 3);
  for (const [index, tick] of yTicks.entries()) near(lengthPt(tick), index === 1 ? 9 : 4);
});

test("single-point scientific axes retain both numeric zero labels", () => {
  const items = render(load("single-zero"));
  assert.equal(items.filter(item => item.type === "textNode" && item.text === "0").length, 2);
  assert.equal(items.filter(item => item.subtype === "axis-tick").length, 2);
});

test("duplicate tick values preserve occurrence-local options and labels", () => {
  const items = render(load("duplicate-ticks"));
  const xTicks = ticks(items, "x");
  assert.equal(xTicks.length, 4);
  near(xTicks[1].commands[0].x, xTicks[3].commands[0].x);
  near(lengthPt(xTicks[1]), 4);
  near(lengthPt(xTicks[3]), 8);
  assert.equal(xTicks[1].style.stroke, "red");
  assert.equal(xTicks[3].style.stroke, "blue");
  const a = items.find(item => item.type === "textNode" && item.text === "$a$");
  const b = items.find(item => item.type === "textNode" && item.text === "$b$");
  assert.ok(a && b, "each occurrence keeps its own TeX label");
  assert.equal(a.style.fill, "red");
  assert.equal(b.style.fill, "blue");
  assert.ok(a.y > b.y);
});

test("Cartesian axes do not inherit PGFPlots arrowheads or scientific tick colors", () => {
  const items = render(load("manual-high"));
  const axes = items.filter(item => item.subtype === "axis-line");
  assert.equal(axes.length, 2);
  assert.ok(axes.every(item => !item.style.markerStart && !item.style.markerEnd));
  assert.ok(ticks(items, "x").every(item => item.style.stroke === "black"));
});

test("value-based tick styles override geometry without replacing occurrence text", () => {
  const items = render(load("tick-style-order"));
  const marks = ticks(items, "x");
  assert.equal(marks.length, 4);
  marks.forEach((mark, index) => near(lengthPt(mark), index === 0 || index === 3 ? 8 : 4));
  assert.deepEqual(marks.map(mark => mark.style.stroke), ["red", "rgb(128 128 128)", "rgb(128 128 128)", "blue"]);
  // PGF replays this list; sorting or deduplicating changes style ordinals.
  near(marks[0].commands[0].x, 5);
  near(marks[1].commands[0].x, 0);
  near(marks[2].commands[0].x, 2.5);
  near(marks[3].commands[0].x, 5);
  const labels = items.filter(item => item.type === "textNode").map(item => item.text);
  assert.deepEqual(labels, ["$a$", "0", "1", "$b$", "0", "1"]);
});

test("school-book axes use the native default TikZ arrow instead of stealth", () => {
  const items = render(readFileSync(new URL("./fixtures/datavis-failure-audit/school-book-ticks.tex", import.meta.url), "utf8"));
  const axes = items.filter(item => item.subtype === "axis-line");
  assert.equal(axes.length, 2);
  assert.ok(axes.every(item => item.style.markerEnd?.kind === "to"));
});
