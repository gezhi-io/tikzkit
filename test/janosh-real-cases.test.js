import assert from "node:assert/strict";
import test from "node:test";
import { auditGalleryCases } from "../scripts/gallery-audit-lib.js";
import {
  JANOSH_EXPECTED_TEX_COUNT,
  JANOSH_REPOSITORY_URL,
  JANOSH_ROOT,
  hasJanoshCorpus,
  loadJanoshCases
} from "../scripts/janosh-real-cases.js";

const BASELINE = {
  maxCasesWithDiagnostics: 33,
  maxTotalDiagnostics: 754,
  minZeroDiagnosticCases: 101
};

test("loads every janosh/diagrams LaTeX drawing from the local corpus", async (t) => {
  if (!hasJanoshCorpus()) {
    t.skip(`janosh corpus not found at ${JANOSH_ROOT}; clone ${JANOSH_REPOSITORY_URL} there to run this corpus test.`);
    return;
  }

  const cases = await loadJanoshCases();

  assert.equal(cases.length, JANOSH_EXPECTED_TEX_COUNT);
  assert.equal(cases.every((item) => item.origin === "janosh/diagrams"), true);
  assert.equal(cases.every((item) => item.source.includes("\\documentclass")), true);
  assert.equal(cases.every((item) => item.sourceUrl.startsWith(`${JANOSH_REPOSITORY_URL}/blob/main/assets/`)), true);
});

test("renders the full janosh/diagrams LaTeX corpus within the current diagnostics baseline", async (t) => {
  if (!hasJanoshCorpus()) {
    t.skip(`janosh corpus not found at ${JANOSH_ROOT}; clone ${JANOSH_REPOSITORY_URL} there to run this corpus test.`);
    return;
  }

  const summary = auditGalleryCases(await loadJanoshCases());
  const zeroDiagnosticCases = summary.rows.filter((row) => row.diagnostics.length === 0).length;

  assert.equal(summary.totalCases, JANOSH_EXPECTED_TEX_COUNT);
  assert.equal(summary.rendered, JANOSH_EXPECTED_TEX_COUNT);
  assert.ok(
    summary.casesWithDiagnostics <= BASELINE.maxCasesWithDiagnostics,
    `janosh cases with diagnostics regressed: ${summary.casesWithDiagnostics} > ${BASELINE.maxCasesWithDiagnostics}`
  );
  assert.ok(
    summary.totalDiagnostics <= BASELINE.maxTotalDiagnostics,
    `janosh diagnostics regressed: ${summary.totalDiagnostics} > ${BASELINE.maxTotalDiagnostics}`
  );
  assert.ok(
    zeroDiagnosticCases >= BASELINE.minZeroDiagnosticCases,
    `janosh zero-diagnostic cases regressed: ${zeroDiagnosticCases} < ${BASELINE.minZeroDiagnosticCases}`
  );
});
