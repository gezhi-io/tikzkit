import { evaluateMath, roundNumber } from "../engine/math.js";
import { parseOptions, splitTopLevel } from "../engine/options.js";

const IMPLEMENTED_COMMANDS = [
  "usetkzobj",
  "tkzSetUpPoint",
  "tkzSetUpLine",
  "tkzDefPoint",
  "tkzDefPoints",
  "tkzDefLine",
  "tkzInterLL",
  "tkzGetPoint",
  "tkzDrawPoint",
  "tkzDrawPoints",
  "tkzDrawLine",
  "tkzDrawLines",
  "tkzDrawSegment",
  "tkzDrawSegments",
  "tkzDrawArc",
  "tkzDrawPolygon",
  "tkzMarkAngle",
  "tkzLabelAngle",
  "tkzLabelPoint",
  "tkzLabelLine",
  "tkzFillPolygon"
];

const DEFERRED_COMMANDS = new Map([
  ["tkzMarkSegments", ["optional", "paren"]]
]);

const TKZ_COMMANDS = new Set([...IMPLEMENTED_COMMANDS, ...DEFERRED_COMMANDS.keys()]);

export const tkzEuclideExtension = {
  name: "tkz-euclide",
  phase: "preprocess",
  description: "Expands a practical tkz-euclide point, line, angle, polygon, arc, intersection, and label subset into ordinary TikZ.",
  commands: IMPLEMENTED_COMMANDS,
  preprocess(source, context = {}) {
    return expandTkzEuclide(source, context.diagnostics || []);
  }
};

export function expandTkzEuclide(source, diagnostics = []) {
  const text = String(source || "");
  if (!usesTkzEuclide(text)) return text;
  return expandWithState(text, createState(), diagnostics);
}

function usesTkzEuclide(source) {
  return /\\usepackage(?:\[[^\]]*\])?\{[^{}]*\btkz-euclide\b[^{}]*\}/.test(source);
}

function createState() {
  return {
    points: new Map(),
    pointResult: null,
    pointStyle: {
      shape: "circle",
      size: "2",
      color: "black",
      fill: "black!10"
    },
    lineStyle: {
      lineWidth: "0.2pt",
      color: "black",
      style: "solid",
      addLeft: 0.2,
      addRight: 0.2
    },
    warned: new Set()
  };
}

function expandWithState(text, state, diagnostics) {
  let output = "";
  let index = 0;
  while (index < text.length) {
    const pictureBegin = "\\begin{tikzpicture}";
    if (text.startsWith(pictureBegin, index)) {
      state.points.clear();
      state.pointResult = null;
      output += pictureBegin;
      index += pictureBegin.length;
      continue;
    }
    if (text[index] !== "\\") {
      output += text[index];
      index += 1;
      continue;
    }
    const command = readCommandName(text, index + 1);
    if (!command || !TKZ_COMMANDS.has(command.value)) {
      output += command ? text.slice(index, command.end) : text[index];
      index = command ? command.end : index + 1;
      continue;
    }
    const expanded = DEFERRED_COMMANDS.has(command.value)
      ? consumeDeferredCommand(text, command.value, command.end, state, diagnostics)
      : expandCommand(text, command.value, command.end, state, diagnostics);
    if (!expanded) {
      output += text.slice(index, command.end);
      index = command.end;
      continue;
    }
    output += expanded.text;
    index = expanded.end;
  }
  return output;
}

