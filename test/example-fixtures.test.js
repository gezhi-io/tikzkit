import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { discoverExampleSources } from "../scripts/render-example-fixtures.js";
import { tikzToSvg } from "../src/index.js";

const FIXTURE_ROOT = path.resolve("test", "fixtures", "examples");
const manifest = JSON.parse(readFileSync(path.join(FIXTURE_ROOT, "manifest.json"), "utf8"));

test("example fixture manifest points at existing sources with semantic owners", () => {
  assert.equal(manifest.version, 1);
  assert.ok(manifest.cases.length >= 8);

  const ids = new Set();
  for (const entry of manifest.cases) {
    assert.equal(typeof entry.id, "string");
    assert.equal(ids.has(entry.id), false, `duplicate fixture id ${entry.id}`);
    ids.add(entry.id);
    assert.ok(entry.semanticOwner?.startsWith("src/"), `missing semantic owner for ${entry.id}`);
    assert.ok(Array.isArray(entry.features) && entry.features.length > 0, `missing features for ${entry.id}`);
    assert.equal(existsSync(path.join(FIXTURE_ROOT, entry.source)), true, `missing source for ${entry.id}`);
  }
});

test("example fixture manifest includes real LaTeX-examples source cases", () => {
  const realCases = manifest.cases.filter((entry) => entry.sourceCorpus === "LaTeX-examples-master/tikz");

  assert.ok(realCases.length >= 5, "expected at least five copied LaTeX-examples TikZ cases");
  for (const entry of realCases) {
    assert.equal(typeof entry.externalSource, "string", `missing external source for ${entry.id}`);
    assert.equal(entry.externalSource.startsWith("/Users/kaiwu/Downloads/LaTeX-examples-master/tikz/"), false);
    assert.equal(existsSync(path.join(FIXTURE_ROOT, entry.source)), true, `missing copied source for ${entry.id}`);
  }
});

test("knot-trefoil declares its local brunnian package resource", () => {
  const trefoil = manifest.cases.find((entry) => entry.id === "latex-examples-knot-trefoil");
  const cyclicGraph = manifest.cases.find((entry) => entry.id === "latex-examples-cyclic-graph");
  const graphBanner = manifest.cases.find((entry) => entry.id === "latex-examples-graph-banner");

  assert.deepEqual(trefoil?.resources, [
    {
      name: "brunnian.sty",
      source: "latex-examples/resources/knot-trefoil/brunnian.sty"
    }
  ]);
  assert.equal(cyclicGraph?.resources, undefined);
  assert.equal(graphBanner?.resources, undefined);
});

test("example fixture manifest tracks every copied LaTeX-examples source with corpus metadata", async () => {
  const sources = await discoverExampleSources(FIXTURE_ROOT);
  const copiedRealSources = sources.filter((source) => source.startsWith("latex-examples/"));
  const manifestBySource = new Map(manifest.cases.map((entry) => [entry.source, entry]));

  assert.ok(copiedRealSources.length >= 30, `expected at least 30 copied LaTeX-examples sources, got ${copiedRealSources.length}`);
  for (const source of copiedRealSources) {
    const entry = manifestBySource.get(source);
    assert.ok(entry, `missing manifest entry for ${source}`);
    assert.equal(entry.sourceCorpus, "LaTeX-examples-master/tikz", `missing source corpus for ${source}`);
    assert.equal(typeof entry.externalSource, "string", `missing external source for ${source}`);
    assert.ok(entry.semanticOwner?.startsWith("src/"), `missing semantic owner for ${source}`);
    assert.ok(Array.isArray(entry.features) && entry.features.length > 0, `missing features for ${source}`);
  }
});

test("example fixture corpus includes at least 30 copied LaTeX-examples TikZ sources", async () => {
  const sources = await discoverExampleSources(FIXTURE_ROOT);
  const realSources = sources.filter((source) => source.startsWith("latex-examples/"));

  assert.ok(realSources.length >= 30, `expected at least 30 LaTeX-examples sources, got ${realSources.length}`);
  assert.ok(realSources.every((source) => !path.isAbsolute(source)), "copied fixtures must use relative source paths");
});

