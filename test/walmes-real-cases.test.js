import assert from "node:assert/strict";
import test from "node:test";
import { auditGalleryCases } from "../scripts/gallery-audit-lib.js";
import {
  hasWalmesCorpus,
  loadWalmesCases,
  WALMES_EXPECTED_PGF_COUNT,
  WALMES_REPOSITORY_URL,
  WALMES_ROOT
} from "../scripts/walmes-real-cases.js";

const BASELINE = {
  maxCasesWithDiagnostics: 112,
  maxTotalDiagnostics: 892,
  minZeroDiagnosticCases: 199
};

test("loads every Walmes/Tikz pgf drawing from the local corpus", async (t) => {
  if (!hasWalmesCorpus()) {
    t.skip(`Walmes corpus not found at ${WALMES_ROOT}; clone ${WALMES_REPOSITORY_URL} there to run this corpus test.`);
    return;
  }

  const cases = await loadWalmesCases();

  assert.equal(cases.length, WALMES_EXPECTED_PGF_COUNT);
  assert.equal(cases.every((item) => item.origin === "walmes/Tikz"), true);
  assert.equal(cases.every((item) => item.source.includes("\\usetikzlibrary")), true);
  assert.equal(cases.every((item) => item.sourceUrl.startsWith(`${WALMES_REPOSITORY_URL}/blob/master/src/`)), true);
});

test("renders the full Walmes/Tikz corpus within the current diagnostics baseline", async (t) => {
  if (!hasWalmesCorpus()) {
    t.skip(`Walmes corpus not found at ${WALMES_ROOT}; clone ${WALMES_REPOSITORY_URL} there to run this corpus test.`);
    return;
  }

  const summary = auditGalleryCases(await loadWalmesCases());
  const zeroDiagnosticCases = summary.rows.filter((row) => row.diagnostics.length === 0).length;
  const messages = summary.rows.flatMap((row) => row.diagnostics.map((diagnostic) => diagnostic.message));

  assert.equal(summary.totalCases, WALMES_EXPECTED_PGF_COUNT);
  assert.equal(summary.rendered, WALMES_EXPECTED_PGF_COUNT);
  assert.ok(
    summary.casesWithDiagnostics <= BASELINE.maxCasesWithDiagnostics,
    `Walmes cases with diagnostics regressed: ${summary.casesWithDiagnostics} > ${BASELINE.maxCasesWithDiagnostics}`
  );
  assert.ok(
    summary.totalDiagnostics <= BASELINE.maxTotalDiagnostics,
    `Walmes diagnostics regressed: ${summary.totalDiagnostics} > ${BASELINE.maxTotalDiagnostics}`
  );
  assert.ok(
    zeroDiagnosticCases >= BASELINE.minZeroDiagnosticCases,
    `Walmes zero-diagnostic cases regressed: ${zeroDiagnosticCases} < ${BASELINE.minZeroDiagnosticCases}`
  );
  assert.deepEqual(
    messages.filter((message) =>
      /Unsupported command \\(?:definecolor|pgfmathtruncatemacro|clip|pgfplotsset|pgfplotstableread|pgfplotstabletypeset|usepgfplotslibrary|target|ellipseman)/.test(
        message
      ) || message === "Malformed \\matrix statement"
    ),
    []
  );
});