function expandCommand(source, name, afterName, state, diagnostics) {
  if (name === "usetkzobj") {
    const group = parseRequiredArg(source, afterName);
    return group ? { text: "", end: group.end } : { text: "", end: afterName };
  }
  if (name === "tkzSetUpPoint") {
    const optional = parseOptionalArg(source, afterName);
    applyPointSetup(state, optional.content);
    return { text: "", end: optional.end };
  }
  if (name === "tkzSetUpLine") {
    const optional = parseOptionalArg(source, afterName);
    applyLineSetup(state, optional.content);
    return { text: "", end: optional.end };
  }
  if (name === "tkzDefPoints") return expandDefPoints(source, afterName, state, diagnostics);
  if (name === "tkzDefPoint") return expandDefPoint(source, afterName, state, diagnostics);
  if (name === "tkzDefLine") return expandDefLine(source, afterName, state, diagnostics);
  if (name === "tkzInterLL") return expandInterLL(source, afterName, state, diagnostics);
  if (name === "tkzGetPoint") return expandGetPoint(source, afterName, state, diagnostics);
  if (name === "tkzDrawPoint" || name === "tkzDrawPoints") {
    return expandDrawPoints(source, afterName, state, diagnostics, name === "tkzDrawPoint");
  }
  if (name === "tkzDrawLine" || name === "tkzDrawSegment") {
    return expandDrawPairs(source, afterName, state, diagnostics, name === "tkzDrawLine", true);
  }
  if (name === "tkzDrawLines" || name === "tkzDrawSegments") {
    return expandDrawPairs(source, afterName, state, diagnostics, name === "tkzDrawLines", false);
  }
  if (name === "tkzDrawArc") return expandDrawArc(source, afterName, state, diagnostics);
  if (name === "tkzDrawPolygon") return expandDrawPolygon(source, afterName, state, diagnostics);
  if (name === "tkzMarkAngle") return expandMarkAngle(source, afterName, state, diagnostics);
  if (name === "tkzLabelAngle") return expandLabelAngle(source, afterName, state, diagnostics);
  if (name === "tkzLabelPoint") return expandLabelPoint(source, afterName, diagnostics);
  if (name === "tkzLabelLine") return expandLabelLine(source, afterName, diagnostics);
  if (name === "tkzFillPolygon") return expandFillPolygon(source, afterName, diagnostics);
  return null;
}

function expandDefPoints(source, afterName, state, diagnostics) {
  const optional = parseOptionalArg(source, afterName);
  const group = parseRequiredArg(source, optional.end);
  if (!group) return malformed(diagnostics, "tkzDefPoints");
  const commands = [];
  for (const entry of splitTopLevel(group.content, ",")) {
    const parts = splitTopLevel(entry, "/");
    if (parts.length < 3) {
      warn(diagnostics, `Could not parse tkz-euclide point definition ${entry.trim()}`);
      continue;
    }
    const name = parts.slice(2).join("/").trim();
    const point = pointFromCoordinates(parts[0], parts[1]);
    if (!name || !point) continue;
    state.points.set(name, point);
    commands.push(`\\coordinate (${name}) at (${formatNumber(point.x)},${formatNumber(point.y)});`);
  }
  return { text: commands.join("\n"), end: group.end };
}

function expandDefPoint(source, afterName, state, diagnostics) {
  const optional = parseOptionalArg(source, afterName);
  const coordinate = parseParenthesizedArg(source, optional.end);
  const name = coordinate && parseRequiredArg(source, coordinate.end);
  if (!coordinate || !name) return malformed(diagnostics, "tkzDefPoint");
  const parts = splitTopLevel(coordinate.content, ",");
  if (parts.length !== 2) {
    warn(diagnostics, "tkz-euclide compatibility currently supports Cartesian tkzDefPoint coordinates only");
    return { text: "", end: name.end };
  }
  const pointName = name.content.trim();
  const point = pointFromCoordinates(parts[0], parts[1]);
  if (!pointName || !point) return { text: "", end: name.end };
  state.points.set(pointName, point);
  return {
    text: `\\coordinate (${pointName}) at (${formatNumber(point.x)},${formatNumber(point.y)});`,
    end: name.end
  };
}

function expandDefLine(source, afterName, state, diagnostics) {
  const optional = parseOptionalArg(source, afterName);
  const pair = parseParenthesizedArg(source, optional.end);
  if (!pair) return malformed(diagnostics, "tkzDefLine");
  const options = parseOptions(optional.content);
  const parallel = String(options.parallel || "").match(/^through\s+(.+)$/);
  const perpendicular = String(options.perpendicular || options.orthogonal || "").match(/^through\s+(.+)$/);
  const points = parsePointPair(pair.content);
  if ((!parallel && !perpendicular) || !points) {
    state.pointResult = null;
    warnOnce(
      state,
      diagnostics,
      "tkzDefLine",
      "tkz-euclide compatibility currently supports tkzDefLine[parallel=through P] and tkzDefLine[perpendicular=through P]"
    );
    return { text: "", end: pair.end };
  }
  const throughName = (parallel || perpendicular)[1].trim();
  const through = state.points.get(throughName);
  const first = state.points.get(points[0]);
  const second = state.points.get(points[1]);
  if (!first || !second) {
    state.pointResult = null;
    warn(diagnostics, `Could not resolve tkzDefLine points ${pair.content}`);
    return { text: "", end: pair.end };
  }
  const factor = numericOption(options.K, 1);
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const vector = perpendicular
    ? { x: -factor * dy, y: factor * dx }
    : { x: factor * dx, y: factor * dy };
  state.pointResult = through
    ? {
        x: roundNumber(through.x + vector.x, 10),
        y: roundNumber(through.y + vector.y, 10)
      }
    : {
        expression: `($(${throughName})+(${formatNumber(vector.x)},${formatNumber(vector.y)})$)`
      };
  return {
    text: `\\coordinate (tkzPointResult) at ${renderPointResultCoordinate(state.pointResult)};`,
    end: pair.end
  };
}

