import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { capabilityMatrix, featureIds, featureRegistries, SUPPORT_STATUS } from "../src/capabilities/index.js";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

function remainingGapsClause(notes) {
  const match = String(notes).match(/Remaining gaps (?:are|include) [^.]+/i);
  assert.ok(match, `expected Remaining gaps clause in: ${notes}`);
  return match[0];
}

test("capability matrix has exact coverage for every feature id", () => {
  assert.deepEqual(Object.keys(capabilityMatrix).sort(), [...featureIds].sort());

  for (const featureId of featureIds) {
    const row = capabilityMatrix[featureId];
    assert.equal(row.id, featureId);
    assert.ok(SUPPORT_STATUS.includes(row.parser), `${featureId} has invalid parser status`);
    assert.ok(SUPPORT_STATUS.includes(row.semantic), `${featureId} has invalid semantic status`);
    assert.ok(SUPPORT_STATUS.includes(row.svg), `${featureId} has invalid svg status`);
  }
});

test("capability matrix records PGFPlots 3D annotation visual gates", () => {
  const feature = capabilityMatrix.pgfplots_3d_surface;
  assert.equal(feature.semantic, "partial");
  assert.equal(feature.svg, "partial");
  assert.ok(feature.modules.includes("src/pgfplots/axis3d.js"));
  assert.ok(feature.fixtures.includes("test/fixtures/examples/latex-examples/3d-gaussian-distribution.tex"));
  assert.ok(feature.fixtures.includes("test/fixtures/examples/latex-examples/3d-function-8.tex"));
  assert.ok(feature.verification.artifacts.includes("outputs/qa-pgfplots-3d-annotation"));
  assert.match(feature.notes, /view-aware projected-edge annotation layout/i);
  assert.match(feature.notes, /remaining/i);
});

test("capability matrix records PGFPlots faceted painter visual gates", () => {
  const feature = capabilityMatrix.pgfplots_3d_surface;
  assert.equal(feature.parser, "partial");
  assert.equal(feature.semantic, "partial");
  assert.equal(feature.svg, "partial");
  assert.ok(feature.fixtures.includes("test/fixtures/examples/latex-examples/3d-function-2.tex"));
  assert.ok(feature.fixtures.includes("test/fixtures/examples/latex-examples/3d-function-8.tex"));
  assert.ok(feature.fixtures.includes("test/fixtures/examples/latex-examples/3d-gradient-cos.tex"));
  assert.ok(feature.fixtures.includes("test/fixtures/examples/latex-examples/3d-manhattan-bar-plot.tex"));
  assert.ok(feature.fixtures.includes("test/fixtures/examples/pgfplots/plot-box-ratio-3d.tex"));
  assert.equal(new Set(feature.fixtures).size, feature.fixtures.length);
  assert.deepEqual(feature.verification.artifacts, [
    "outputs/qa-pgfplots-3d-annotation",
    "outputs/qa-pgfplots-faceted-order",
    "outputs/qa-pgfplots-3d-plot-box-ratio"
  ]);
  assert.match(feature.notes, /per-patch faceted painter ordering is verified/i);
  assert.match(feature.notes, /projection calibration/i);
  assert.match(feature.notes, /surface\/color interpolation/i);
  assert.match(feature.notes, /overlays/i);
  assert.match(feature.notes, /colorbar placement/i);
  assert.match(feature.notes, /exact TeX glyph metrics/i);
  assert.match(feature.notes, /unsupported shader\/patch modes/i);
  assert.match(feature.notes, /plot box ratio/i);
});