test("example fixtures convert through the public TikZ to SVG pipeline", () => {
  for (const entry of manifest.cases) {
    const source = readFileSync(path.join(FIXTURE_ROOT, entry.source), "utf8");
    const result = tikzToSvg(source, { mathRenderer: "svg-text" });
    const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");

    assert.equal(errors.length, 0, `${entry.id} emitted errors: ${errors.map((item) => item.message).join("; ")}`);
    assert.match(result.svg, /<svg class="tikz-render-svg"/, `${entry.id} did not render an SVG document`);
  }
});

test("Hopfield fixture preserves macro ranges, nested foreach edges, and rotated labels", () => {
  const source = readFileSync(path.join(FIXTURE_ROOT, "latex-examples", "hopfield-network.tex"), "utf8");
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const boxes = result.ir.items.filter((item) => item.type === "nodeBox");
  const paths = result.ir.items.filter((item) => item.type === "path");
  const labels = result.ir.items.filter((item) => item.type === "textNode");
  const transitionPaths = paths.filter((item) => item.style.lineWidth > 4);
  const selfTransitions = transitionPaths.filter((item) => {
    const [start, end] = item.commands;
    return start?.type === "moveTo" && end?.type === "lineTo" && start.x === end.x && start.y === end.y;
  });
  const weightLabels = labels.filter((item) => item.style.fill === "red");

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(boxes.map((item) => item.id), ["N-1", "N-2", "N-3", "N-4", "N-5"]);
  assert.ok(boxes.every((item) => Math.abs(Math.hypot(item.x, item.y) - 1.95) < 1e-6));
  assert.ok(boxes.every((item) => item.style.fill === "white" && item.style.stroke === "black"));
  assert.equal(transitionPaths.length, 27, "expected 25 nested-foreach transitions plus two learned overlays");
  assert.equal(selfTransitions.length, 5, "self transitions should remain zero-length and therefore invisible");
  assert.deepEqual(weightLabels.map((item) => item.text), ["$w_{1,2}$", "$w_{1,5}$"]);
  assert.ok(Math.abs(weightLabels[0].rotation - 35) < 1e-6);
  assert.ok(Math.abs(weightLabels[1].rotation + 37) < 1e-6);
});