function expandInterLL(source, afterName, state, diagnostics) {
  const firstLine = parseParenthesizedArg(source, afterName);
  const secondLine = firstLine && parseParenthesizedArg(source, firstLine.end);
  if (!firstLine || !secondLine) return malformed(diagnostics, "tkzInterLL");
  const firstPair = parsePointPair(firstLine.content);
  const secondPair = parsePointPair(secondLine.content);
  const points = [...(firstPair || []), ...(secondPair || [])].map((name) => state.points.get(name));
  if (!firstPair || !secondPair || points.some((point) => !point)) {
    state.pointResult = null;
    warn(diagnostics, `Could not resolve tkzInterLL points (${firstLine.content})(${secondLine.content})`);
    return { text: "", end: secondLine.end };
  }
  state.pointResult = lineIntersection(points[0], points[1], points[2], points[3]);
  if (!state.pointResult) {
    warn(diagnostics, `tkzInterLL lines are parallel: (${firstLine.content}) and (${secondLine.content})`);
    return { text: "", end: secondLine.end };
  }
  return {
    text: `\\coordinate (tkzPointResult) at (${formatNumber(state.pointResult.x)},${formatNumber(state.pointResult.y)});`,
    end: secondLine.end
  };
}

function expandGetPoint(source, afterName, state, diagnostics) {
  const name = parseRequiredArg(source, afterName);
  if (!name) return malformed(diagnostics, "tkzGetPoint");
  const pointName = name.content.trim();
  if (!pointName || !state.pointResult) {
    warn(diagnostics, `tkzGetPoint could not resolve ${pointName || "an unnamed point"}`);
    return { text: "", end: name.end };
  }
  if (Number.isFinite(state.pointResult.x) && Number.isFinite(state.pointResult.y)) {
    state.points.set(pointName, { x: state.pointResult.x, y: state.pointResult.y });
  }
  return { text: `\\coordinate (${pointName}) at (tkzPointResult);`, end: name.end };
}

function expandDrawPoints(source, afterName, state, diagnostics, single) {
  const optional = parseOptionalArg(source, afterName);
  const list = parseParenthesizedArg(source, optional.end);
  if (!list) return malformed(diagnostics, single ? "tkzDrawPoint" : "tkzDrawPoints");
  const pointNames = single ? [list.content.trim()] : splitTopLevel(list.content, ",").map((name) => name.trim());
  const options = renderPointOptions(state, optional.content);
  return {
    text: pointNames.filter(Boolean).map((name) => `\\node[${options}] at (${name}) {};`).join("\n"),
    end: list.end
  };
}

function expandDrawPairs(source, afterName, state, diagnostics, extend, single) {
  const optional = parseOptionalArg(source, afterName);
  const list = parseParenthesizedArg(source, optional.end);
  if (!list) return malformed(diagnostics, extend ? "tkzDrawLine" : "tkzDrawSegment");
  const pairs = single ? [parsePointPair(list.content)] : parsePointPairs(list.content);
  const validPairs = pairs.filter(Boolean);
  if (!validPairs.length) {
    warn(diagnostics, `Could not parse tkz-euclide point pairs ${list.content}`);
    return { text: "", end: list.end };
  }
  const options = renderLineOptions(state, optional.content);
  const add = extend ? lineAdd(state, optional.content) : { left: 0, right: 0 };
  return {
    text: validPairs.map(([from, to]) => renderDrawPair(from, to, options, add)).join("\n"),
    end: list.end
  };
}

