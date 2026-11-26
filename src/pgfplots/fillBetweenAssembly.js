import { closePathCommand, curveToCommand, lineToCommand, moveToCommand } from "../engine/pathBuilder.js";
import { PGF_SP } from "../engine/pgf-fixed-point.js";

const spPerCm = PGF_SP * 72.27 / 2.54;
const toSp = cm => Math.sign(cm) * Math.round(Math.abs(cm) * spPerCm);
const isClose = c => c.type === "closePath";

function prepareBoundary(path, keepMoves) {
  if (!path?.length || path[0].type !== "moveTo") return [];
  if (keepMoves) return path.slice();
  const result = [path[0]];
  let originalMove = path[0];
  for (let i = 1; i < path.length; i++) {
    const c = path[i];
    if (c.type === "moveTo") {
      originalMove = c;
      // Of a run of inner moves only the last connects, and only before more ink.
      if (path[i + 1] && path[i + 1].type !== "moveTo") result.push(lineToCommand(c));
    } else if (isClose(c) && originalMove !== path[0]) {
      // PGF close tokens remember their ORIGINAL move even after it became a line.
      // Reversing a subsequent segment needs that point; it is not a painted vertex.
      result.push({ ...c, x: originalMove.x, y: originalMove.y });
    } else result.push(c);
  }
  return result;
}

function ascending(path) {
  if (path.length === 1) return true;
  const [a, b] = path;
  // Second instruction's endpoint, including for a cubic. Equal X falls back to Y;
  // two identical endpoints are descending, not an invitation to scan ahead.
  const end = isClose(b) && b.x === undefined ? a : b;
  const x = toSp(a.x), nextX = toSp(end.x);
  return x < nextX || (x === nextX && toSp(a.y) < toSp(end.y));
}

export function prepareFillBetweenPaths(first, second, options = {}) {
  let mode = "auto", keepMoves = false;
  for (const [key, value] of Object.entries(options)) {
    const choice = String(value).trim();
    switch (key.replace(/^\/pgf\/fill between\//, "")) {
      case "reverse":
        if (choice === "auto" || choice === "true" || choice === "false") mode = choice;
        break;
      case "inner moveto":
        if (choice === "connect" || choice === "keep") keepMoves = choice === "keep";
        break;
    }
  }
  first = prepareBoundary(first, keepMoves);
  second = prepareBoundary(second, keepMoves);
  const reverse = mode === "true" || (mode === "auto" && first.length > 0 && second.length > 0 &&
    ascending(first) === ascending(second));
  return { first, second, reverse };
}

function reverseBoundary(path) {
  // PGF prepends each reversed instruction with its previous endpoint. This
  // reverses subpath order too. A close prepends a move and APPENDS a close.
  const backwards = [];
  let previous, start, closes = 0;
  for (const c of path) {
    if (isClose(c)) {
      backwards.push(moveToCommand(previous));
      previous = c.x === undefined ? start : c;
      closes++;
    } else {
      if (previous) {
        if (c.type === "curveTo") {
          backwards.push(curveToCommand({ x: c.x2, y: c.y2 }, { x: c.x1, y: c.y1 }, previous));
        } else backwards.push(c.type === "moveTo" ? moveToCommand(previous) : lineToCommand(previous));
      }
      if (c.type === "moveTo") start = c;
      previous = c;
    }
  }
  if (!isClose(path.at(-1))) backwards.push(moveToCommand(previous));
  backwards.reverse();
  for (let i = 0; i < closes; i++) backwards.push(closePathCommand());
  return backwards;
}

export function joinFillBetweenPaths(first, second, reverse) {
  if (!first?.length || !second?.length) return [];
  const b = reverse ? reverseBoundary(second) : second;
  const closedB = b.some(isClose);
  const result = first.concat(b).map(c => isClose(c) ? closePathCommand() : c);
  if (!closedB && b[0].type === "moveTo") result[first.length] = lineToCommand(b[0]);
  if (!closedB && !first.some(isClose)) result.push(closePathCommand());
  return result;
}

export function assembleFillBetweenPaths(first, second, options = {}) {
  const prepared = prepareFillBetweenPaths(first, second, options);
  return joinFillBetweenPaths(prepared.first, prepared.second, prepared.reverse);
}
