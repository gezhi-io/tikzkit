import assert from "node:assert/strict";
import test from "node:test";

import { parseTikz } from "../src/frontend/parser.js";
import { interpretTikz } from "../src/engine/evaluate.js";

function expectClose(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} to be close to ${expected}`);
}

test("renders legacy snakes as independently restarted zigzags with local controls", () => {
  const source = String.raw`
\usetikzlibrary{snakes}
\begin{tikzpicture}
  \draw[snake, segment length=4mm, segment amplitude=1mm,
        line before snake=5mm, line after snake=4mm,
        mirror snake, raise snake=.4mm]
    (0,0) -- (4,0) -- (4,2);
\end{tikzpicture}`;
  const { ast, diagnostics: parseDiagnostics } = parseTikz(source);
  const { ir, diagnostics } = interpretTikz(ast);
  const path = ir.items.find((item) => item.type === "path");

  assert.deepEqual([...parseDiagnostics, ...diagnostics], []);
  assert.ok(path);
  assert.deepEqual(path.commands[0], { type: "moveTo", x: 0, y: 0 });
  // Legacy snakes draw every `--` separately. The first straight lead is 5mm,
  // then it connects directly to the mirrored first apex. Since the installed
  // PGF transform is mirror followed by raise, both offsets are reflected.
  expectClose(path.commands[1].x, 0.5);
  expectClose(path.commands[1].y, 0);
  expectClose(path.commands[2].x, 0.6);
  expectClose(path.commands[2].y, -0.14);
  // The second `--` starts a new old-style snake rather than carrying the
  // first segment's phase through the corner.
  assert.ok(path.commands.some((command) => Math.abs(command.x - 4.14) < 1e-9 && Math.abs(command.y - 0.6) < 1e-9));
});

test("keeps snake=none as an explicit legacy opt-out", () => {
  const source = String.raw`
\usetikzlibrary{snakes}
\begin{tikzpicture}
  \draw[snake=none] (0,0) -- (2,0);
\end{tikzpicture}`;
  const { ast, diagnostics: parseDiagnostics } = parseTikz(source);
  const { ir, diagnostics } = interpretTikz(ast);
  const path = ir.items.find((item) => item.type === "path");

  assert.deepEqual([...parseDiagnostics, ...diagnostics], []);
  assert.deepEqual(path.commands, [
    { type: "moveTo", x: 0, y: 0 },
    { type: "lineTo", x: 2, y: 0 }
  ]);
});

test("supports the old smooth snake spelling and visible gap controls", () => {
  const source = String.raw`
\usetikzlibrary{snakes}
\begin{tikzpicture}
  \draw[snake=snake, segment length=4mm, segment amplitude=1mm, gap around snake=4mm]
    (0,0) -- (2,0);
\end{tikzpicture}`;
  const { ast, diagnostics: parseDiagnostics } = parseTikz(source);
  const { ir, diagnostics } = interpretTikz(ast);
  const path = ir.items.find((item) => item.type === "path");
  const moves = path.commands.filter((command) => command.type === "moveTo");

  assert.deepEqual([...parseDiagnostics, ...diagnostics], []);
  assert.ok(path.commands.some((command) => command.type === "curveTo"), "snake=snake should select the smooth legacy state");
  assert.deepEqual(moves, [
    { type: "moveTo", x: 0, y: 0 },
    { type: "moveTo", x: 0.4, y: 0 },
    { type: "moveTo", x: 2, y: 0 }
  ]);
});
