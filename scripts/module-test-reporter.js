import path from "node:path";

function errorSummary(error) {
  const cause = error?.cause || error;
  const message = String(cause?.message || error?.message || "Test failed");
  // Assertion messages can embed entire SVGs including megabytes of fonts.
  // Keep the assertion and location; rerun that test for the full payload.
  return message.split(/\n\s*(?:'<svg|"<svg|<svg)/, 1)[0].slice(0, 800).trim();
}

export default async function* moduleTestReporter(events) {
  const failures = [];
  let aggregateFailures = 0;
  let summary;
  const diagnosticCounts = {};
  let diagnosticDuration;
  for await (const event of events) {
    if (event.type === "test:summary" && !event.data.file) summary = event.data;
    // Preserve runner totals even when no test:summary event is emitted.
    // Do not count failed parent suites twice or infer passes from failures.
    if (event.type === "test:diagnostic" && !event.data.file) {
      const match = /^(tests|suites|pass|fail|cancelled|skipped|todo|duration_ms) (\d+(?:\.\d+)?)$/.exec(event.data.message);
      if (match?.[1] === "duration_ms") diagnosticDuration = Number(match[2]);
      else if (match) diagnosticCounts[{ pass: "passed", fail: "failed" }[match[1]] || match[1]] = Number(match[2]);
    }
    if (event.type !== "test:fail") continue;
    const { name, file, line, column, details } = event.data;
    const error = details?.error;
    if (error?.failureType === "subtestsFailed") {
      aggregateFailures += 1;
      continue;
    }
    failures.push({ name, file: file ? path.relative(process.cwd(), file) : "<runner>",
      line, column, message: errorSummary(error) });
  }
  const byModule = {};
  for (const failure of failures) byModule[failure.file] = (byModule[failure.file] || 0) + 1;
  yield JSON.stringify({ counts: summary?.counts || diagnosticCounts,
    durationMs: summary?.duration_ms ?? diagnosticDuration, aggregateFailures,
    byModule: Object.fromEntries(Object.entries(byModule).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
    failures }, null, 2) + "\n";
}
