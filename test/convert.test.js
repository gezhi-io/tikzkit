import assert from "node:assert/strict";
import test from "node:test";
import { convertTikzToSvg, tikzToSvg } from "../src/index.js";
import { parseCliArgs, runCli } from "../src/cli/index.js";

test("public convertTikzToSvg interface returns an ok conversion result", () => {
  const result = convertTikzToSvg(String.raw`\draw (0,0) -- (1,0);`);

  assert.equal(result.ok, true);
  assert.equal(result.diagnostics.length, 0);
  assert.match(result.svg, /<svg/);
  assert.equal(tikzToSvg, convertTikzToSvg);
});

test("cli adapter delegates IO through injected filesystem seam", async () => {
  const writes = new Map();
  const exitCode = await runCli(["input.tikz", "-o", "out.svg"], {
    stdout: { write() {} },
    stderr: {
      write(message) {
        throw new Error(message);
      }
    },
    filesystem: {
      async readTextFile(path) {
        assert.equal(path, "input.tikz");
        return String.raw`\draw (0,0) -- (1,0);`;
      },
      async writeTextFile(path, content) {
        writes.set(path, content);
      }
    }
  });

  assert.equal(exitCode, 0);
  assert.match(writes.get("out.svg"), /<svg/);
  assert.deepEqual(parseCliArgs(["foo.tikz", "--strict"]), {
    input: "foo.tikz",
    output: "foo.svg",
    strict: true,
    help: false
  });
});
