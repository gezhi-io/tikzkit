import assert from "node:assert/strict";
import test from "node:test";
import { auditGalleryCases } from "../scripts/gallery-audit-lib.js";
import {
  F0NZIE_EXPECTED_TEX_COUNT,
  F0NZIE_REPOSITORY_URL,
  F0NZIE_ROOT,
  hasF0nzieCorpus,
  loadF0nzieCases
} from "../scripts/f0nzie-real-cases.js";

const BASELINE = {
  maxCasesWithDiagnostics: 112,
  maxTotalDiagnostics: 1900,
  minZeroDiagnosticCases: 145
};

test("loads every f0nzie/tikz_favorites top-level TikZ drawing from the local corpus", async (t) => {
  if (!hasF0nzieCorpus()) {
    t.skip(`f0nzie corpus not found at ${F0NZIE_ROOT}; clone ${F0NZIE_REPOSITORY_URL} there to run this corpus test.`);
    return;
  }

  const cases = await loadF0nzieCases();

  assert.equal(cases.length, F0NZIE_EXPECTED_TEX_COUNT);
  assert.equal(cases.every((item) => item.origin === "f0nzie/tikz_favorites"), true);
  assert.equal(cases.every((item) => item.source.includes("\\documentclass")), true);
  assert.equal(cases.every((item) => item.sourceUrl.startsWith(`${F0NZIE_REPOSITORY_URL}/blob/master/src/`)), true);
});

test("renders the full f0nzie/tikz_favorites corpus within the current diagnostics baseline", async (t) => {
  if (!hasF0nzieCorpus()) {
    t.skip(`f0nzie corpus not found at ${F0NZIE_ROOT}; clone ${F0NZIE_REPOSITORY_URL} there to run this corpus test.`);
    return;
  }

  const summary = auditGalleryCases(await loadF0nzieCases());
  const zeroDiagnosticCases = summary.rows.filter((row) => row.diagnostics.length === 0).length;

  assert.equal(summary.totalCases, F0NZIE_EXPECTED_TEX_COUNT);
  assert.equal(summary.rendered, F0NZIE_EXPECTED_TEX_COUNT);
  assert.ok(
    summary.casesWithDiagnostics <= BASELINE.maxCasesWithDiagnostics,
    `f0nzie cases with diagnostics regressed: ${summary.casesWithDiagnostics} > ${BASELINE.maxCasesWithDiagnostics}`
  );
  assert.ok(
    summary.totalDiagnostics <= BASELINE.maxTotalDiagnostics,
    `f0nzie diagnostics regressed: ${summary.totalDiagnostics} > ${BASELINE.maxTotalDiagnostics}`
  );
  assert.ok(
    zeroDiagnosticCases >= BASELINE.minZeroDiagnosticCases,
    `f0nzie zero-diagnostic cases regressed: ${zeroDiagnosticCases} < ${BASELINE.minZeroDiagnosticCases}`
  );
});
