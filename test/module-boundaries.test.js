import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { checkModuleGraph, findImportCycles } from "../scripts/check-architecture.js";

test("detects import cycles and self imports without mistaking shared leaves for cycles", () => {
  assert.deepEqual(findImportCycles(new Map([
    ["a", ["b", "c"]], ["b", ["c"]], ["c", []]
  ])), []);
  assert.deepEqual(findImportCycles(new Map([
    ["a", ["b"]], ["b", ["a"]], ["c", ["c"]]
  ])), [["a", "b", "a"], ["c", "c"]]);
});

test("rejects renderer coupling and transitive decoration dependencies on orchestration", () => {
  const report = checkModuleGraph(new Map([
    ["tikz/decorations/path.js", ["engine/helper.js"]],
    ["engine/helper.js", ["renderers/svg/renderSvg.js"]],
    ["renderers/svg/renderSvg.js", []]
  ]));
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((error) => error.startsWith("Semantic module imports a renderer")));
  assert.ok(report.errors.some((error) => error.includes("tikz/decorations/path.js -> engine/helper.js -> renderers/svg/renderSvg.js")));
});

test("does not allow unrelated cycles under the legacy text exception", () => {
  const report = checkModuleGraph(new Map([
    ["tikz/text.js", ["frontend/latex-shell.js"]],
    ["frontend/latex-shell.js", ["tikz/text.js"]],
    ["engine/new.js", ["engine/new.js"]]
  ]));
  assert.equal(report.knownDebt.length, 1);
  assert.ok(report.errors.includes("Import cycle: engine/new.js -> engine/new.js"));
});

test("checks all runtime static imports using V8 without evaluating the package", () => {
  const child = spawnSync(process.execPath, [
    "--experimental-vm-modules", "scripts/check-architecture.js"
  ], { cwd: new URL("../", import.meta.url), encoding: "utf8", timeout: 30000 });
  assert.equal(child.status, 0, child.stderr + child.stdout);
  const report = JSON.parse(child.stdout);
  assert.equal(report.ok, true);
  assert.ok(report.modules > 400);
  assert.deepEqual(report.errors, []);
});
