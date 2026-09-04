import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

const CURVED_PATH = String.raw`
\usetikzlibrary{arrows.meta,bending}
\begin{tikzpicture}
  \draw[-{Stealth[length=16pt,flex=0]}] (0,0) .. controls (2,0) and (2.8,1.5) .. (4,0);
  \draw[-{Stealth[length=16pt,flex]}] (0,1) .. controls (2,1) and (2.8,2.5) .. (4,1);
  \draw[-{Stealth[length=16pt,flex'=.75]}] (0,2) .. controls (2,2) and (2.8,3.5) .. (4,2);
  \draw[-{Stealth[length=16pt,bend]}] (0,3) .. controls (2,3) and (2.8,4.5) .. (4,3);
\end{tikzpicture}`;

test("preserves arrows.meta bend, flex, and flex' options in the drawing IR", () => {
  const result = tikzToSvg(CURVED_PATH);
  const paths = result.ir.items.filter((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(paths.map((path) => path.style.markerEnd.bending), [
    { mode: "flex", factor: 0 },
    { mode: "flex", factor: 1 },
    { mode: "flexPrime", factor: 0.75 },
    { mode: "bend" }
  ]);
});

test("uses distinct rigid and nonlinear curved-arrow SVG geometry", () => {
  const result = tikzToSvg(CURVED_PATH);
  const tips = [...result.svg.matchAll(/<path class="tikz-arrow-tip[^>]+/gu)].map((match) => match[0]);

  assert.equal(tips.length, 4);
  assert.match(tips[0], /tikz-arrow-flex[^>]+transform="matrix\(/u);
  assert.match(tips[1], /tikz-arrow-flex[^>]+transform="matrix\(/u);
  assert.notEqual(tips[0].match(/transform="([^"]+)/u)?.[1], tips[1].match(/transform="([^"]+)/u)?.[1]);
  assert.match(tips[2], /tikz-arrow-flexPrime[^>]+transform="matrix\(/u);
  assert.match(tips[3], /tikz-arrow-bend/u);
  assert.doesNotMatch(tips[3], /transform=/u);
  assert.ok((tips[3].match(/ L /gu) || []).length > 20, "bend should deform sampled arrow geometry along the cubic");
});

test("promotes quick siblings to flex when a tip sequence requests bending", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{arrows.meta,bending}
\draw[-{[sep]>[bend]>>}] (0,0) .. controls (1,0) and (1,1) .. (2,1);`);
  const tips = [...result.svg.matchAll(/<path class="tikz-arrow-tip tikz-arrow-to ([^"]+)"/gu)]
    .map((match) => match[1]);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(tips.length, 3);
  assert.deepEqual(tips, ["tikz-arrow-bend", "tikz-arrow-flex", "tikz-arrow-flex"]);
});

test("includes flexed and bent arrow paint in the SVG viewBox", () => {
  const result = tikzToSvg(CURVED_PATH, { margin: 0 });
  const viewBox = result.svg.match(/viewBox="([^"]+)"/u)?.[1].split(/\s+/).map(Number);

  assert.ok(viewBox);
  assert.ok(viewBox.every(Number.isFinite));
  assert.ok(viewBox[2] > 400, `expected curved arrow tips in horizontal bounds, got ${viewBox}`);
  assert.ok(viewBox[3] > 300, `expected all four rows in vertical bounds, got ${viewBox}`);
});
