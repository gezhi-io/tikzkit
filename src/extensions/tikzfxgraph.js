import { evaluateMath } from "../math.js";
import { splitTopLevel, stripOuterBraces } from "../options.js";

export const tikzfxgraphExtension = {
  name: "tikzfxgraph",
  phase: "preprocess",
  description: "Expands practical tikzfxgraph function-set commands into ordinary PGFPlots axis/addplot syntax.",
  commands: ["fxsetnew", "fxsetappend", "fxsetnewstyle", "fxgraphdraw", "fxgraph"],
  preprocess(source, context = {}) {
    return expandTikzfxgraph(source, context.diagnostics || []);
  }
};

function expandTikzfxgraph(source, diagnostics) {
  const state = {
    fxsets: new Map([["default_set", []], ["default _ set", []]]),
    styles: new Map()
  };
  let output = "";
  let index = 0;
  const text = String(source);

  while (index < text.length) {
    if (text.startsWith("\\fxsetnewstyle", index)) {
      const parsed = parseTwoMandatoryArgs(text, index + "\\fxsetnewstyle".length);
      if (!parsed) {
        diagnostics.push({ severity: "warning", message: "Malformed tikzfxgraph \\fxsetnewstyle command" });
        output += text[index++];
        continue;
      }
      state.styles.set(normalizeKey(parsed.first), parseGraphSpec(parsed.second, state.styles));
      index = parsed.end;
      continue;
    }
    if (text.startsWith("\\fxsetnew", index)) {
      const parsed = parseMandatoryArg(text, index + "\\fxsetnew".length);
      if (!parsed) {
        diagnostics.push({ severity: "warning", message: "Malformed tikzfxgraph \\fxsetnew command" });
        output += text[index++];
        continue;
      }
      const name = parsed.content.trim();
      if (!state.fxsets.has(name)) state.fxsets.set(name, []);
      index = parsed.end;
      continue;
    }
    if (text.startsWith("\\fxsetappend", index)) {
      const parsed = parseTwoMandatoryArgs(text, index + "\\fxsetappend".length);
      if (!parsed) {
        diagnostics.push({ severity: "warning", message: "Malformed tikzfxgraph \\fxsetappend command" });
        output += text[index++];
        continue;
      }
      const name = parsed.first.trim();
      if (!state.fxsets.has(name)) state.fxsets.set(name, []);
      state.fxsets.get(name).push(parseFunctionSpec(parsed.second));
      index = parsed.end;
      continue;
    }
    if (text.startsWith("\\fxgraphdraw", index)) {
      const parsed = parseMandatoryArg(text, index + "\\fxgraphdraw".length);
      if (!parsed) {
        diagnostics.push({ severity: "warning", message: "Malformed tikzfxgraph \\fxgraphdraw command" });
        output += text[index++];
        continue;
      }
      output += renderFxGraph(parsed.content, "", state, diagnostics);
      index = parsed.end;
      continue;
    }
    if (text.startsWith("\\begin{fxgraph}", index)) {
      const parsed = parseFxgraphEnvironment(text, index);
      if (!parsed) {
        diagnostics.push({ severity: "warning", message: "Malformed tikzfxgraph fxgraph environment" });
        output += text[index++];
        continue;
      }
      output += renderFxGraph(parsed.options, parsed.body, state, diagnostics);
      index = parsed.end;
      continue;
    }
    output += text[index];
    index += 1;
  }

  return output;
}

function renderFxGraph(rawOptions, extraBody, state, diagnostics) {
  const spec = parseGraphSpec(rawOptions, state.styles);
  const axisOptions = {
    "axis lines": "left",
    grid: "both",
    width: "8cm",
    height: "3.5cm",
    "trig format": "rad",
    ...spec.axisOptions
  };

  if (spec.axisKind === "semilog x" || spec.axisKind === "loglog") axisOptions["xmode"] = "log";
  if (spec.axisKind === "semilog y" || spec.axisKind === "loglog") axisOptions["ymode"] = "log";
  if (spec.xTicks) {
    axisOptions.xmin = spec.xTicks.min;
    axisOptions.xmax = spec.xTicks.max;
    axisOptions.domain = `${spec.xTicks.min}:${spec.xTicks.max}`;
    const ticks = ticksFromSpec(spec.xTicks, spec.axisKind === "semilog x" || spec.axisKind === "loglog");
    if (ticks.length) axisOptions.xtick = `{${ticks.join(",")}}`;
    if (spec.xTicks.units) axisOptions.xlabel = axisOptions.xlabel || `{${spec.xTicks.units}}`;
  }
  if (spec.yTicks) {
    axisOptions.ymin = spec.yTicks.min;
    axisOptions.ymax = spec.yTicks.max;
    const ticks = ticksFromSpec(spec.yTicks, spec.axisKind === "semilog y" || spec.axisKind === "loglog");
    if (ticks.length) axisOptions.ytick = `{${ticks.join(",")}}`;
    if (spec.yTicks.units) axisOptions.ylabel = axisOptions.ylabel || `{${spec.yTicks.units}}`;
  }

  const functions = [...spec.functions];
  for (const name of spec.fxSets) {
    const set = state.fxsets.get(name);
    if (!set) {
      diagnostics.push({ severity: "warning", message: `Undefined tikzfxgraph fx set: ${name}` });
      continue;
    }
    functions.push(...set);
  }

  const body = [
    ...functions.map((fn) => renderFunction(fn, axisOptions)),
    String(extraBody || "").trim()
  ]
    .filter(Boolean)
    .join("\n");
  const axis = `\\begin{axis}[${formatOptions(axisOptions)}]\n${body}\n\\end{axis}`;
  return spec.sansTikzpicture ? axis : `\\begin{tikzpicture}\n${axis}\n\\end{tikzpicture}`;
}