function expandDrawArc(source, afterName, state, diagnostics) {
  const optional = parseOptionalArg(source, afterName);
  const centerAndRadius = parseParenthesizedArg(source, optional.end);
  const angles = centerAndRadius && parseParenthesizedArg(source, centerAndRadius.end);
  if (!centerAndRadius || !angles) return malformed(diagnostics, "tkzDrawArc");

  const options = parseOptions(optional.content);
  const radiusParts = splitTopLevel(centerAndRadius.content, ",").map((part) => part.trim());
  const angleParts = splitTopLevel(angles.content, ",").map((part) => part.trim());
  const explicitRadius = options.R === true || optionParts(optional.content).some((part) => part.key === "R");
  if (!explicitRadius || radiusParts.length !== 2 || angleParts.length !== 2) {
    warnOnce(
      state,
      diagnostics,
      "tkzDrawArc",
      "tkz-euclide compatibility currently supports tkzDrawArc[R](center,radius)(start,end)"
    );
    return { text: "", end: angles.end };
  }

  const center = radiusParts[0];
  const radius = normalizeDimensionWhitespace(radiusParts[1]);
  const delta = numericOption(options.delta, 0);
  let start = numericOption(angleParts[0], Number.NaN);
  let end = numericOption(angleParts[1], Number.NaN);
  if (!center || !radius || !Number.isFinite(start) || !Number.isFinite(end)) {
    warn(diagnostics, `Could not parse tkzDrawArc[R] arguments (${centerAndRadius.content})(${angles.content})`);
    return { text: "", end: angles.end };
  }
  start -= delta;
  end += delta;
  if (options.reverse === true) [start, end] = [end, start];

  const drawOptions = renderArcOptions(optional.content);
  const startAngle = formatNumber(start);
  const endAngle = formatNumber(end);
  return {
    text: `\\draw[${drawOptions}] ($(${center})+(${startAngle}:${radius})$) arc (${startAngle}:${endAngle}:${radius});`,
    end: angles.end
  };
}

function expandDrawPolygon(source, afterName, state, diagnostics) {
  const optional = parseOptionalArg(source, afterName);
  const list = parseParenthesizedArg(source, optional.end);
  if (!list) return malformed(diagnostics, "tkzDrawPolygon");
  const points = splitTopLevel(list.content, ",").map((name) => name.trim()).filter(Boolean);
  if (points.length < 3) {
    warn(diagnostics, `Could not parse tkzDrawPolygon points ${list.content}`);
    return { text: "", end: list.end };
  }
  const options = renderLineOptions(state, optional.content);
  return {
    text: `\\draw[${options},line join=round] ${points.map((name) => `(${name})`).join(" -- ")} -- cycle;`,
    end: list.end
  };
}

function expandMarkAngle(source, afterName, state, diagnostics) {
  const optional = parseOptionalArg(source, afterName);
  const triple = parseParenthesizedArg(source, optional.end);
  const points = triple && parsePointTriple(triple.content);
  if (!triple || !points) return malformed(diagnostics, "tkzMarkAngle");
  const geometry = angleGeometry(points, state);
  if (!geometry) {
    warn(diagnostics, `Could not resolve tkzMarkAngle points ${triple.content}`);
    return { text: "", end: triple.end };
  }
  const options = parseOptions(optional.content);
  const arc = String(options.arc ?? "l").trim();
  const mark = String(options.mark ?? "none").trim();
  if (arc !== "l" || mark !== "none") {
    warnOnce(
      state,
      diagnostics,
      "tkzMarkAngle-variants",
      "tkz-euclide compatibility currently renders the single unmarked tkzMarkAngle arc"
    );
  }
  const radius = normalizeBareCoordinateDimension(options.size ?? "1");
  const drawOptions = optionParts(optional.content)
    .filter((part) => !["arc", "size", "mark", "mksize", "mkcolor", "mkpos", "fill"].includes(part.key))
    .map((part) => part.raw);
  drawOptions.push("fill=none");
  return {
    text: `\\draw[${drawOptions.join(",")}] ($(${geometry.centerName})+(${formatNumber(geometry.start)}:${radius})$) arc (${formatNumber(geometry.start)}:${formatNumber(geometry.end)}:${radius});`,
    end: triple.end
  };
}

