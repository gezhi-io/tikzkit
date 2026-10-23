import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { renderExampleFixtures } from "../scripts/render-example-fixtures.js";
import { assertNativeText } from "./helpers/native-math-svg.js";

test("renders birthday-paradox with its manifest-provided pgfplots table", async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "tikzkit-birthday-paradox-"));
  const summary = await renderExampleFixtures({
    fixtureRoot: path.resolve("test", "fixtures", "examples"),
    outputRoot,
    only: ["latex-examples-birthday-paradox"],
    skipTikztosvg: true,
    skipPng: true
  });

  const [entry] = summary.cases;
  assert.equal(entry.diagnostics.some((diagnostic) => /Could not resolve pgfplots table/.test(diagnostic.message)), false);
  const svg = await readFile(path.join(outputRoot, entry.tikzkitSvg), "utf8");
  assertNativeText(svg, "23");
  assertNativeText(svg, "0.51");
});
