import { isColorToken } from "../../engine/colors.js";
import { parseOptions } from "../../engine/options.js";
import { pgfDimension } from "../../engine/pgf-fixed-point.js";
import { FOREACH_EXPANSION_LIMIT, ForeachExpansionError } from "../commands/foreach.js";
import { expandForeachScalarList } from "../commands/foreachScalarList.js";

// tikzlibrarypetri.code.tex: indexed by total children, then by source order.
// The growth macro initializes both shifts to zero before looking up a placer;
// an undefined placer (ten or more children) leaves every child at the center.
const placers = [
  [], [[0,0]], [[-.5,0],[.5,0]], [[0,.57],[-.5,-.306025],[.5,-.306025]],
  [[-.5,.5],[.5,.5],[-.5,-.5],[.5,-.5]],
  [[0,.85],[-.808398,.26266],[.808398,.26266],[-.499617,-.687664],[.499617,-.687664]],
  [[-1,.5],[0,.5],[1,.5],[-1,-.5],[0,-.5],[1,-.5]],
  [[0,1],[-1,.5],[0,0],[1,.5],[-1,-.5],[0,-1],[1,-.5]],
  [[-.5,1],[.5,1],[-1,0],[0,0],[1,0],[-1,-1],[0,-1],[1,-1]],
  [[-1,1],[0,1],[1,1],[-1,0],[0,0],[1,0],[-1,-1],[0,-1],[1,-1]]
];

export function petriTokenOffset(index, count, distance) {
  const [x, y] = placers[count]?.[index] ?? [0,0];
  return { x: pgfDimension(x) * distance, y: pgfDimension(y) * distance };
}

export function petriChildLayout(inherited, ...layers) {
  const state = { ...inherited };
  for (const layer of layers) for (const [raw, value] of Object.entries(layer ?? {})) {
    const key = raw.replace(/^\/tikz\//, "");
    // The native style assigns two independent tree settings. Overriding
    // grow later does not reinstate the parent edge.
    if (key === "children are tokens") state.active = state.grow = state.noEdge = true;
    else if (key === "token distance") state.distance = value;
    else if (key === "grow" || key === "grow'" || key === "grow via three points") state.grow = false;
    else if (key === "edge from parent path") state.noEdge = value === "";
  }
  return state;
}

export function petriChildNodeOptions(options) {
  const result = {};
  for (const [key, value] of Object.entries(options)) {
    result[key] = value;
    if ((value === true && isColorToken(key)) || key === "color") {
      // A bare color after token changes the already-enabled fill's ink.
      delete result["tikzkit fill ink"];
      result["tikzkit fill ink"] = key === "color" ? value : key;
    }
  }
  return result;
}

export function* petriTokenGroups(options, env) {
  for (const [rawKey, values] of Object.entries(options)) {
    const key = rawKey.replace(/^tikzkit prior (.+) \d+$/, "$1").replace(/^\/tikz\//, "");
    if (key !== "tokens" && key !== "colored tokens" && key !== "structured tokens") continue;
    for (const raw of Array.isArray(values) ? values : [values]) {
      let list = raw;
      if (key === "tokens") {
        if (!/^[+-]?\d+$/.test(String(raw).trim())) {
          throw new ForeachExpansionError("petri-invalid-token-count", "Petri tokens requires an integer count.", raw);
        }
        if (Number(raw) <= 0) continue;
        if (Number(raw) > (env.foreachBudget?.remainingIterations ?? FOREACH_EXPANSION_LIMIT)) {
          throw new ForeachExpansionError("foreach-expansion-limit", "Petri tokens exceeds the shared iteration limit.", raw);
        }
        list = "1,...," + Number(raw);
      }
      const labels = expandForeachScalarList(list, env);
      if (!labels.length) continue;
      yield labels.map(label => ({
        node: { type: "node", text: key === "structured tokens" ? label : "",
          options: key === "colored tokens" ? { token: true, ...parseOptions(label) } : { token: true } }
      }));
    }
  }
}
