import assert from "node:assert/strict";
import test from "node:test";
import { auditGalleryCases } from "../scripts/gallery-audit-lib.js";
import {
  STRUCTURAL_ANALYSIS_EXPECTED_CASE_COUNT,
  STRUCTURAL_ANALYSIS_REPOSITORY_URL,
  STRUCTURAL_ANALYSIS_ROOT,
  hasStructuralAnalysisCorpus,
  loadStructuralAnalysisCases
} from "../scripts/structural-analysis-real-cases.js";

const BASELINE = {
  maxCasesWithDiagnostics: 0,
  maxTotalDiagnostics: 0,
  minZeroDiagnosticCases: STRUCTURAL_ANALYSIS_EXPECTED_CASE_COUNT,
  minNonEmptyCases: 221
};

test("loads every hackl/TikZ-StructuralAnalysis tikzpicture from the local corpus", async (t) => {
  if (!hasStructuralAnalysisCorpus()) {
    t.skip(
      `TikZ-StructuralAnalysis corpus not found at ${STRUCTURAL_ANALYSIS_ROOT}; clone ${STRUCTURAL_ANALYSIS_REPOSITORY_URL} there to run this corpus test.`
    );
    return;
  }

  const cases = await loadStructuralAnalysisCases();

  assert.equal(cases.length, STRUCTURAL_ANALYSIS_EXPECTED_CASE_COUNT);
  assert.equal(cases.every((item) => item.origin === "hackl/TikZ-StructuralAnalysis"), true);
  assert.equal(cases.every((item) => item.source.includes("\\usepackage{stanli}")), true);
  assert.equal(cases.every((item) => item.source.includes("\\begin{tikzpicture}")), true);
  assert.equal(cases.every((item) => item.sourceUrl.startsWith(`${STRUCTURAL_ANALYSIS_REPOSITORY_URL}/blob/master/`)), true);
});

test("renders the hackl/TikZ-StructuralAnalysis corpus within the current diagnostics baseline", async (t) => {
  if (!hasStructuralAnalysisCorpus()) {
    t.skip(
      `TikZ-StructuralAnalysis corpus not found at ${STRUCTURAL_ANALYSIS_ROOT}; clone ${STRUCTURAL_ANALYSIS_REPOSITORY_URL} there to run this corpus test.`
    );
    return;
  }

  const summary = auditGalleryCases(await loadStructuralAnalysisCases());
  const zeroDiagnosticCases = summary.rows.filter((row) => row.diagnostics.length === 0).length;
  const nonEmptyCases = summary.rows.filter((row) => row.irItems > 0).length;

  assert.equal(summary.totalCases, STRUCTURAL_ANALYSIS_EXPECTED_CASE_COUNT);
  assert.equal(summary.rendered, STRUCTURAL_ANALYSIS_EXPECTED_CASE_COUNT);
  assert.ok(
    summary.casesWithDiagnostics <= BASELINE.maxCasesWithDiagnostics,
    `StructuralAnalysis cases with diagnostics regressed: ${summary.casesWithDiagnostics} > ${BASELINE.maxCasesWithDiagnostics}`
  );
  assert.ok(
    summary.totalDiagnostics <= BASELINE.maxTotalDiagnostics,
    `StructuralAnalysis diagnostics regressed: ${summary.totalDiagnostics} > ${BASELINE.maxTotalDiagnostics}`
  );
  assert.ok(
    zeroDiagnosticCases >= BASELINE.minZeroDiagnosticCases,
    `StructuralAnalysis zero-diagnostic cases regressed: ${zeroDiagnosticCases} < ${BASELINE.minZeroDiagnosticCases}`
  );
  assert.ok(
    nonEmptyCases >= BASELINE.minNonEmptyCases,
    `StructuralAnalysis non-empty renders regressed: ${nonEmptyCases} < ${BASELINE.minNonEmptyCases}`
  );
});
