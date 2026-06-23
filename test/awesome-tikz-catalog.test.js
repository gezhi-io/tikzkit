import assert from "node:assert/strict";
import test from "node:test";
import {
  AWESOME_TIKZ_EXPECTED_RESOURCE_COUNT,
  AWESOME_TIKZ_REPOSITORY_URL,
  AWESOME_TIKZ_ROOT,
  hasAwesomeTikzCatalog,
  loadAwesomeTikzCatalog,
  summarizeAwesomeTikzCoverage
} from "../scripts/awesome-tikz-catalog.js";

test("loads the maphy-psd/awesome-TikZ resource catalog", async (t) => {
  if (!hasAwesomeTikzCatalog()) {
    t.skip(`awesome-TikZ catalog not found at ${AWESOME_TIKZ_ROOT}; clone ${AWESOME_TIKZ_REPOSITORY_URL} there to run this test.`);
    return;
  }

  const catalog = await loadAwesomeTikzCatalog();

  assert.equal(catalog.resources.length, AWESOME_TIKZ_EXPECTED_RESOURCE_COUNT);
  assert.equal(catalog.resources.every((item) => item.origin === "maphy-psd/awesome-TikZ"), true);
  assert.ok(catalog.sections.Packages >= 260);
  assert.ok(catalog.sections.Gallery >= 6);
  assert.ok(catalog.sections.Tools >= 8);
  assert.ok(catalog.resources.some((item) => item.name === "pgfplots" && item.supportStatus === "core-subset"));
  assert.ok(catalog.resources.some((item) => item.name === "circuitikz" && item.supportStatus === "corpus-subset"));
  assert.ok(catalog.resources.some((item) => item.name === "tikz-network" && item.supportStatus === "extension-subset"));
  assert.ok(catalog.resources.some((item) => item.name === "stanli" && item.supportStatus === "extension-subset"));
});

test("summarizes implemented awesome-TikZ coverage for roadmap reports", async (t) => {
  if (!hasAwesomeTikzCatalog()) {
    t.skip(`awesome-TikZ catalog not found at ${AWESOME_TIKZ_ROOT}; clone ${AWESOME_TIKZ_REPOSITORY_URL} there to run this test.`);
    return;
  }

  const summary = summarizeAwesomeTikzCoverage(await loadAwesomeTikzCatalog());

  assert.equal(summary.totalResources, AWESOME_TIKZ_EXPECTED_RESOURCE_COUNT);
  assert.ok(summary.supportedResources >= 18);
  assert.ok(summary.supportedPackages >= 15);
  assert.ok(summary.unsupportedPackages > summary.supportedPackages);
  assert.ok(summary.supportedNames.includes("tikz-cd"));
  assert.ok(summary.supportedNames.includes("tikz-feynman"));
  assert.ok(summary.supportedNames.includes("tikzquads"));
});
