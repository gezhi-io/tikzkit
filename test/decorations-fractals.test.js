import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tikzToSvg } from "../src/index.js";

test("renders the real Koch snowflake fixture as a fourth-order fractal path", () => {
  const source = readFileSync(
    new URL("./fixtures/examples/latex-examples/koch-snowflake.tex", import.meta.url),
    "utf8"
  );
  const result = tikzToSvg(source);
  const path = result.ir.items.find((item) => item.type === "path");

  assert.deepEqual(result.diagnostics, []);
  assert.ok(path);
  assert.equal(path.commands.length, 1 + 3 * 4 ** 4);
  assert.deepEqual(path.commands[0], { type: "moveTo", x: 0, y: 0 });
  assert.deepEqual(path.commands.at(-1), { type: "lineTo", x: 0, y: 0 });
  assert.equal(path.style.fill, "rgb(242 242 242)");
});