test("capability matrix records default middle-axis framing visual gates", () => {
  const feature = capabilityMatrix.pgfplots_axis;
  assert.equal(feature.parser, "partial");
  assert.equal(feature.semantic, "partial");
  assert.equal(feature.svg, "partial");
  assert.ok(feature.fixtures.includes("test/fixtures/examples/latex-examples/2d-parted-function.tex"));
  assert.ok(feature.fixtures.includes("test/fixtures/examples/latex-examples/2d-x-square-with-circle.tex"));
  assert.equal(new Set(feature.fixtures).size, feature.fixtures.length);
  assert.ok(feature.verification.artifacts.includes("outputs/qa-pgfplots-middle-axis-framing"));
  assert.equal(new Set(feature.verification.artifacts).size, feature.verification.artifacts.length);
  assert.match(feature.notes, /default enlarged middle-axis framing/i);
  assert.match(feature.notes, /default-size enlarged middle axes/i);
  assert.match(feature.notes, /exact 45pt reserve/i);
  assert.match(feature.notes, /0\.2pt outer margins/i);
  assert.match(feature.notes, /0\.2pt base outer margins/i);
  const remainingGaps = remainingGapsClause(feature.notes);
  assert.match(feature.notes, /non-enlarged outer-margin calibration/i);
  assert.doesNotMatch(feature.notes, /terminal label placement/i);
  assert.match(remainingGaps, /other label placements/i);
  assert.doesNotMatch(remainingGaps, /classic stealth|axis line width/i);
  assert.match(feature.notes, /broader automatic tick density/i);
  assert.match(feature.notes, /origin\/padded minor behavior/i);
  assert.match(feature.notes, /boxed tick-label font\/bbox calibration/i);
  assert.doesNotMatch(remainingGaps, /middle-axis tick-label metrics|middle-axis tick-label alignment/i);
  assert.match(feature.notes, /layer ordering/i);
  assert.match(feature.notes, /paint order/i);
  assert.match(feature.notes, /transitional auto-Y bottom tick-label overflow reserve/i);
  assert.match(feature.notes, /broader PGFPlots input handlers/i);
});

test("capability matrix records classic stealth scaling and PGFPlots axis gates", () => {
  const arrows = capabilityMatrix.arrow_tips;
  assert.equal(arrows.parser, "stable");
  assert.equal(arrows.semantic, "partial");
  assert.equal(arrows.svg, "partial");
  assert.ok(arrows.fixtures.includes("test/fixtures/basic/arrow-tips.tikz"));
  assert.match(arrows.notes, /classic stealth/i);
  assert.match(arrows.notes, /0\.28pt/i);
  assert.match(arrows.notes, /0\.3.*line width/i);
  assert.match(arrows.notes, /thin.*thick/i);

  const axes = capabilityMatrix.pgfplots_axis;
  assert.equal(axes.parser, "partial");
  assert.equal(axes.semantic, "partial");
  assert.equal(axes.svg, "partial");
  assert.ok(axes.verification.artifacts.includes("outputs/qa-pgfplots-classic-stealth-axes"));
  assert.match(axes.notes, /0\.4pt.*stealth/i);
  assert.doesNotMatch(axes.notes.match(/Remaining gaps are ([^.]+)/i)?.[1] || "", /classic stealth|axis line width/i);
  assert.match(axes.notes.match(/Remaining gaps are ([^.]+)/i)?.[1] || "", /other label placements/i);

  assert.equal(new Set(arrows.fixtures).size, arrows.fixtures.length);
  assert.equal(new Set(axes.fixtures).size, axes.fixtures.length);
  assert.equal(new Set(axes.verification.artifacts).size, axes.verification.artifacts.length);
});

test("capability matrix records middle-axis terminal-label visual gates", () => {
  const feature = capabilityMatrix.pgfplots_axis;
  assert.equal(feature.parser, "partial");
  assert.equal(feature.semantic, "partial");
  assert.equal(feature.svg, "partial");
  assert.ok(feature.fixtures.includes("test/fixtures/examples/latex-examples/2d-parted-function.tex"));
  assert.ok(feature.fixtures.includes("test/fixtures/examples/latex-examples/2d-x-square-with-circle.tex"));
  assert.equal(new Set(feature.fixtures).size, feature.fixtures.length);
  assert.ok(feature.verification.artifacts.includes("outputs/qa-pgfplots-middle-axis-labels"));
  assert.equal(new Set(feature.verification.artifacts).size, feature.verification.artifacts.length);
  assert.match(feature.notes, /middle-axis terminal labels/i);
  assert.match(feature.notes, /ticklabel\* cs:1/i);
  assert.match(feature.notes, /transformed.*limits/i);
  const remainingGaps = remainingGapsClause(feature.notes);
  assert.match(remainingGaps, /other label placements/i);
  assert.match(remainingGaps, /broader automatic tick density/i);
  assert.match(remainingGaps, /origin\/padded minor behavior/i);
  assert.match(remainingGaps, /paint order/i);
});