function parseGraphSpec(rawOptions, styles = new Map(), seenStyles = new Set()) {
  const spec = {
    axisKind: "linear",
    axisOptions: {},
    xTicks: null,
    yTicks: null,
    functions: [],
    fxSets: [],
    sansTikzpicture: false
  };
  for (const entry of parseKeyEntries(rawOptions)) {
    const key = normalizeKey(entry.key);
    if (styles.has(key) && !seenStyles.has(key)) {
      mergeGraphSpec(spec, parseGraphSpecFromStyle(styles.get(key), styles, new Set([...seenStyles, key])));
      continue;
    }
    if (key === "linear" || key === "loglog" || key === "semilog x" || key === "semilog y") {
      spec.axisKind = key;
      continue;
    }
    if (key === "x ticks") {
      spec.xTicks = parseTicksSpec(entry.value);
      continue;
    }
    if (key === "y ticks") {
      spec.yTicks = parseTicksSpec(entry.value);
      continue;
    }
    if (key === "function") {
      spec.functions.push(parseFunctionSpec(entry.value));
      continue;
    }
    if (key === "fx set") {
      spec.fxSets.push(...splitTopLevel(stripOuterBraces(entry.value), ",").map((part) => part.trim()).filter(Boolean));
      continue;
    }
    if (key === "sans tikzpicture" || key === "without tikzpicture") {
      spec.sansTikzpicture = true;
      continue;
    }
    if (key === "use file") continue;
    spec.axisOptions[entry.key.trim()] = entry.value === "" ? true : entry.value;
  }
  return spec;
}

function parseGraphSpecFromStyle(styleSpec, styles, seenStyles) {
  const cloned = {
    axisKind: styleSpec.axisKind,
    axisOptions: { ...styleSpec.axisOptions },
    xTicks: styleSpec.xTicks ? { ...styleSpec.xTicks } : null,
    yTicks: styleSpec.yTicks ? { ...styleSpec.yTicks } : null,
    functions: [...styleSpec.functions],
    fxSets: [...styleSpec.fxSets],
    sansTikzpicture: styleSpec.sansTikzpicture
  };
  for (const key of Object.keys(cloned.axisOptions)) {
    const normalized = normalizeKey(key);
    if (styles.has(normalized) && !seenStyles.has(normalized)) {
      delete cloned.axisOptions[key];
      mergeGraphSpec(cloned, parseGraphSpecFromStyle(styles.get(normalized), styles, new Set([...seenStyles, normalized])));
    }
  }
  return cloned;
}

function mergeGraphSpec(target, source) {
  if (source.axisKind && source.axisKind !== "linear") target.axisKind = source.axisKind;
  target.axisOptions = { ...target.axisOptions, ...source.axisOptions };
  if (source.xTicks) target.xTicks = source.xTicks;
  if (source.yTicks) target.yTicks = source.yTicks;
  target.functions.push(...source.functions);
  target.fxSets.push(...source.fxSets);
  target.sansTikzpicture = target.sansTikzpicture || source.sansTikzpicture;
  return target;
}

function parseFunctionSpec(raw) {
  const fn = {
    fx: "0",
    legend: "",
    samples: "",
    styleOptions: {}
  };
  for (const entry of parseKeyEntries(raw)) {
    const key = normalizeKey(entry.key);
    if (key === "fx") fn.fx = stripOuterBraces(entry.value).trim();
    else if (key === "legend") fn.legend = stripOuterBraces(entry.value).trim();
    else if (key === "samples") fn.samples = stripOuterBraces(entry.value).trim();
    else if (key === "id" || key === "use file") continue;
    else fn.styleOptions[entry.key.trim()] = entry.value === "" ? true : entry.value;
  }
  return fn;
}

function renderFunction(fn, axisOptions) {
  const options = {
    mark: "none",
    samples: fn.samples || axisOptions.samples || 80,
    ...fn.styleOptions
  };
  const expression = normalizeGnuplotExpression(fn.fx);
  const legend = fn.legend ? `\n\\addlegendentry{${fn.legend}}` : "";
  return `\\addplot+ [${formatOptions(options)}] {${expression}};${legend}`;
}

