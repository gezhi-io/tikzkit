import { evaluateMath, parseDimension } from "../../engine/math.js";
import { findTopLevel, parseOptions, splitTopLevel } from "../../engine/options.js";

const MAX_EXPANDED_SYMBOLS = 100000;

export const tikzLibrary = {
  name: "lindenmayersystems",
  status: "partial",
  implementedBy: "src/tikz/libraries/lindenmayersystems.js:lowerLindenmayerSystems",
  features: [
    "named and inline rule sets",
    "F/f/+/-/[ ] turtle symbols",
    "step, angle, left angle, right angle, axiom, and order keys"
  ],
  implements: [
    "lindenmayer system path operation",
    "l-system path-operation alias",
    "pgfdeclarelindenmayersystem rules"
  ],
  notes: "Lowers deterministic L-systems into ordinary TikZ paths. Randomized step/angle, custom arbitrary TeX symbol bodies, global l-system defaults, and anchor-node placement remain deferred."
};

// The PGF implementation expands production rules before executing a small
// turtle alphabet. Lower that deterministic subset to ordinary TikZ paths so
// the normal path interpreter and SVG renderer stay renderer-neutral.
export function lowerLindenmayerSystems(source, diagnostics = []) {
  const text = String(source || "");
  if (!/\\pgfdeclarelindenmayersystem\b|\b(?:lindenmayer system|l-system)\b/.test(text)) {
    return text;
  }
  const declared = new Map();
  const withoutDeclarations = collectDeclarations(text, declared, diagnostics);
  return lowerPathOperations(withoutDeclarations, declared, diagnostics);
}

function collectDeclarations(source, declarations, diagnostics) {
  let output = "";
  let index = 0;
  const command = "\\pgfdeclarelindenmayersystem";
  while (index < source.length) {
    const start = source.indexOf(command, index);
    if (start < 0) return output + source.slice(index);
    output += source.slice(index, start);
    let cursor = skipWhitespace(source, start + command.length);
    const name = readBalanced(source, cursor, "{", "}");
    cursor = name ? skipWhitespace(source, name.end) : cursor;
    const specification = name && readBalanced(source, cursor, "{", "}");
    if (!name || !specification) {
      output += command;
      index = start + command.length;
      continue;
    }
    const normalizedName = name.content.trim();
    const declaration = parseDeclaration(specification.content);
    if (!normalizedName || !declaration.rules.size) {
      warn(diagnostics, "Could not parse a Lindenmayer system declaration");
    } else {
      declarations.set(normalizedName, declaration);
    }
    index = specification.end;
  }
  return output;
}

function parseDeclaration(specification) {
  const rules = parseRulesFromText(specification);
  const symbols = new Map();
  const symbolPattern = /\\symbol\s*\{([^{}])\}\s*\{([\s\S]*?)\}/g;
  for (const match of specification.matchAll(symbolPattern)) {
    const symbol = match[1];
    const body = match[2];
    if (/\\pgflsystemdrawforward\b/.test(body)) symbols.set(symbol, "F");
    else if (/\\pgflsystemmoveforward\b/.test(body)) symbols.set(symbol, "f");
    else if (/\\pgflsystemturnleft\b/.test(body)) symbols.set(symbol, "+");
    else if (/\\pgflsystemturnright\b/.test(body)) symbols.set(symbol, "-");
  }
  return { rules, symbols };
}

function lowerPathOperations(source, declarations, diagnostics) {
  let output = "";
  let index = 0;
  const commandPattern = /\\(draw|path|filldraw|shadedraw|fill)\b/g;
  while (true) {
    commandPattern.lastIndex = index;
    const match = commandPattern.exec(source);
    if (!match) return output + source.slice(index);
    output += source.slice(index, match.index);
    const end = findStatementEnd(source, commandPattern.lastIndex);
    if (end < 0) {
      output += source.slice(match.index);
      return output;
    }
    const statement = source.slice(match.index, end + 1);
    const lowered = lowerPathStatement(statement, declarations, diagnostics);
    output += lowered || statement;
    index = end + 1;
  }
}

