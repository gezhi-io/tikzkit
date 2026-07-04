import assert from "node:assert/strict";
import test from "node:test";

import { parseCaseFilter } from "../web/case-filter.js";
import { diffReportFields, prefixedDiffReportFields } from "../web/diff-report.js";
import { generatedArtifactStatus } from "../web/tool-status.js";

test("treats generated tikztosvg artifacts as successful even when wrapper cleanup exits nonzero", () => {
  assert.equal(generatedArtifactStatus(1, true), 0);
});

test("does not treat stale tikztosvg artifacts as successful", () => {
  assert.equal(generatedArtifactStatus(1, true, { fresh: false }), 1);
});

test("preserves external tool failures when no artifact was generated", () => {
  assert.equal(generatedArtifactStatus(1, false), 1);
  assert.equal(generatedArtifactStatus(null, false), 1);
});

test("formats image diff report fields from generated metrics", () => {
  const fields = diffReportFields({
    rawStatus: 1,
    stdout: '{"changedPixels":2,"changedRatio":0.5}',
    stderr: "cleanup warning\n",
    diffExists: true,
    diffPath: "output/case/diff.png"
  });

  assert.equal(fields.imageDiffStatus, 0);
  assert.equal(fields.imageDiffRawStatus, 1);
  assert.equal(fields.imageDiffPng, "output/case/diff.png");
  assert.deepEqual(fields.imageDiffMetrics, { changedPixels: 2, changedRatio: 0.5 });
  assert.equal(fields.imageDiffStderr, "cleanup warning");
});

test("keeps image diff failures visible when no diff image exists", () => {
  const fields = diffReportFields({
    rawStatus: 2,
    stdout: "",
    stderr: "failed",
    diffExists: false,
    diffPath: "output/case/diff.png"
  });

  assert.equal(fields.imageDiffStatus, 2);
  assert.equal(fields.imageDiffPng, null);
  assert.equal(fields.imageDiffMetrics, null);
});

test("formats prefixed image diff report fields for aligned comparisons", () => {
  const fields = prefixedDiffReportFields("alignedImageDiff", {
    rawStatus: 0,
    stdout: '{"alignment":{"dx":4,"dy":-2,"window":80},"changedRatio":0.01}',
    stderr: "",
    diffExists: true,
    diffPath: "output/case/image-diff-aligned.png"
  });

  assert.equal(fields.alignedImageDiffStatus, 0);
  assert.equal(fields.alignedImageDiffRawStatus, 0);
  assert.equal(fields.alignedImageDiffPng, "output/case/image-diff-aligned.png");
  assert.deepEqual(fields.alignedImageDiffMetrics, {
    alignment: { dx: 4, dy: -2, window: 80 },
    changedRatio: 0.01
  });
});

test("parses multiple explicit web output cases from one --cases flag", () => {
  const filter = parseCaseFilter(["--cases", "datavisualization-017", "datavisualization-032", "--case=datavisualization-045"], "datavisualization-056,datavisualization-058");

  assert.deepEqual([...filter], [
    "datavisualization-017",
    "datavisualization-032",
    "datavisualization-045",
    "datavisualization-056",
    "datavisualization-058"
  ]);
});
