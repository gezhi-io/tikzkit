import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { collectPgfplotsLibraries } from "../src/pgfplots/index.js";

const FIXTURE_ROOT = new URL("./fixtures/examples/latex-examples/", import.meta.url);

function renderFixture(name) {
  return tikzToSvg(readFileSync(new URL(name, FIXTURE_ROOT), "utf8"), { mathRenderer: "svg-text" });
}

test("pgfplots fillbetween closes the softly clipped region before its named curve", () => {
  const result = renderFixture("force-distance-diagram.tex");
  const paths = result.ir.items.filter((item) => item.type === "path");
  const fillIndex = paths.findIndex((item) => item.style.fill === "rgb(0 255 0)" && item.commands.some((command) => command.type === "closePath"));
  const curveIndex = paths.findIndex((item) => item.style.stroke === "blue");
  const fill = paths[fillIndex];
  const coordinates = fill?.commands.filter((command) => command.type !== "closePath") || [];

  assert.deepEqual(result.diagnostics, []);
  assert.ok(fillIndex >= 0, "expected a green closed fill-between region");
  assert.ok(curveIndex > fillIndex, "the named blue curve should remain above its area fill");
  assert.equal(fill.style.fillOpacity, 0.3);
  assert.ok(Math.abs(Math.min(...coordinates.map((command) => command.x)) - 2.105) < 0.01);
  assert.ok(Math.abs(Math.max(...coordinates.map((command) => command.x)) - 6.314) < 0.01);
});

test("pgfplots fillbetween supports a constant named function path", () => {
  const result = renderFixture("force-distance-diagram-constant.tex");
  const fill = result.ir.items.find(
    (item) => item.type === "path" && item.style.fill === "rgb(0 255 0)" && item.commands.some((command) => command.type === "closePath")
  );
  const textNodes = result.ir.items.filter((item) => item.type === "textNode");
  const bLabel = textNodes.find((item) => item.text === "$b$");
  const cLabel = textNodes.find((item) => item.text === "$c$");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(fill);
  assert.equal(fill.style.fillOpacity, 0.3);
  assert.ok(bLabel, "expected the positional x tick label at x=3");
  assert.ok(cLabel, "expected the positional y tick label at y=3");
  assert.ok(Math.abs(bLabel.x - 6.013) < 0.01);
});

test("pgfplots fillbetween reports its reviewed partial support boundary", () => {
  const [library] = collectPgfplotsLibraries(String.raw`\usepgfplotslibrary{fillbetween}`);

  assert.equal(library.implementationStatus, "partial");
  assert.equal(library.implementedBy, "src/pgfplots/fillBetween.js");
  assert.match(library.localSourceReviewed, /tikzlibrarypgfplots\.fillbetween\.code\.tex$/);
  assert.match(library.notes, /soft clip=\{domain=a:b\}/);
});
