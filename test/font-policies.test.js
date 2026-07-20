import assert from "node:assert/strict";
import test from "node:test";
import { resolveLibraryFont, fontSpecToTikzSizeCommand } from "../src/tex/fontPolicies.js";

test("uses native PGFPlots defaults and named role profiles", () => {
  assert.equal(resolveLibraryFont("pgfplots", "tick").sizePt, 10);
  assert.equal(resolveLibraryFont("pgfplots", "axisLabel").sizePt, 10);
  assert.equal(resolveLibraryFont("pgfplots", "legend").sizePt, 10);
  assert.equal(resolveLibraryFont("pgfplots", "title").sizePt, 10);
  assert.equal(resolveLibraryFont("pgfplots", "colorbarTick").sizePt, 10);

  assert.equal(resolveLibraryFont("pgfplots", "tick", { profile: "small" }).sizePt, 8);
  assert.equal(resolveLibraryFont("pgfplots", "axisLabel", { profile: "small" }).sizePt, 9);
  assert.equal(resolveLibraryFont("pgfplots", "legend", { profile: "small" }).sizePt, 10);
  assert.equal(resolveLibraryFont("pgfplots", "title", { profile: "small" }).sizePt, 10);

  assert.equal(resolveLibraryFont("pgfplots", "tick", { profile: "footnotesize" }).sizePt, 8);
  assert.equal(resolveLibraryFont("pgfplots", "legend", { profile: "footnotesize" }).sizePt, 8);
  assert.equal(resolveLibraryFont("pgfplots", "axisLabel", { profile: "footnotesize" }).sizePt, 9);
  assert.equal(resolveLibraryFont("pgfplots", "title", { profile: "footnotesize" }).sizePt, 9);

  assert.equal(resolveLibraryFont("pgfplots", "tick", { profile: "tiny" }).sizePt, 5);
  assert.equal(resolveLibraryFont("pgfplots", "legend", { profile: "tiny" }).sizePt, 5);
  assert.equal(resolveLibraryFont("pgfplots", "axisLabel", { profile: "tiny" }).sizePt, 5);
  assert.equal(resolveLibraryFont("pgfplots", "title", { profile: "tiny" }).sizePt, 8);
  assert.equal(resolveLibraryFont("pgfplots", "colorbarTick", { profile: "tiny" }).sizePt, 5);
});

test("uses native datavisualization and circuitikz roles", () => {
  assert.equal(resolveLibraryFont("datavisualization", "tick").sizePt, 8);
  assert.equal(resolveLibraryFont("datavisualization", "axisLabel").sizePt, 9);
  assert.equal(resolveLibraryFont("datavisualization", "dataSetLabel").sizePt, 9);
  assert.equal(resolveLibraryFont("datavisualization", "insideLegend").sizePt, 8);
  assert.equal(resolveLibraryFont("circuitikz", "label").sizePt, 10);
  assert.equal(resolveLibraryFont("circuitikz", "annotation").sizePt, 10);
  assert.equal(resolveLibraryFont("circuitikz", "tinySymbol").sizePt, 5);
  assert.equal(resolveLibraryFont("circuitikz", "sixPointSymbol").sizePt, 6);
  assert.equal(resolveLibraryFont("circuitikz", "normalSymbol").sizePt, 10);
  assert.equal(resolveLibraryFont("circuitikz", "largeSymbol").sizePt, 12);
  assert.equal(resolveLibraryFont("circuitikz", "label", { inherited: { sizePt: 12, baselineSkipPt: 14 } }).sizePt, 12);
});

test("unknown libraries and roles inherit without fabricating a role patch", () => {
  const inherited = {
    sizePt: 12,
    baselineSkipPt: 14,
    family: "sans-serif",
    weight: 700,
    source: "scope"
  };

  assert.deepEqual(resolveLibraryFont("unknown", "tick", { inherited }), {
    sizePt: 12,
    baselineSkipPt: 14,
    family: "sans-serif",
    weight: 700,
    style: "normal",
    variant: "normal",
    mathStyle: "text",
    mathVersion: "normal",
    source: "scope"
  });
  assert.deepEqual(resolveLibraryFont("pgfplots", "unknown", { inherited }), {
    sizePt: 12,
    baselineSkipPt: 14,
    family: "sans-serif",
    weight: 700,
    style: "normal",
    variant: "normal",
    mathStyle: "text",
    mathVersion: "normal",
    source: "scope"
  });
});

test("explicit font commands override only the properties they declare", () => {
  const resolved = resolveLibraryFont("pgfplots", "tick", {
    profile: "tiny",
    inherited: { family: "sans-serif", weight: 700 },
    explicit: String.raw`\large\itshape`
  });

  assert.equal(resolved.sizePt, 12);
  assert.equal(resolved.baselineSkipPt, 14);
  assert.equal(resolved.family, "sans-serif");
  assert.equal(resolved.weight, 700);
  assert.equal(resolved.style, "italic");
  assert.equal(resolved.source, "node-option");
});

test("converts FontSpec sizes back to canonical or explicit TikZ commands", () => {
  assert.equal(fontSpecToTikzSizeCommand({ sizePt: 5, baselineSkipPt: 6 }), String.raw`\tiny`);
  assert.equal(fontSpecToTikzSizeCommand({ sizePt: 10, baselineSkipPt: 12 }), String.raw`\normalsize`);
  assert.equal(
    fontSpecToTikzSizeCommand({ sizePt: 10.5, baselineSkipPt: 13 }),
    String.raw`\fontsize{10.5}{13}\selectfont`
  );
});
