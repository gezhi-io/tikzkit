import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { interpretTikz, parseTikz } from "../src/index.js";

function render(source) {
  const result = interpretTikz(parseTikz(source).ast);
  assert.deepEqual(result.diagnostics, []);
  return result.ir;
}

function onlyDrawnPath(source) {
  const paths = render(source).items.filter(
    (item) => item.type === "path" && item.commands?.some((command) => command.type !== "moveTo")
  );
  assert.equal(paths.length, 1);
  return paths[0];
}

function commandPoint(command) {
  return { x: command.x, y: command.y };
}

test("expands a horizontal-then-vertical custom to path", () => {
  const path = onlyDrawnPath(String.raw`
\begin{tikzpicture}
  \draw[to path={-| (\tikztotarget) \tikztonodes}]
    (0,0) to node[midway] {route} (3,2);
\end{tikzpicture}`);

  assert.deepEqual(path.commands.map((command) => command.type), ["moveTo", "lineTo", "lineTo"]);
  assert.deepEqual(commandPoint(path.commands[1]), { x: 3, y: 0 });
  assert.deepEqual(commandPoint(path.commands[2]), { x: 3, y: 2 });
});

test("expands a vertical-then-horizontal custom to path", () => {
  const path = onlyDrawnPath(String.raw`
\begin{tikzpicture}
  \draw[to path={|- (\tikztotarget) \tikztonodes}] (0,0) to (3,2);
\end{tikzpicture}`);

  assert.deepEqual(path.commands.map((command) => command.type), ["moveTo", "lineTo", "lineTo"]);
  assert.deepEqual(commandPoint(path.commands[1]), { x: 0, y: 2 });
  assert.deepEqual(commandPoint(path.commands[2]), { x: 3, y: 2 });
});

test("uses custom to path geometry for edge operations", () => {
  const path = onlyDrawnPath(String.raw`
\begin{tikzpicture}
  \path (0,0) edge[to path={-| (\tikztotarget) \tikztonodes}]
    node[midway] {edge} (3,2);
\end{tikzpicture}`);

  assert.deepEqual(path.commands.map((command) => command.type), ["moveTo", "lineTo", "lineTo"]);
  assert.deepEqual(commandPoint(path.commands[1]), { x: 3, y: 0 });
  assert.deepEqual(commandPoint(path.commands[2]), { x: 3, y: 2 });
});

test("expands relative prelegs before the target route", () => {
  const path = onlyDrawnPath(String.raw`
\begin{tikzpicture}
  \draw[to path={-- ++(0,1) -| (\tikztotarget) \tikztonodes}] (0,0) to (3,2);
\end{tikzpicture}`);

  assert.deepEqual(path.commands.map((command) => command.type), ["moveTo", "lineTo", "lineTo", "lineTo"]);
  assert.deepEqual(commandPoint(path.commands[1]), { x: 0, y: 1 });
  assert.deepEqual(commandPoint(path.commands[2]), { x: 3, y: 1 });
  assert.deepEqual(commandPoint(path.commands[3]), { x: 3, y: 2 });
});

test("expands start- and target-relative cubic controls in a to path template", () => {
  const path = onlyDrawnPath(String.raw`
\begin{tikzpicture}
  \draw[to path={(\tikztostart) .. controls +(1,1) and +(-1,1) ..
    (\tikztotarget) \tikztonodes}] (0,0) to (4,0);
\end{tikzpicture}`);
  const curve = path.commands.at(-1);

  assert.equal(curve.type, "curveTo");
  assert.deepEqual(
    { x1: curve.x1, y1: curve.y1, x2: curve.x2, y2: curve.y2, x: curve.x, y: curve.y },
    { x1: 1, y1: 1, x2: 3, y2: 1, x: 4, y: 0 }
  );
});

test("inserts template nodes and original to nodes exactly once", () => {
  const ir = render(String.raw`
\begin{tikzpicture}
  \draw[to path={-- (\tikztotarget)
    node[at start] {start} node[at end] {end} \tikztonodes}]
    (0,0) to node[midway] {middle} (4,0);
\end{tikzpicture}`);
  const labels = ir.items
    .filter((item) => item.type === "textNode")
    .map((item) => item.text)
    .filter((text) => ["start", "middle", "end"].includes(text));

  assert.deepEqual(labels.sort(), ["end", "middle", "start"]);
});

for (const fixture of ["flowchart", "math", "physics"]) {
  test(`renders the custom to path ${fixture} fixture without diagnostics`, () => {
    const source = readFileSync(
      new URL(`./fixtures/examples/paths/custom-to-path-${fixture}.tex`, import.meta.url),
      "utf8"
    );
    const ir = render(source);
    const routes = ir.items.filter((item) => {
      if (item.type !== "path") return false;
      if (fixture === "math") return item.commands?.some((command) => command.type === "curveTo");
      return item.commands?.filter((command) => command.type !== "moveTo").length >= 2;
    });

    assert.ok(routes.length >= 2, `expected at least two custom routes, got ${routes.length}`);
  });
}

test("keeps endpoint nodes from a real LaTeX-examples custom straight template", () => {
  const source = readFileSync(
    new URL("./fixtures/examples/latex-examples/intersecting-lines-5.tex", import.meta.url),
    "utf8"
  );
  const ir = render(source);
  const endpointMarks = ir.items.filter(
    (item) => item.type === "nodeBox" && item.shape === "crossOut"
  );

  assert.equal(endpointMarks.length, 4);
});
