import assert from "node:assert/strict";
import test from "node:test";
import { auditGalleryCases } from "../scripts/gallery-audit-lib.js";
import {
  CIRCUITIKZ_EXPECTED_SNIPPET_COUNT,
  CIRCUITIKZ_REPOSITORY_URL,
  CIRCUITIKZ_ROOT,
  hasCircuitikzCorpus,
  loadCircuitikzCases
} from "../scripts/circuitikz-real-cases.js";

const BASELINE = {
  maxCasesWithDiagnostics: 196,
  maxTotalDiagnostics: 914,
  minZeroDiagnosticCases: 299,
  minNonEmptyCases: 448
};

test("loads every circuitikz manual snippet from the local corpus", async (t) => {
  if (!hasCircuitikzCorpus()) {
    t.skip(`circuitikz corpus not found at ${CIRCUITIKZ_ROOT}; clone ${CIRCUITIKZ_REPOSITORY_URL} there to run this corpus test.`);
    return;
  }

  const cases = await loadCircuitikzCases();

  assert.equal(cases.length, CIRCUITIKZ_EXPECTED_SNIPPET_COUNT);
  assert.equal(cases.every((item) => item.origin === "circuitikz/circuitikz"), true);
  assert.equal(cases.every((item) => item.source.includes("\\usepackage[siunitx,RPvoltages]{circuitikz}")), true);
  assert.equal(cases.every((item) => item.source.includes("\\begin{tikzpicture}")), true);
  assert.equal(cases.every((item) => !item.source.includes("\\begin{circuitikz}")), true);
  assert.equal(cases.every((item) => item.sourceUrl.startsWith(`${CIRCUITIKZ_REPOSITORY_URL}/blob/master/doc/`)), true);
});

test("renders the circuitikz manual corpus within the current diagnostics baseline", async (t) => {
  if (!hasCircuitikzCorpus()) {
    t.skip(`circuitikz corpus not found at ${CIRCUITIKZ_ROOT}; clone ${CIRCUITIKZ_REPOSITORY_URL} there to run this corpus test.`);
    return;
  }

  const summary = auditGalleryCases(await loadCircuitikzCases());
  const zeroDiagnosticCases = summary.rows.filter((row) => row.diagnostics.length === 0).length;
  const nonEmptyCases = summary.rows.filter((row) => row.irItems > 0).length;

  assert.equal(summary.totalCases, CIRCUITIKZ_EXPECTED_SNIPPET_COUNT);
  assert.equal(summary.rendered, CIRCUITIKZ_EXPECTED_SNIPPET_COUNT);
  assert.ok(
    summary.casesWithDiagnostics <= BASELINE.maxCasesWithDiagnostics,
    `circuitikz cases with diagnostics regressed: ${summary.casesWithDiagnostics} > ${BASELINE.maxCasesWithDiagnostics}`
  );
  assert.ok(
    summary.totalDiagnostics <= BASELINE.maxTotalDiagnostics,
    `circuitikz diagnostics regressed: ${summary.totalDiagnostics} > ${BASELINE.maxTotalDiagnostics}`
  );
  assert.ok(
    zeroDiagnosticCases >= BASELINE.minZeroDiagnosticCases,
    `circuitikz zero-diagnostic cases regressed: ${zeroDiagnosticCases} < ${BASELINE.minZeroDiagnosticCases}`
  );
  assert.ok(
    nonEmptyCases >= BASELINE.minNonEmptyCases,
    `circuitikz non-empty renders regressed: ${nonEmptyCases} < ${BASELINE.minNonEmptyCases}`
  );
});