function expandLabelAngle(source, afterName, state, diagnostics) {
  const optional = parseOptionalArg(source, afterName);
  const triple = parseParenthesizedArg(source, optional.end);
  const label = triple && parseRequiredArg(source, triple.end);
  const points = triple && parsePointTriple(triple.content);
  if (!triple || !label || !points) return malformed(diagnostics, "tkzLabelAngle");
  const geometry = angleGeometry(points, state);
  if (!geometry) {
    warn(diagnostics, `Could not resolve tkzLabelAngle points ${triple.content}`);
    return { text: "", end: label.end };
  }
  const options = parseOptions(optional.content);
  const angle = numericOption(options.angle, (geometry.start + geometry.end) / 2);
  const distance = normalizeBareCoordinateDimension(options.dist ?? "1");
  const nodeOptions = optionParts(optional.content)
    .filter((part) => !["angle", "dist"].includes(part.key))
    .map((part) => part.raw);
  return {
    text: `\\path (${geometry.centerName}) -- ($(${geometry.centerName})+(${formatNumber(angle)}:${distance})$) node[${nodeOptions.join(",")}] {${label.content}};`,
    end: label.end
  };
}

function expandLabelPoint(source, afterName, diagnostics) {
  const optional = parseOptionalArg(source, afterName);
  const point = parseParenthesizedArg(source, optional.end);
  const label = point && parseRequiredArg(source, point.end);
  if (!point || !label) return malformed(diagnostics, "tkzLabelPoint");
  const options = optional.content.trim() || "below";
  return {
    text: `\\node[${options}] at (${point.content.trim()}) {${label.content}};`,
    end: label.end
  };
}

function expandLabelLine(source, afterName, diagnostics) {
  const optional = parseOptionalArg(source, afterName);
  const pair = parseParenthesizedArg(source, optional.end);
  const label = pair && parseRequiredArg(source, pair.end);
  const points = pair && parsePointPair(pair.content);
  if (!pair || !label || !points) return malformed(diagnostics, "tkzLabelLine");
  return {
    text: `\\path (${points[0]}) -- node[${optional.content.trim()}] {${label.content}} (${points[1]});`,
    end: label.end
  };
}

function expandFillPolygon(source, afterName, diagnostics) {
  const optional = parseOptionalArg(source, afterName);
  const list = parseParenthesizedArg(source, optional.end);
  if (!list) return malformed(diagnostics, "tkzFillPolygon");
  const points = splitTopLevel(list.content, ",").map((name) => name.trim()).filter(Boolean);
  if (points.length < 3) {
    warn(diagnostics, `Could not parse tkzFillPolygon points ${list.content}`);
    return { text: "", end: list.end };
  }
  const options = renderFillOptions(optional.content);
  return {
    text: `\\fill${options ? `[${options}]` : ""} ${points.map((name) => `(${name})`).join(" -- ")} -- cycle;`,
    end: list.end
  };
}

function consumeDeferredCommand(source, name, afterName, state, diagnostics) {
  let end = afterName;
  for (const argument of DEFERRED_COMMANDS.get(name) || []) {
    const parsed = argument === "optional"
      ? parseOptionalArg(source, end)
      : argument === "paren"
        ? parseParenthesizedArg(source, end)
        : parseRequiredArg(source, end);
    if (!parsed) return malformed(diagnostics, name);
    end = parsed.end;
  }
  warnOnce(state, diagnostics, name, `tkz-euclide compatibility does not yet render \\${name}`);
  return { text: "", end };
}

function applyPointSetup(state, rawOptions) {
  const options = parseOptions(rawOptions);
  if (options.shape !== undefined) state.pointStyle.shape = String(options.shape).trim();
  if (options.size !== undefined) state.pointStyle.size = String(options.size).trim();
  if (options.color !== undefined) state.pointStyle.color = String(options.color).trim();
  if (options.fill !== undefined) state.pointStyle.fill = String(options.fill).trim();
}

function applyLineSetup(state, rawOptions) {
  const options = parseOptions(rawOptions);
  if (options["line width"] !== undefined) state.lineStyle.lineWidth = String(options["line width"]).trim();
  if (options.color !== undefined) state.lineStyle.color = String(options.color).trim();
  if (options.style !== undefined) state.lineStyle.style = String(options.style).trim();
  const add = parseAdd(options.add);
  if (add) {
    state.lineStyle.addLeft = add.left;
    state.lineStyle.addRight = add.right;
  }
}