function lowerPathStatement(statement, declarations, diagnostics) {
  const operation = findLSystemOperation(statement);
  if (!operation) return null;
  const bracketGroups = collectBracketGroups(statement);
  let rawConfig = null;
  const styleParts = [];
  for (const group of bracketGroups) {
    const split = splitLSystemOptions(group.content);
    if (split.config !== null) rawConfig = split.config;
    if (split.remaining) styleParts.push(split.remaining);
  }
  if (rawConfig === null) {
    warn(diagnostics, "Lindenmayer system needs a local l-system or lindenmayer system option");
    return null;
  }

  const config = parseLSystemConfig(rawConfig, declarations);
  if (!config) {
    warn(diagnostics, "Could not resolve Lindenmayer system rules");
    return null;
  }
  if (nonZeroOption(config.options["randomize step percent"]) || nonZeroOption(config.options["randomize angle percent"])) {
    warn(diagnostics, "Lindenmayer randomize step/angle options are not implemented");
    return null;
  }
  if (config.options.anchor !== undefined) {
    warn(diagnostics, "Lindenmayer anchor-node placement is not implemented");
    return null;
  }

  const start = parsePathStart(statement.slice(0, operation.start));
  if (!start) {
    warn(diagnostics, "Could not resolve Lindenmayer system start coordinate");
    return null;
  }
  const expanded = expandRules(config.axiom, config.rules, config.order);
  if (expanded === null) {
    warn(diagnostics, `Lindenmayer expansion exceeds ${MAX_EXPANDED_SYMBOLS} symbols`);
    return null;
  }
  const trace = traceTurtle(expanded, start, config);
  if (!trace.groups.length) return "";

  const command = statement.match(/^\\(draw|path|filldraw|shadedraw|fill)\b/)?.[1] || "draw";
  const style = styleParts.filter(Boolean).join(",");
  const cycle = /--\s*cycle\s*;$/.test(statement);
  if (trace.groups.length > 1 && command !== "draw" && command !== "path") {
    warn(diagnostics, "Lindenmayer branch paths currently preserve stroke geometry only");
    return null;
  }
  return trace.groups
    .map((points, groupIndex) => renderPath(command, style, points, cycle && groupIndex === trace.groups.length - 1 && trace.groups.length === 1))
    .join("\n");
}

function findLSystemOperation(statement) {
  const withoutOptionValues = stripBalancedGroups(statement, "[", "]");
  const match = /\b(lindenmayer\s+system|l-system)\b(?!\s*=)/.exec(withoutOptionValues);
  if (!match) return null;
  // The stripped text has the same length as the original so offsets stay valid.
  return { start: match.index, end: match.index + match[0].length };
}

function stripBalancedGroups(text, open, close) {
  let depth = 0;
  let output = "";
  for (const character of text) {
    if (character === open) depth += 1;
    output += depth ? " " : character;
    if (character === close && depth > 0) depth -= 1;
  }
  return output;
}

function collectBracketGroups(statement) {
  const groups = [];
  for (let index = 0; index < statement.length; index += 1) {
    if (statement[index] !== "[") continue;
    const group = readBalanced(statement, index, "[", "]");
    if (!group) continue;
    groups.push(group);
    index = group.end - 1;
  }
  return groups;
}

function splitLSystemOptions(rawOptions) {
  let config = null;
  const remaining = [];
  for (const part of splitTopLevel(rawOptions, ",")) {
    const equals = findTopLevel(part, "=");
    const key = (equals < 0 ? part : part.slice(0, equals)).trim();
    if (/^(?:l-system|lindenmayer system)$/.test(key)) {
      config = equals < 0 ? "" : part.slice(equals + 1).trim().replace(/^\{([\s\S]*)\}$/, "$1");
    } else {
      remaining.push(part);
    }
  }
  return { config, remaining: remaining.join(",") };
}

function parseLSystemConfig(rawConfig, declarations) {
  const parts = splitTopLevel(rawConfig, ",");
  const options = parseOptions(rawConfig);
  const name = parts.find((part) => findTopLevel(part, "=") < 0)?.trim() || "";
  const declared = name ? declarations.get(name) : null;
  const rules = options["rule set"] ? parseRulesFromText(String(options["rule set"])) : declared?.rules;
  if (!rules?.size) return null;
  const symbols = new Map(declared?.symbols || []);
  const axiom = String(options.axiom ?? "").replace(/\s+/g, "");
  const order = Math.max(0, Math.trunc(evaluateMath(String(options.order ?? "0"))));
  const step = parseDimension(String(options.step ?? "5pt"));
  const leftAngle = evaluateMath(String(options["left angle"] ?? options.angle ?? "90"));
  const rightAngle = evaluateMath(String(options["right angle"] ?? options.angle ?? "90"));
  if (!axiom || !Number.isFinite(step) || step <= 0 || !Number.isFinite(leftAngle) || !Number.isFinite(rightAngle)) return null;
  return { rules, symbols, axiom, order, step, leftAngle, rightAngle, options };
}

