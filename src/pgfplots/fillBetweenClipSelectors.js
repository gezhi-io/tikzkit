import { findTopLevel, parseOptions, stripOuterBraces } from "../engine/options.js";
import { expandAxisLimitKeys, mapAxisOverlayPoint } from "./axisOverlay.js";
import { axisNumber, readCoordinateTuple } from "./coordinates.js";
import { fillBetweenRectangleBox } from "./fillBetweenBox.js";
import { bareFillBetweenCorner } from "./fillBetweenCorner.js";

// tikzlibsoftclip@setkey accepts a path directly, a saved name, or a list
// of assignments. Each assignment replaces the complete clip contour.
export function fillBetweenClipSelector(value) {
  if (typeof value !== "string") return null;
  const text = stripOuterBraces(value.trim()).trim();
  if (!text) return null;
  if (text.startsWith("(")) return { kind: "path", value: text };
  if (findTopLevel(text, "=") === -1) return { kind: "name", value: text };
  let selector = null;
  for (const [rawKey, arg] of Object.entries(parseOptions(text))) {
    const key = rawKey.replace(/^\/tikz\/soft clip assign\//, "");
    if (typeof arg !== "string") return { kind: "unsupported", value: text };
    if (key === "name" || key === "path") selector = { kind: key, value: arg.trim() };
    else if (key === "domain" || key === "domain y" || key === "y domain y") {
      selector = { kind: "domain", value: (key === "y domain y" ? "domain y" : key) + "=" + arg };
    } else return { kind: "unsupported", value: text };
  }
  return selector;
}

function corner(fields, ranges, geometry, axisOptions) {
  if (fields.length !== 2) return null;
  let [rawX, rawY] = fields;
  const prefix = /^\s*([a-z]+(?:\s+[a-z]+)*)\s*:\s*/i.exec(rawX);
  if (!prefix) return bareFillBetweenCorner(fields, ranges, geometry, axisOptions);
  const system = prefix[1].toLowerCase().replace(/\s+/g, " ");
  rawX = rawX.slice(prefix[0].length);
  const x = axisNumber(rawX, NaN), y = axisNumber(rawY, NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const p = mapAxisOverlayPoint(system, { x, y, z: 0 }, ranges, geometry);
  return Number.isFinite(p?.x) && Number.isFinite(p?.y) ? p : null;
}

export function explicitFillBetweenClipBox(path, ranges, geometry, axisOptions = {}) {
  if (geometry?.is3d || !geometry?.mapPoint || !ranges) return null;
  const text = expandAxisLimitKeys(path, ranges).trim();
  const a = readCoordinateTuple(text, 0);
  const op = a && /^\s*rectangle\s*(?=\()/.exec(text.slice(a.end));
  const b = op && readCoordinateTuple(text, a.end + op[0].length);
  if (!b || b.end !== text.length) return null;
  const p = corner(a.fields, ranges, geometry, axisOptions), q = corner(b.fields, ranges, geometry, axisOptions);
  return fillBetweenRectangleBox(p, q);
}
