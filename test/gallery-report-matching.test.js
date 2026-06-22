import assert from "node:assert/strict";
import test from "node:test";
import { createGalleryReportIndexes, reportForCase } from "../web/gallery-report-matching.js";

test("matches gallery reports by path when inserted cases shift numeric ids", () => {
  const reports = createGalleryReportIndexes(
    [
      { id: "111", path: "old/case.tex", diffPath: "outputs/real-gallery/diff/111.png" },
      { id: "112", path: "current/case.tex", diffPath: "outputs/real-gallery/diff/112.png" }
    ],
    [
      { id: "111", path: "old/case.tex", pngPath: "outputs/real-gallery/native/111/native.png" },
      { id: "112", path: "current/case.tex", pngPath: "outputs/real-gallery/native/112/native.png" }
    ]
  );

  const report = reportForCase(111, { path: "current/case.tex" }, reports);

  assert.equal(report.diff.diffPath, "outputs/real-gallery/diff/112.png");
  assert.equal(report.native.pngPath, "outputs/real-gallery/native/112/native.png");
});

test("does not reuse a mismatched native report when path is unavailable", () => {
  const reports = createGalleryReportIndexes(null, [
    { id: "111", path: "old/case.tex", pngPath: "outputs/real-gallery/native/111/native.png" }
  ]);

  const report = reportForCase(111, { path: "new/case.tex" }, reports);

  assert.equal(report.native, null);
});
