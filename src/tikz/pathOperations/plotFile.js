import { evaluateMathResult, substituteVariables } from "../../engine/math.js";
import { splitTopLevel } from "../../engine/options.js";
import { MATH_EXPRESSION_LIMITS } from "../../engine/safe-expression.js";
import { pgfPointExpressionSource } from "../../engine/units.js";
import { resolveDataFile, texDataFilename } from "../../frontend/data-files.js";

const expansionLimit = { maxLength: MATH_EXPRESSION_LIMITS.characters };

function basisFactor(field, env) {
  // pgfpointxy math-parses each factor. A dimension contributes its numeric
  // TeX-point value *before* multiplication by the current x/y basis.
  return evaluateMathResult(pgfPointExpressionSource(field, env), env.variables).value;
}

export function tikzPlotFileRuns(segment, options, env, diagnostics) {
  const filename = texDataFilename(substituteVariables(segment.filename, env.variables, expansionLimit));
  const text = filename ? resolveDataFile(filename, env.dataFiles, env.pgfplotsTableResolver) : undefined;
  if (typeof text !== "string") {
    diagnostics.push({ severity: "warning", code: "tikz-plot-file-not-found",
      message: filename ? `Could not resolve TikZ plot file '${filename}'.` : "Expected a filename in plot file {name}." });
    return [];
  }

  // In pgfmoduleplot.code.tex all three stream commands dispatch through
  // pgfplot@outliers, including undefined points and new datasets.
  let outliers = "jump";
  for (const [key, value] of Object.entries(options)) {
    if (key === "handle outlier points in plots" || key === "/pgf/handle outlier points in plots") outliers = value;
  }
  const runs = [[]];
  const jump = () => {
    // A leading o/u (unlike a leading blank) lifts even a preceding --.
    if (runs.length === 1 || runs.at(-1).length) runs.push([]);
  };
  let seenRow = false;
  const lines = text.split(/\r\n?|\n/);
  for (const [i, line] of lines.entries()) {
    const comment = line.search(/[%#]/);
    const prefix = comment < 0 ? line : line.slice(0, comment);
    const data = prefix.trim();
    if (!data) {
      if (seenRow && outliers === "jump") jump();
      continue;
    }
    seenRow = true;
    const [x, y, tail, extra] = splitTopLevel(data.replace(/[ \t]+/g, " "), " ");
    // PGF compares the *whole* remainder to "u " or "o ". A comment
    // immediately after the flag suppresses TeX's trailing endline space.
    const flag = !extra && (comment < 0 || /[ \t]$/.test(prefix)) ? tail : undefined;
    if (flag === "u" || (flag === "o" && outliers !== "plot")) {
      if (outliers === "jump") jump();
      continue;
    }
    const point = y && { x: basisFactor(x, env), y: basisFactor(y, env) };
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      diagnostics.push({ severity: "warning", code: "tikz-plot-file-invalid-row",
        message: `TikZ plot file '${filename}', line ${i + 1}: expected two finite numeric fields.` });
      jump();
      continue;
    }
    runs.at(-1).push(point);
  }
  if (!runs.at(-1).length) runs.pop();
  return runs.at(-1)?.length ? runs : [];
}
