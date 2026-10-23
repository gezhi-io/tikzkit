import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import reporter from "../scripts/module-test-reporter.js";

async function report(events) {
  let output = "";
  for await (const chunk of reporter(events)) output += chunk;
  return JSON.parse(output);
}

test("module reporter groups failing tests without changing runner counts", async () => {
  const failed = (name, file) => ({ type: "test:fail", data: { name, file: path.resolve(file), line: 3,
    details: { error: { cause: new Error("Expected 1 to equal 2") } } } });
  const counts = { tests: 5, passed: 2, failed: 3, skipped: 0 };
  const result = await report([
    failed("a", "test/engine.test.js"), failed("b", "test/colors.test.js"), failed("c", "test/colors.test.js"),
    { type: "test:summary", data: { file: "test/colors.test.js", counts: { failed: 2 } } },
    { type: "test:summary", data: { counts, duration_ms: 12 } }
  ]);
  assert.deepEqual(result.counts, counts);
  assert.deepEqual(result.byModule, { "test/colors.test.js": 2, "test/engine.test.js": 1 });
  assert.equal(result.failures[0].line, 3);
  assert.equal(result.failures[0].message, "Expected 1 to equal 2");
  const withoutSummary = await report([
    { type: "test:diagnostic", data: { file: "test/colors.test.js", message: "tests 999" } },
    ...["tests 5", "pass 2", "fail 3", "skipped 0", "duration_ms 12.5"].map(message => ({
      type: "test:diagnostic", data: { message }
    }))
  ]);
  assert.deepEqual(withoutSummary.counts, counts);
  assert.equal(withoutSummary.durationMs, 12.5);
});

test("module reporter omits font payloads and redundant failed-suite wrappers", async () => {
  const result = await report([
    { type: "test:fail", data: { name: "svg", details: { error: { cause: new Error(
      "Missing native math glyph. Input:\n\n'<svg>data:font/woff;base64," + "A".repeat(100000) + "</svg>'") } } } },
    { type: "test:fail", data: { name: "suite", details: { error: { failureType: "subtestsFailed" } } } }
  ]);
  assert.equal(result.failures.length, 1);
  assert.equal(result.aggregateFailures, 1);
  assert.ok(result.failures[0].message.length < 100);
  assert.doesNotMatch(result.failures[0].message, /data:font/);
});
