import assert from "node:assert/strict";
import test from "node:test";
import { tikzToSvg } from "../src/index.js";
import { parsePgfplotsTablePoints } from "../src/pgfplots/addplotParser.js";

const comma = { "col sep": "comma" };
const table = "y,x,z,score\n0,1,3,9\n1,1,5,8";

test("table columns default to positions, and explicit names take precedence over indices", () => {
  const select = (options) => parsePgfplotsTablePoints(table, { ...comma, ...options }).map(({ x, y, z, meta }) => [x, y, z, meta]);
  assert.deepEqual(select({}), [[0, 1, 3, undefined], [1, 1, 5, undefined]]);
  assert.deepEqual(select({ "x index": "1", "y index": "2", "z index": "0", "meta index": "3" }),
    [[1, 3, 0, 9], [1, 5, 1, 8]]);
  assert.deepEqual(select({ x: "y", "x index": "1", y: "score", "y index": "2" }),
    [[0, 9, 3, undefined], [1, 8, 5, undefined]]);
  for (const options of [{ "y index": "12" }, { y: "absent" }]) {
    const diagnostics = [];
    assert.deepEqual(parsePgfplotsTablePoints(table, { ...comma, ...options }, diagnostics), []);
    assert.match(diagnostics[0].message, /column/i);
  }
});

test("unbounded 2D samples neither create zeros nor change the surveyed extent", () => {
  const render = (source, policy = "", plotPolicy = "") => {
    const result = tikzToSvg("\\begin{tikzpicture}\\begin{axis}[enlargelimits=false," + policy +
      "]\\addplot[red,mark=none," + plotPolicy + "] " + source + ";\\end{axis}\\end{tikzpicture}");
    assert.deepEqual(result.diagnostics, []);
    return result.ir.items.find((item) => item.subtype === "axis-plot").commands;
  };
  const finite = render("coordinates {(0,0)(1,0)(3,2)(4,2)}");
  const expectedJump = finite.map((cmd, index) => index === 2 ? { ...cmd, type: "moveTo" } : cmd);
  for (const source of [
    "coordinates {(9,nan)(0,0)(1,0)(999,nan)(2,inf)(3,2)(4,2)(-9,nan)}",
    "table[col sep=comma] {x,y\n9,nan\n0,0\n1,0\n999,nan\n2,inf\n3,2\n4,2\n-9,nan\n}"
  ]) {
    assert.deepEqual(render(source), finite);
    assert.deepEqual(render(source, "unbounded coords=jump"), expectedJump);
    assert.deepEqual(render(source, "unbounded coords=jump", "unbounded coords=discard"), finite);
  }
});
