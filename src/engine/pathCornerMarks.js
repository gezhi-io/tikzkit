import { roundPathCorners } from "../tikz/pathOperations/roundedCorners.js";
import { parseFinitePgfLength } from "./units.js";

export function pathCornerInset(options, env) {
  if (!Object.hasOwn(options, "rounded corners")) return 0;
  const value = options["rounded corners"];
  const raw = value === true || value === "" ? "4pt" : value;
  return parseFinitePgfLength(raw, env, 0) * (env.canvasScale || 1);
}

// PGF records a specialround token during construction, before the incoming
// segment, and resolves corners only once the following segment is known.
// Store changes of setting, so an ordinary sharp path allocates no per-point data.
export function pathCornerMarks(commands, initial) {
  const runs = [];
  let start = 0;
  let inset = initial;
  function record() {
    if (inset && start < commands.length) runs.push({ start, end: commands.length, inset });
    start = commands.length;
  }
  function select(value) {
    if (value === inset) return;
    record();
    inset = value;
  }
  return {
    select,
    // Ellipse primitives and the internal pieces of an arc bypass PGF's
    // public corner-aware path constructors. Don't round their smooth joins.
    appendUnmarked(raw) {
      if (inset) record();
      commands.push(...raw);
      start = commands.length;
    },
    resolve() {
      if (!runs.length) {
        if (!inset) return commands;
        return roundPathCorners(commands, (_, i) => i >= start ? inset : 0);
      }
      record();
      const marks = new Float64Array(commands.length);
      for (const run of runs) marks.fill(run.inset, run.start, run.end);
      return roundPathCorners(commands, (_, i) => marks[i]);
    }
  };
}