test("capability matrix records source-driven middle-axis tick metrics and alignment", () => {
  const feature = capabilityMatrix.pgfplots_axis;
  assert.equal(feature.parser, "partial");
  assert.equal(feature.semantic, "partial");
  assert.equal(feature.svg, "partial");
  assert.ok(feature.modules.includes("src/pgfplots/ticks.js"));
  assert.deepEqual(feature.fixtures, [
    "test/fixtures/examples/pgfplots/axis-basic-range.tex",
    "test/fixtures/examples/pgfplots/axis-middle-lines.tex",
    "test/fixtures/examples/latex-examples/2d-parted-function.tex",
    "test/fixtures/examples/latex-examples/2d-x-square-with-circle.tex"
  ]);
  assert.deepEqual(feature.verification.artifacts, [
    "outputs/qa-pgfplots-middle-axis-framing",
    "outputs/qa-pgfplots-middle-axis-labels",
    "outputs/qa-pgfplots-classic-stealth-axes",
    "outputs/qa-pgfplots-tick-label-metrics-alignment",
    "outputs/qa-pgfplots-compact-middle-axis-tick-density"
  ]);
  assert.match(feature.notes, /local TeX Live.*pgfplots\.code\.tex.*pgfplotsticks\.code\.tex.*reviewed/i);
  assert.match(feature.notes, /non-boxed middle-axis ticks/i);
  assert.match(feature.notes, /normal font.*ordinary TikZ inner sep/i);
  assert.match(feature.notes, /inside\/center\/outside.*independent per-axis alignment/i);
  assert.match(feature.notes, /major\/minor tick segments and label points/i);
  assert.match(feature.notes, /nonnegative.*distances including 0pt.*precedence/i);

  const remainingGaps = remainingGapsClause(feature.notes);
  assert.match(remainingGaps, /boxed tick-label font\/bbox calibration/i);
  assert.match(remainingGaps, /broader automatic tick density/i);
  assert.match(remainingGaps, /origin\/padded minor behavior/i);
  assert.match(remainingGaps, /other label placements\/styles\/rotation/i);
  assert.match(remainingGaps, /3D tick labels/i);
  assert.match(remainingGaps, /non-enlarged outer-margin calibration/i);
  assert.match(remainingGaps, /layer ordering.*paint order parity/i);
  assert.match(remainingGaps, /auto-Y bottom tick-label overflow reserve/i);
  assert.match(remainingGaps, /broader PGFPlots input handlers/i);
  assert.doesNotMatch(remainingGaps, /middle-axis tick-label metrics|middle-axis tick-label alignment/i);
});

test("capability matrix records compact middle-axis tick-density visual gate", () => {
  const feature = capabilityMatrix.pgfplots_axis;
  assert.equal(feature.parser, "partial");
  assert.equal(feature.semantic, "partial");
  assert.equal(feature.svg, "partial");
  assert.ok(feature.verification.artifacts.includes("outputs/qa-pgfplots-compact-middle-axis-tick-density"));
  assert.equal(new Set(feature.verification.artifacts).size, feature.verification.artifacts.length);
  assert.match(feature.notes, /compact middle-axis x ranges/i);
  assert.match(feature.notes, /geometry\.transformRanges.*actual x-range enlargement/i);
  assert.match(feature.notes, /grid lines share the same selected count/i);

  const remainingGaps = remainingGapsClause(feature.notes);
  assert.match(remainingGaps, /broader automatic tick density/i);
});