function parseRulesFromText(rawRules) {
  const rules = new Map();
  const pattern = /\\rule\s*\{([\s\S]*?)\}|(?:^|,)\s*([^,{}]+?\s*->\s*[^,{}]+)/g;
  for (const match of rawRules.matchAll(pattern)) {
    const raw = (match[1] ?? match[2] ?? "").trim();
    const arrow = raw.indexOf("->");
    if (arrow < 1) continue;
    const head = raw.slice(0, arrow).trim();
    const body = raw.slice(arrow + 2).replace(/\s+/g, "");
    if (head.length === 1) rules.set(head, body);
  }
  return rules;
}

function expandRules(axiom, rules, order) {
  let current = axiom;
  for (let iteration = 0; iteration < order; iteration += 1) {
    let next = "";
    for (const symbol of current) {
      next += rules.get(symbol) ?? symbol;
      if (next.length > MAX_EXPANDED_SYMBOLS) return null;
    }
    current = next;
  }
  return current;
}

function traceTurtle(symbols, start, config) {
  let position = { ...start };
  let heading = 0;
  let current = null;
  const groups = [];
  const stack = [];
  const flush = () => {
    if (current && current.length > 1) groups.push(current);
    current = null;
  };
  const begin = () => {
    if (!current) current = [{ ...position }];
  };
  for (const rawSymbol of symbols) {
    const symbol = config.symbols.get(rawSymbol) ?? rawSymbol;
    if (symbol === "F" || symbol === "f") {
      const radians = (heading * Math.PI) / 180;
      const next = {
        x: position.x + Math.cos(radians) * config.step,
        y: position.y + Math.sin(radians) * config.step
      };
      if (symbol === "F") {
        begin();
        current.push(next);
      } else {
        flush();
      }
      position = next;
      continue;
    }
    if (symbol === "+") {
      heading += config.leftAngle;
      continue;
    }
    if (symbol === "-") {
      heading -= config.rightAngle;
      continue;
    }
    if (symbol === "[") {
      flush();
      stack.push({ position: { ...position }, heading });
      continue;
    }
    if (symbol === "]") {
      flush();
      const saved = stack.pop();
      if (saved) {
        position = saved.position;
        heading = saved.heading;
      }
    }
  }
  flush();
  return { groups };
}

function parsePathStart(prefix) {
  const matches = [...prefix.matchAll(/\(([-+0-9.eE\s]+),\s*([-+0-9.eE\s]+)\)/g)];
  if (!matches.length) return { x: 0, y: 0 };
  const last = matches.at(-1);
  const x = evaluateMath(last[1]);
  const y = evaluateMath(last[2]);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function renderPath(command, style, points, cycle) {
  const coordinates = points.map(formatPoint).join(" -- ");
  return `\\${command}${style ? `[${style}]` : ""} ${coordinates}${cycle ? " -- cycle" : ""};`;
}

function formatPoint(point) {
  return `(${formatNumber(point.x)},${formatNumber(point.y)})`;
}

function formatNumber(value) {
  const rounded = Math.round((value + Number.EPSILON) * 1e9) / 1e9;
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

function nonZeroOption(value) {
  return value !== undefined && Math.abs(evaluateMath(String(value))) > 1e-12;
}

function findStatementEnd(source, start) {
  let brace = 0;
  let bracket = 0;
  let paren = 0;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (character === "{") brace += 1;
    else if (character === "}") brace = Math.max(0, brace - 1);
    else if (character === "[") bracket += 1;
    else if (character === "]") bracket = Math.max(0, bracket - 1);
    else if (character === "(") paren += 1;
    else if (character === ")") paren = Math.max(0, paren - 1);
    else if (character === ";" && brace === 0 && bracket === 0 && paren === 0) return index;
  }
  return -1;
}

function readBalanced(source, start, open, close) {
  if (source[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === open) depth += 1;
    else if (source[index] === close) {
      depth -= 1;
      if (depth === 0) return { content: source.slice(start + 1, index), end: index + 1 };
    }
  }
  return null;
}

function skipWhitespace(source, index) {
  let cursor = index;
  while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;
  return cursor;
}

function warn(diagnostics, message) {
  diagnostics.push({ severity: "warning", message });
}
