import { stripOuterBraces } from "../../engine/options.js";
import { pgfDimension, pgfPrintDimension } from "../../engine/pgf-fixed-point.js";
import { appendForeachValue, reserveForeachListScan, ForeachExpansionError } from "./foreach.js";

// pgffor@scanround protects the comma in a leading coordinate; scanone
// respects TeX groups and preserves empty entries, including a trailing one.
function* scalarEntries(raw) {
  if (!raw.trim()) return;
  let start = 0, braces = 0, round = false, first = true;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (first && /\s/.test(ch)) continue;
    if (first) { round = ch === "("; first = false; }
    if (ch === "\\") { i++; continue; }
    if (ch === "{") braces++;
    if (ch === "}") braces--;
    if (braces) continue;
    if (ch === ")") round = false;
    if (ch === "," && !round) {
      yield stripOuterBraces(raw.slice(start,i).trim());
      start = i+1;
      first = true;
    }
  }
  yield stripOuterBraces(raw.slice(start).trim());
}

/** Expand the body of an already substituted, single-variable PGF foreach
 * list. Unlike multi-variable assignment, x/y is one literal value here. */
export function expandForeachScalarList(input, env = {}) {
  const raw = String(input ?? "");
  const budget = reserveForeachListScan(raw, env);
  const entries = scalarEntries(raw), values = [];
  let previous, last;
  for (const entry of entries) {
    const dots = entry.indexOf("...");
    if (dots < 0) {
      appendForeachValue(values, entry, budget);
      previous = last;
      last = entry;
      continue;
    }
    const next = entries.next();
    if (next.done || last === undefined) {
      throw new ForeachExpansionError("foreach-invalid-range", "Foreach dots need a preceding value and an end.", entry);
    }
    const prefix = entry.slice(0,dots), suffix = entry.slice(dots+3);
    const strip = s => s?.startsWith(prefix) && s.endsWith(suffix) ? s.slice(prefix.length, s.length-suffix.length) : "";
    const letters = /^[a-z]$/i.test(strip(next.value));
    const numeric = s => {
      const v = strip(s);
      return letters ? (/^[a-z]$/i.test(v) ? v.charCodeAt(0) : NaN) : v ? pgfDimension(v) : NaN;
    };
    const a = numeric(last), z = numeric(next.value);
    const step = previous ? a - numeric(previous) : z > a ? 1 : -1;
    if (![a,z,step].every(Number.isFinite)) {
      throw new ForeachExpansionError("foreach-nonfinite-range", "Foreach range needs matching numeric or alphabetic endpoints.", entry);
    }
    if (!step || a + step === a) {
      throw new ForeachExpansionError("foreach-nonprogressing-range", "Foreach range step must make progress.", entry);
    }
    // pgffor@doloop advances a dimension register (0,.1,...,.5 ends at
    // 0.40002). Only actual list items, not generated values, update last.
    for (let v = a + step; step > 0 ? v <= z : v >= z; v += step) {
      const text = letters ? String.fromCharCode(v) : pgfPrintDimension(v).replace(/\.0$/, "");
      appendForeachValue(values, prefix + text + suffix, budget);
    }
  }
  return values;
}
