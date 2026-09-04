import test from "node:test";
import assert from "node:assert/strict";
import { tikzToSvg } from "../src/index.js";

function close(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} to be within ${epsilon} of ${expected}`);
}

function nodeBox(result, name) {
  return result.ir.items.find((item) => item.type === "nodeBox" && item.id === name);
}

test("rotate fit computes an oriented coordinate box and rotates the resulting node", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{fit}
\begin{tikzpicture}
  \coordinate (a) at (1,1);
  \coordinate (b) at (2,2);
  \coordinate (c) at (1,2);
  \coordinate (d) at (1.25,.25);
  \coordinate (e) at (1.75,1.5);
  \node[draw,rotate fit=30,fit=(a)(b)(c)(d)(e),inner sep=0pt] (f) {};
\end{tikzpicture}`);

  assert.deepEqual(result.diagnostics, []);
  const fit = nodeBox(result, "f");
  assert.ok(fit);
  close(fit.x, 1.5);
  close(fit.y, 1.341506, 1e-5);
  close(fit.width, 1.524519, 1e-5);
  close(fit.height, 1.640544, 1e-5);
  close(fit.rotation, 30);
});

test("fit distinguishes bare node bounds from an explicit node anchor", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{fit}
\begin{tikzpicture}
  \node[draw,minimum width=2cm,minimum height=1cm,inner sep=0pt] (a) at (0,0) {};
  \node[draw,minimum width=2cm,minimum height=1cm,inner sep=0pt] (b) at (4,0) {};
  \node[draw=blue,fit=(a)(b),inner sep=0pt] (whole) {};
  \node[draw=red,fit=(a.center)(b.north),inner sep=0pt] (anchors) {};
\end{tikzpicture}`);

  assert.deepEqual(result.diagnostics, []);
  const whole = nodeBox(result, "whole");
  const anchors = nodeBox(result, "anchors");
  assert.ok(whole && anchors);
  assert.ok(whole.width > anchors.width + 1.9, `${whole.width} should include both node borders, unlike ${anchors.width}`);
  assert.ok(whole.height > anchors.height + 0.45, `${whole.height} should include full node height, unlike ${anchors.height}`);
  close(anchors.x, 2);
  assert.ok(anchors.y > 0.24 && anchors.y < 0.26, `expected anchor-only fit center y near .25, got ${anchors.y}`);
});

test("rotate fit uses rotated compass anchors when a full node is fitted", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{fit}
\begin{tikzpicture}
  \node[draw,rotate=30,minimum width=2cm,minimum height=1cm,inner sep=0pt,outer sep=0pt] (a) {};
  \node[draw=red,rotate fit=30,fit=(a),inner sep=0pt,outer sep=0pt] (f) {};
\end{tikzpicture}`);

  assert.deepEqual(result.diagnostics, []);
  const fit = nodeBox(result, "f");
  assert.ok(fit);
  close(fit.x, 0);
  close(fit.y, 0);
  close(fit.width, 2, 1e-5);
  close(fit.height, 1, 1e-5);
  close(fit.rotation, 30);
});

test("rotate fit follows TikZ key order when fit is evaluated first", () => {
  const result = tikzToSvg(String.raw`
\usetikzlibrary{fit}
\begin{tikzpicture}
  \coordinate (a) at (0,0);
  \coordinate (b) at (4,2);
  \node[draw,fit=(a)(b),rotate fit=30,inner sep=0pt] (f) {};
\end{tikzpicture}`);

  assert.deepEqual(result.diagnostics, []);
  const fit = nodeBox(result, "f");
  assert.ok(fit);
  close(fit.x, 2);
  close(fit.y, 1);
  close(fit.width, 4);
  close(fit.height, 2);
  close(fit.rotation, 30);
});
