import assert from "node:assert/strict";
import test from "node:test";
import { assertTracePath, nativePlotSuite, traceToleranceSp } from "./helpers/native-plot-trace.js";

function expandRectangle(token) {
  if (token[0] !== "R") return [token];
  // PDF re: signed sides, starting at the supplied corner (also the pen after Z).
  const [, x, y, w, h] = token;
  return [["M", x, y], ["L", x + w, y], ["L", x + w, y + h], ["L", x, y + h], ["Z"]];
}

function contoursAndPen(path) {
  const contours = [];
  let open, pen;
  for (const t of path.flatMap(expandRectangle)) {
    if (t[0] === "M") {
      if (open) contours.push(open);
      open = null;
      pen = t.slice(1);
      continue;
    }
    assert.ok(pen, "drawing command without a current pen: " + t);
    // An L or C immediately after re/Z starts at its actual closed-subpath pen.
    open ??= [["M", ...pen]];
    open.push(t);
    if (t[0] === "Z") {
      pen = open[0].slice(1);
      contours.push(open);
      open = null;
    } else pen = t.slice(-2);
  }
  if (open) contours.push(open);
  // Moves alone paint nothing, but can affect the measured box (checked separately)
  // and must survive as the start of the next stroke or as the final current pen.
  return { contours, pen: pen ? [["M", ...pen]] : [] };
}

function sameWoundQuad(actual, native) {
  const isQuad = p => p.map(t => t[0]).join("") === "MLLLZ";
  if (!isQuad(actual) || !isQuad(native)) return false;
  const corners = [0, 1, 2, 3];
  return corners.some(start => corners.every(i => {
    const target = native[(start + i) % 4];
    return Math.abs(actual[i][1] - target[1]) <= traceToleranceSp &&
      Math.abs(actual[i][2] - target[2]) <= traceToleranceSp;
  }));
}

function assertBarGeometry(actual, expected, label, dashed = false) {
  const a = contoursAndPen(actual), b = contoursAndPen(expected);
  assert.equal(a.contours.length, b.contours.length, label + " number of contours");
  b.contours.forEach((path, i) => {
    // A different starting corner is invisible only on an undashed closed quad.
    // Never reorder contours, reverse winding, or drop curved or zero-length edges.
    if (!dashed && sameWoundQuad(a.contours[i], path)) return;
    assertTracePath(a.contours[i], path, label + " contour " + (i + 1));
  });
  assertTracePath(a.pen, b.pen, label + " final pen");
}

nativePlotSuite("bar", new URL("./fixtures/native-bar-plot-tests/", import.meta.url), ["observations.table"],
  (actual, expected, label, { id, item, ir }) => {
    // The rounded paths keep their unrounded construction bounds in nonpainting bbox items.
    assert.ok(ir.items.every(p => p.type === "path" || (p.type === "bbox" && id === "rounded-fixed-and-interval")),
      label + " unexpected non-path item");
    const fill = id === "nonzero-winding-cancellation";
    assert.equal(item.style.fill, fill ? "black" : "none", label + " fill");
    assert.equal(item.style.stroke, fill ? "none" : "black", label + " stroke");
    if (fill) assert.equal(item.style.fillRule ?? "nonzero", "nonzero", label + " fill rule");
    const dashed = id === "dash-origin";
    assert.equal(Boolean(item.style.dashArray?.length), dashed, label + " dashed stroke");
    assertBarGeometry(actual, expected, label, dashed);
  });

test("bar oracle distinguishes winding, dash origin, closure and the pen after a signed rectangle", () => {
  const rect = [["R", 20, 30, -70, 110]];
  const cyclic = [["M", -50, 140], ["L", 20, 140], ["L", 20, 30], ["L", -50, 30], ["Z"]];
  const reset = ["M", 20, 30], tail = ["L", 60, 80];
  const plain = expandRectangle(rect[0]);
  assertBarGeometry([...cyclic, reset], rect, "rotated with correct pen");
  assertBarGeometry([...plain, reset], rect, "redundant move");
  assertBarGeometry([...plain, tail], [...rect, tail], "implicit pen before line");
  assert.throws(() => assertBarGeometry(cyclic, rect, "missing pen reset"), /final pen/);
  assert.throws(() => assertBarGeometry([...cyclic, tail], [...rect, tail], "wrong line start"), /contour 2/);
  assert.throws(() => assertBarGeometry([...cyclic, reset], rect, "dash phase", true), /contour 1/);
  assert.throws(() => assertBarGeometry([plain[0], plain[3], plain[2], plain[1], plain[4]], rect,
    "reversed winding"), /contour 1/);
  assert.throws(() => assertBarGeometry([...plain.slice(0, -1), ["L", 20, 30]], rect, "unclosed"), /commands/);
});
