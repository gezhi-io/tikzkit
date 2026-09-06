import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("declared arrow dimensions render when dynamic code generation is disabled", () => {
  const result = spawnSync(process.execPath, ["--disallow-code-generation-from-strings", "--input-type=module", "-e", String.raw`
    import assert from 'node:assert/strict';
    import { readFileSync } from 'node:fs';
    import { tikzToSvg } from './src/index.js';
    const source = readFileSync('test/fixtures/examples/arrows/declared-leaf-tip.tex', 'utf8');
    const result = tikzToSvg(source);
    assert.deepEqual(result.diagnostics, []);
    assert.match(result.svg, /class="tikz-arrow-tip tikz-arrow-leaf"/);
  `], { cwd: new URL("..", import.meta.url), encoding: "utf8" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