function renderPointOptions(state, rawOptions) {
  const options = parseOptions(rawOptions);
  const shape = String(options.shape ?? state.pointStyle.shape).trim();
  const size = normalizeBarePointDimension(options.size ?? state.pointStyle.size);
  const color = String(options.color ?? options.draw ?? state.pointStyle.color).trim();
  const fill = String(options.fill ?? state.pointStyle.fill).trim();
  const extras = optionParts(rawOptions).filter((part) => !["shape", "size", "color", "draw", "fill"].includes(part.key));
  return [
    `draw=${color}`,
    `fill=${fill}`,
    `shape=${shape}`,
    `minimum size=${size}`,
    "inner sep=0pt",
    ...extras.map((part) => part.raw)
  ].filter(Boolean).join(",");
}

function renderLineOptions(state, rawOptions) {
  const options = parseOptions(rawOptions);
  const width = normalizeBarePointDimension(options["line width"] ?? state.lineStyle.lineWidth);
  const color = String(options.color ?? options.draw ?? state.lineStyle.color).trim();
  const style = String(options.style ?? state.lineStyle.style).trim();
  const extras = optionParts(rawOptions).filter((part) => !["line width", "color", "draw", "style", "add"].includes(part.key));
  return [
    `line width=${width}`,
    `draw=${color}`,
    style && style !== "solid" ? style : "",
    "line cap=round",
    ...extras.map((part) => part.raw)
  ].filter(Boolean).join(",");
}

function renderFillOptions(rawOptions) {
  const options = parseOptions(rawOptions);
  const color = options.fill ?? options.color;
  const extras = optionParts(rawOptions).filter((part) => !["fill", "color"].includes(part.key));
  return [color !== undefined ? `fill=${String(color).trim()}` : "", ...extras.map((part) => part.raw)].filter(Boolean).join(",");
}

function renderArcOptions(rawOptions) {
  const options = parseOptions(rawOptions);
  const width = normalizeBarePointDimension(options["line width"] ?? "0.2pt");
  const color = String(options.color ?? options.draw ?? "black").trim();
  const extras = optionParts(rawOptions).filter(
    (part) => !["R", "type", "delta", "reverse", "line width", "color", "draw"].includes(part.key)
  );
  return [
    `line width=${width}`,
    `draw=${color}`,
    ...extras.map((part) => part.raw)
  ].filter(Boolean).join(",");
}

function lineAdd(state, rawOptions) {
  return parseAdd(parseOptions(rawOptions).add) || {
    left: state.lineStyle.addLeft,
    right: state.lineStyle.addRight
  };
}

function parseAdd(value) {
  if (value === undefined || value === null || value === true) return null;
  const text = String(value).trim().replace(/^\{([\s\S]*)\}$/, "$1");
  const match = text.match(/^(.+?)\s+and\s+(.+)$/);
  if (!match) return null;
  return {
    left: numericOption(match[1], 0),
    right: numericOption(match[2], 0)
  };
}

function renderDrawPair(from, to, options, add) {
  const start = extendedCoordinate(from, to, add.left);
  const end = extendedCoordinate(to, from, add.right);
  return `\\draw[${options}] ${start} -- ${end};`;
}

function extendedCoordinate(origin, other, amount) {
  if (!Number.isFinite(amount) || Math.abs(amount) < 1e-12) return `(${origin})`;
  return `($(${origin})!-${formatNumber(amount)}!(${other})$)`;
}

function parsePointPairs(content) {
  return splitTopLevelWhitespace(content).map(parsePointPair).filter(Boolean);
}

function parsePointPair(content) {
  const parts = splitTopLevel(String(content || ""), ",").map((part) => part.trim()).filter(Boolean);
  return parts.length === 2 ? parts : null;
}

function parsePointTriple(content) {
  const parts = splitTopLevel(String(content || ""), ",").map((part) => part.trim()).filter(Boolean);
  return parts.length === 3 ? parts : null;
}

