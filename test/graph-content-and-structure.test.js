import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";

test("renders graph-content-and-structure edges, labels, and label layout boxes", async () => {
  const source = await readFile(
    new URL("./fixtures/examples/latex-examples/graph-content-and-structure.tex", import.meta.url),
    "utf8"
  );
  const { diagnostics, ir } = tikzToSvg(source, { mathRenderer: "svg-text" });

  assert.deepEqual(diagnostics, []);
  assert.equal(ir.items.filter((item) => item.type === "nodeBox").length, 12);

  const graphPaths = ir.items.filter((item) => item.type === "path");
  assert.equal(graphPaths.length, 16);
  assert.equal(graphPaths.filter((item) => item.commands.some((command) => command.type === "curveTo")).length, 2);
  assert.equal(graphPaths.filter((item) => item.style.dashArray?.length).length, 2);

  const labels = ir.items.filter((item) => item.type === "textNode" && /(?:Sturkturknoten|Wortknoten)/.test(item.text));
  assert.deepEqual(labels.map((item) => item.text), ["Sturkturknoten", "Wortknoten"]);
  assert.ok(labels.every((item) => item.nodeLayoutWidth > 0 && item.nodeLayoutHeight > 0));
});