test("capability matrix records plain node logical metric visual gate", () => {
  const feature = capabilityMatrix.node_text_measurement;
  assert.equal(feature.parser, "stable");
  assert.equal(feature.semantic, "partial");
  assert.equal(feature.svg, "partial");
  assert.ok(feature.fixtures.includes("test/fixtures/basic/node-text-measurement.tikz"));
  assert.ok(feature.fixtures.includes("test/fixtures/examples/latex-examples/aggregation-blocks.tex"));
  assert.equal(new Set(feature.fixtures).size, feature.fixtures.length);
  assert.equal(feature.verification.oracle, "unit-test+tikztosvg");
  assert.ok(feature.verification.tests.includes("test/convert.test.js"));
  assert.ok(feature.verification.tests.includes("test/svg-renderer.test.js"));
  assert.ok(feature.verification.artifacts.includes("outputs/qa-plain-node-logical-metrics"));
  assert.equal(new Set(feature.verification.artifacts).size, feature.verification.artifacts.length);
  assert.match(feature.notes, /normal single-line unwrapped Main-Regular plain nodes/i);
  assert.match(feature.notes, /verified logical TeX box metrics for semantic node sizing and anchors/i);
  assert.match(feature.notes, /wrapped paragraph\/minipage text/i);
  assert.match(feature.notes, /mixed inline math/i);
  assert.match(feature.notes, /styled fonts/i);
  assert.match(feature.notes, /glyph paint fidelity/i);
  assert.match(feature.notes, /broader shaping\/unsupported characters/i);
});

test("capability matrix records browser workbench verification", () => {
  const feature = capabilityMatrix.browser_workbench;
  assert.equal(feature.semantic, "stable");
  assert.equal(feature.svg, "stable");
  assert.equal(feature.verification.oracle, "browser+unit-test");
  assert.deepEqual(feature.fixtures, ["test/fixtures/examples/milestone-1.json"]);
});

test("capability registries only reference known matrix rows", () => {
  const known = new Set(featureIds);
  const registered = new Set();

  for (const [registryName, registryFeatureIds] of Object.entries(featureRegistries)) {
    assert.ok(Array.isArray(registryFeatureIds), `${registryName} registry must be an array`);
    for (const featureId of registryFeatureIds) {
      assert.ok(known.has(featureId), `${registryName} registry references unknown feature ${featureId}`);
      registered.add(featureId);
    }
  }

  for (const featureId of featureIds) {
    const row = capabilityMatrix[featureId];
    const implementedSomewhere = row.parser !== "none" || row.semantic !== "none" || row.svg !== "none";
    if (implementedSomewhere) {
      assert.ok(registered.has(featureId), `${featureId} has implementation status but is missing from registries`);
    }
  }
});

test("capability rows reference existing owner modules and fixtures", () => {
  for (const featureId of featureIds) {
    const row = capabilityMatrix[featureId];
    assert.ok(Array.isArray(row.modules), `${featureId} modules must be an array`);
    assert.ok(row.modules.length > 0, `${featureId} must list owner modules`);
    assert.ok(Array.isArray(row.fixtures), `${featureId} fixtures must be an array`);
    assert.ok(row.fixtures.length > 0, `${featureId} must list fixtures`);
    assert.equal(typeof row.verification, "object", `${featureId} must list verification evidence`);
    assert.equal(typeof row.verification.oracle, "string", `${featureId} verification must name an oracle`);
    assert.ok(row.verification.oracle.length > 0, `${featureId} verification oracle cannot be empty`);
    assert.ok(Array.isArray(row.verification.tests), `${featureId} verification must list tests`);
    assert.ok(row.verification.tests.length > 0, `${featureId} verification must list at least one test`);

    for (const modulePath of row.modules) {
      const absolutePath = resolve(repoRoot, modulePath);
      assert.ok(existsSync(absolutePath), `${featureId} owner module does not exist: ${modulePath}`);
      assert.ok(statSync(absolutePath).isFile(), `${featureId} owner module is not a file: ${modulePath}`);
    }

    for (const fixturePath of row.fixtures) {
      const absolutePath = resolve(repoRoot, fixturePath);
      assert.ok(existsSync(absolutePath), `${featureId} fixture does not exist: ${fixturePath}`);
    }

    for (const testPath of row.verification.tests) {
      const absolutePath = resolve(repoRoot, testPath);
      assert.ok(existsSync(absolutePath), `${featureId} verification test does not exist: ${testPath}`);
      assert.ok(statSync(absolutePath).isFile(), `${featureId} verification test is not a file: ${testPath}`);
    }
  }
});