function angleGeometry(names, state) {
  const [firstName, centerName, lastName] = names;
  const first = state.points.get(firstName);
  const center = state.points.get(centerName);
  const last = state.points.get(lastName);
  if (!first || !center || !last) return null;
  let start = (Math.atan2(first.y - center.y, first.x - center.x) * 180) / Math.PI;
  let end = (Math.atan2(last.y - center.y, last.x - center.x) * 180) / Math.PI;
  if (start > 0 && start > end) start -= 360;
  else if (start <= 0 && start > end) end += 360;
  return {
    centerName,
    start: roundNumber(start, 10),
    end: roundNumber(end, 10)
  };
}

function splitTopLevelWhitespace(input) {
  const parts = [];
  let current = "";
  let brace = 0;
  let bracket = 0;
  let paren = 0;
  for (const char of String(input || "")) {
    if (char === "{") brace += 1;
    if (char === "}") brace = Math.max(0, brace - 1);
    if (char === "[") bracket += 1;
    if (char === "]") bracket = Math.max(0, bracket - 1);
    if (char === "(") paren += 1;
    if (char === ")") paren = Math.max(0, paren - 1);
    if (/\s/.test(char) && brace === 0 && bracket === 0 && paren === 0) {
      if (current.trim()) parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function optionParts(rawOptions) {
  return splitTopLevel(String(rawOptions || ""), ",")
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => ({ raw, key: raw.split("=", 1)[0].trim() }));
}

function pointFromCoordinates(xRaw, yRaw) {
  const x = evaluateMath(String(xRaw).trim());
  const y = evaluateMath(String(yRaw).trim());
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: roundNumber(x, 10), y: roundNumber(y, 10) };
}

function renderPointResultCoordinate(result) {
  if (result?.expression) return result.expression;
  return `(${formatNumber(result.x)},${formatNumber(result.y)})`;
}

function lineIntersection(a, b, c, d) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const cdx = d.x - c.x;
  const cdy = d.y - c.y;
  const denominator = abx * cdy - aby * cdx;
  if (Math.abs(denominator) < 1e-12) return null;
  const acx = c.x - a.x;
  const acy = c.y - a.y;
  const amount = (acx * cdy - acy * cdx) / denominator;
  return {
    x: roundNumber(a.x + amount * abx, 10),
    y: roundNumber(a.y + amount * aby, 10)
  };
}

function numericOption(value, fallback) {
  if (value === undefined || value === null || value === true || String(value).trim() === "") return fallback;
  const number = evaluateMath(String(value).trim());
  return Number.isFinite(number) ? number : fallback;
}

function normalizeBarePointDimension(value) {
  const text = String(value ?? "").trim();
  return /^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(text) ? `${text}pt` : text;
}

function normalizeBareCoordinateDimension(value) {
  const text = String(value ?? "").trim();
  return /^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(text) ? `${text}cm` : normalizeDimensionWhitespace(text);
}

function normalizeDimensionWhitespace(value) {
  return String(value ?? "").trim().replace(/\s+(?=[A-Za-z])/g, "");
}

function formatNumber(value) {
  return String(roundNumber(Number(value), 10));
}

function parseOptionalArg(source, start) {
  const index = skipWhitespace(source, start);
  if (source[index] !== "[") return { content: "", end: start };
  return extractBalanced(source, index, "[", "]");
}

function parseParenthesizedArg(source, start) {
  const index = skipWhitespace(source, start);
  if (source[index] !== "(") return null;
  return extractBalanced(source, index, "(", ")");
}

function parseRequiredArg(source, start) {
  const index = skipWhitespace(source, start);
  if (source[index] !== "{") return null;
  return extractBalanced(source, index, "{", "}");
}

function extractBalanced(source, start, open, close) {
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === "\\") {
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

function readCommandName(source, start) {
  let end = start;
  while (end < source.length && /[A-Za-z@]/.test(source[end])) end += 1;
  if (end === start) return null;
  return { value: source.slice(start, end), end };
}

function skipWhitespace(source, start) {
  let index = start;
  while (index < source.length && /\s/.test(source[index])) index += 1;
  return index;
}

function malformed(diagnostics, name) {
  warn(diagnostics, `Could not parse tkz-euclide command \\${name}`);
  return null;
}

function warnOnce(state, diagnostics, key, message) {
  if (state.warned.has(key)) return;
  state.warned.add(key);
  warn(diagnostics, message);
}

function warn(diagnostics, message) {
  diagnostics.push({ severity: "warning", message });
}
