import assert from "node:assert/strict";
import test from "node:test";
import { runCommand } from "../src/adapters/externalLatex.js";

test("external command runner terminates commands that exceed timeoutMs", async () => {
  const started = Date.now();
  const result = await runCommand(process.execPath, ["-e", "setTimeout(() => {}, 1000)"], {
    timeoutMs: 25
  });
  const elapsedMs = Date.now() - started;

  assert.equal(result.timedOut, true);
  assert.equal(result.exitCode, 124);
  assert.match(result.stderr, /timed out/i);
  assert.ok(elapsedMs < 500, `expected timeout before child completed, elapsed ${elapsedMs}ms`);
});