test("feed-forward perceptron expands nested foreach connections with scaled Latex start tips", () => {
  const source = readFileSync(path.join(FIXTURE_ROOT, "latex-examples", "feed-forward-perceptron.tex"), "utf8");
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const boxes = result.ir.items.filter((item) => item.type === "nodeBox");
  const paths = result.ir.items.filter((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(
    boxes.map((item) => item.id),
    ["b1", "b2", "i1", "i2", "i3", "i4", "i5", "h1", "h2", "h3", "o1"]
  );
  assert.equal(paths.length, 22, "expected four output edges and three six-edge hidden bundles");
  assert.ok(paths.every((item) => item.style.markerStart?.kind === "latex"));
  assert.ok(paths.every((item) => !item.style.markerEnd));
  assert.ok(paths.every((item) => item.style.lineWidth > 2.8));
  assert.match(result.svg, /class="tikz-arrow-tip tikz-arrow-latex"/);
});

test("Bellman-Ford frames retain named vertices across consecutive tikzpictures", () => {
  const source = readFileSync(path.join(FIXTURE_ROOT, "latex-examples", "bellman-ford-algorithm.tex"), "utf8");
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const arrows = result.ir.items.filter((item) => item.type === "path" && item.style.markerEnd?.kind === "to");
  const curvedEdges = arrows.filter((item) => item.commands.some((command) => command.type === "curveTo"));
  const nodeBoxes = result.ir.items.filter((item) => item.type === "nodeBox");
  const labels = result.ir.items.filter((item) => item.type === "textNode").map((item) => item.text);

  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.ast.figures.length, 3);
  assert.equal(nodeBoxes.length, 26);
  assert.equal(arrows.length, 30, "expected all ten graph edges in each of the three frames");
  assert.equal(curvedEdges.length, 6, "expected two bend-right edges in every frame");
  assert.equal(labels.filter((text) => text === "$\\infty$").length, 16);
  assert.equal(labels.includes("\\weight"), false);
  assert.equal(labels.includes("\\pred"), false);
  assert.doesNotMatch(result.svg, /\\(?:begin|end)\{(?:frame|figure)\}/);
  const secondFrameA = result.ir.items.find((item) => item.type === "nodeBox" && item.id === "a" && item.x > 5);
  const secondFrameWeight = result.ir.items.find((item) => item.type === "textNode" && item.text === "$0$" && item.x > 5);
  const secondFramePred = result.ir.items.find((item) => item.type === "textNode" && item.text === "-" && item.x > 5);
  assert.ok(secondFrameWeight.x < secondFrameA.x && secondFramePred.x > secondFrameA.x);
  assert.ok(secondFrameWeight.y < secondFrameA.y && secondFramePred.y < secondFrameA.y);
});

test("aggregation concatenate uses logical TeX box anchors without moving fixed layout", () => {
  const source = readFileSync(path.join(FIXTURE_ROOT, "latex-examples", "aggregation-blocks.tex"), "utf8");
  const result = tikzToSvg(source, { mathRenderer: "svg-text" });
  const boxes = Object.fromEntries(result.ir.items.filter((item) => item.type === "nodeBox" && item.id).map((item) => [item.id, item]));
  const paths = result.ir.items.filter((item) => item.type === "path");
  const svgPtPerCm = 72 / 2.54;
  const expectPointNear = (actual, expected, label) => {
    const distancePt = Math.hypot(actual.x - expected.x, actual.y - expected.y) * svgPtPerCm;
    assert.ok(distancePt < 0.5, `${label} expected within 0.5pt of ${JSON.stringify(expected)}, got ${JSON.stringify(actual)} (${distancePt}pt)`);
  };

  assert.deepEqual(result.diagnostics, []);
  for (const id of ["rect11", "rect12", "rect21", "rect22", "rect31", "rect32"]) {
    assert.equal(boxes[id].width, 3, `${id} width changed`);
    assert.equal(boxes[id].height, 1, `${id} height changed`);
  }
  assert.ok(Math.abs(boxes.concatenate.width * svgPtPerCm - 58.11) < 0.25);
  assert.ok(Math.abs(boxes.concatenate.height * svgPtPerCm - 12.88) < 0.25);
  assert.deepEqual(paths[0].commands, [
    { type: "moveTo", x: -4.2, y: -5.4 },
    { type: "lineTo", x: 7.5, y: -5.4 },
    { type: "lineTo", x: 7.5, y: 1.2 },
    { type: "lineTo", x: -4.2, y: 1.2 },
    { type: "closePath" }
  ]);
  const nodeOuterSep = boxes.concatenate.style.lineWidth / 200;
  const topBorder = boxes.concatenate.y + boxes.concatenate.height / 2 + nodeOuterSep;
  const bottomBorder = boxes.concatenate.y - boxes.concatenate.height / 2 - nodeOuterSep;
  assert.ok(Math.abs(paths[2].commands[0].y - bottomBorder) < 1e-9, "outgoing path must start on the outer south border");
  for (const pathIndex of [5, 8, 11]) {
    assert.ok(Math.abs(paths[pathIndex].commands.at(-1).y - topBorder) < 1e-9, `incoming path ${pathIndex} must end on the outer north border`);
  }
  expectPointNear(paths[2].commands[0], { x: 1.5, y: -5.234197595555555 }, "outgoing concatenate.south");
  expectPointNear(paths[5].commands.at(-1), { x: 0.872532684660074, y: -4.765802404444445 }, "left incoming endpoint");
  expectPointNear(paths[8].commands.at(-1), { x: 1.4215665855825093, y: -4.765802404444445 }, "middle incoming endpoint");
  expectPointNear(paths[11].commands.at(-1), { x: 2.1745273639904203, y: -4.765802404444445 }, "right incoming endpoint");
});