function parseTicksSpec(raw) {
  const options = {};
  for (const entry of parseKeyEntries(raw)) {
    options[normalizeKey(entry.key)] = stripOuterBraces(entry.value).trim();
  }
  if (options.phi === "") {
    options.min = "-3.14159265";
    options.max = "3.14159265";
    options.N = "8";
    options.units = "rad";
  }
  if (options.db === "") {
    options.min = "-20";
    options.max = "80";
    options.N = "5";
    options.units = "db";
  }
  return {
    min: options.min ?? "0",
    max: options.max ?? "1",
    delta: options.delta,
    N: options.n ?? options.N,
    units: options.units
  };
}

function ticksFromSpec(spec, logarithmic = false) {
  const min = evaluateMath(spec.min);
  const max = evaluateMath(spec.max);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [];
  if (spec.N !== undefined && spec.N !== "") {
    const count = Math.max(1, Math.round(evaluateMath(spec.N)));
    if (logarithmic && min > 0 && max > 0) {
      const start = Math.log(min);
      const step = (Math.log(max) - start) / count;
      return Array.from({ length: count + 1 }, (_unused, index) => fmt(Math.exp(start + step * index)));
    }
    const step = (max - min) / count;
    return Array.from({ length: count + 1 }, (_unused, index) => fmt(min + step * index));
  }
  if (spec.delta !== undefined && spec.delta !== "") {
    const delta = Math.abs(evaluateMath(spec.delta));
    if (!Number.isFinite(delta) || delta <= 0) return [];
    const values = [];
    if (logarithmic && min > 0 && max > 0) {
      let value = min;
      while (value <= max * (1 + 1e-9) && values.length < 200) {
        values.push(fmt(value));
        value *= delta;
      }
      return values;
    }
    for (let value = min; value <= max + 1e-9 && values.length < 200; value += delta) values.push(fmt(value));
    return values;
  }
  return [];
}

function parseKeyEntries(raw) {
  return splitTopLevel(stripOuterBraces(raw), ",").map((part) => {
    const index = findTopLevelEquals(part);
    if (index === -1) return { key: part.trim(), value: "" };
    return {
      key: part.slice(0, index).trim(),
      value: stripOuterBraces(part.slice(index + 1).trim())
    };
  }).filter((entry) => entry.key);
}

function findTopLevelEquals(input) {
  let paren = 0;
  let bracket = 0;
  let brace = 0;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === "(") paren += 1;
    else if (char === ")") paren = Math.max(0, paren - 1);
    else if (char === "[") bracket += 1;
    else if (char === "]") bracket = Math.max(0, bracket - 1);
    else if (char === "{") brace += 1;
    else if (char === "}") brace = Math.max(0, brace - 1);
    else if (char === "=" && paren === 0 && bracket === 0 && brace === 0) return index;
  }
  return -1;
}

function parseFxgraphEnvironment(source, start) {
  let index = start + "\\begin{fxgraph}".length;
  const options = parseMandatoryArg(source, index);
  if (!options) return null;
  index = options.end;
  const endToken = "\\end{fxgraph}";
  const end = source.indexOf(endToken, index);
  if (end === -1) return null;
  return {
    options: options.content,
    body: source.slice(index, end),
    end: end + endToken.length
  };
}

function parseTwoMandatoryArgs(source, index) {
  const first = parseMandatoryArg(source, index);
  if (!first) return null;
  const second = parseMandatoryArg(source, first.end);
  if (!second) return null;
  return {
    first: first.content,
    second: second.content,
    end: second.end
  };
}

function parseMandatoryArg(source, index) {
  const start = skipWhitespace(source, index);
  if (source[start] !== "{") return null;
  return extractBalanced(source, start, "{", "}");
}

function extractBalanced(source, start, open, close) {
  if (source[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === "\\" && index + 1 < source.length) {
      index += 1;
      continue;
    }
    if (char === open) depth += 1;
    if (char === close) {
      depth -= 1;
      if (depth === 0) {
        return {
          content: source.slice(start + 1, index),
          end: index + 1
        };
      }
    }
  }
  return null;
}

function skipWhitespace(source, index) {
  let cursor = index;
  while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;
  return cursor;
}

function normalizeKey(key) {
  return String(key || "").trim().replace(/~/g, " ").replace(/\s+/g, " ");
}

function normalizeGnuplotExpression(expression) {
  return String(expression || "0")
    .trim()
    .replace(/\*\*/g, "^")
    .replace(/\blog10\s*\(/g, "log10(");
}

function formatOptions(options) {
  return Object.entries(options || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => (value === true ? key : `${key}=${value}`))
    .join(",");
}

function fmt(value) {
  const rounded = Math.round((value + Number.EPSILON) * 1e8) / 1e8;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}
