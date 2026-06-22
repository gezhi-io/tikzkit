export const tikzPalatticeExtension = {
  name: "tikz-palattice",
  phase: "preprocess",
  description: "Expands practical tikz-palattice lattice environments into ordinary TikZ paths and labels.",
  commands: [
    "lattice",
    "drift",
    "dipole",
    "quadrupole",
    "sextupole",
    "kicker",
    "corrector",
    "cavity",
    "solenoid",
    "source",
    "screen",
    "valve",
    "marker",
    "legend",
    "completelegend"
  ],
  preprocess(source, context = {}) {
    return expandTikzPalattice(String(source), context.diagnostics || []);
  }
};

const ELEMENTS = new Map([
  ["quadrupole", { color: "yellow", height: 0.5 }],
  ["sextupole", { color: "violet!70!black", height: 0.3 }],
  ["kicker", { color: "red!90!black", height: 0.25 }],
  ["corrector", { color: "orange!90!black", height: 0.25 }],
  ["cavity", { color: "brown!80!black", height: 0.45 }],
  ["solenoid", { color: "green!70!black", height: 0.2 }],
  ["beamdump", { color: "gray", height: 0.5 }],
  ["valve", { color: "gray", height: 0.15 }],
  ["source", { color: "gray", height: 0.5 }]
]);

const LEGEND_TEXT = {
  dipole: "Dipole",
  quadrupole: "Quadrupole",
  sextupole: "Sextupole",
  corrector: "Corrector",
  kicker: "Kicker",
  cavity: "Cavity",
  solenoid: "Solenoid",
  source: "Source",
  screen: "Screen",
  valve: "Valve"
};

const LEGEND_ORDER = ["dipole", "quadrupole", "sextupole", "corrector", "kicker", "cavity", "solenoid", "source", "screen", "valve"];

export function expandTikzPalattice(source, diagnostics = []) {
  if (!usesTikzPalattice(source)) return source;
  return expandLatticeEnvironments(source, diagnostics);
}

function usesTikzPalattice(source) {
  return /\\usepackage(?:\[[^\]]*\])?\{tikz-palattice\}|\\begin\{lattice\}/.test(source);
}

function expandLatticeEnvironments(source, diagnostics) {
  let output = "";
  let index = 0;
  while (index < source.length) {
    const begin = source.indexOf("\\begin{lattice}", index);
    if (begin === -1) {
      output += source.slice(index);
      break;
    }
    output += source.slice(index, begin);
    const parsedBegin = parseLatticeBegin(source, begin);
    const end = findMatchingEnvironmentEnd(source, parsedBegin.end, "lattice");
    if (end === -1) {
      diagnostics.push({ severity: "warning", message: "Malformed lattice environment" });
      output += source.slice(begin);
      break;
    }
    const body = source.slice(parsedBegin.end, end);
    const rendered = renderLattice(body, parsedBegin.scale, parsedBegin.options, diagnostics);
    output += rendered;
    index = end + "\\end{lattice}".length;
  }
  return output;
}

function parseLatticeBegin(source, start) {
  let cursor = start + "\\begin{lattice}".length;
  cursor = skipWhitespace(source, cursor);
  const scale = readOptional(source, cursor, "[", "]");
  cursor = scale ? skipWhitespace(source, scale.end) : cursor;
  const options = readOptional(source, cursor, "[", "]");
  cursor = options ? skipWhitespace(source, options.end) : cursor;
  return {
    scale: finiteNumber(scale?.content, 1),
    options: options?.content || "",
    end: cursor
  };
}

function renderLattice(body, scale, options, diagnostics) {
  const state = {
    scale,
    unit: 2 * scale,
    x: 0,
    y: 0,
    angle: 0,
    index: 0,
    labelSide: -1,
    labelDistance: 0.35 * 2 * scale,
    labelRotation: 0,
    saved: new Map(),
    lastCenter: { x: 0, y: 0 },
    lastEast: { x: 0, y: 0 },
    seen: new Set(),
    elementColors: new Map(),
    lineColors: new Map(),
    legendText: { ...LEGEND_TEXT },
    customLegend: []
  };
  const generated = [];
  parseLatticeCommands(body, state, generated, diagnostics);
  const pictureOptions = options ? `[${options}]` : "";
  return `\\begin{tikzpicture}${pictureOptions}\n${generated.join("\n")}\n\\end{tikzpicture}`;
}

function parseLatticeCommands(body, state, generated, diagnostics) {
  let index = 0;
  while (index < body.length) {
    if (body[index] !== "\\") {
      index += 1;
      continue;
    }
    const command = readCommandName(body, index);
    if (!command) {
      index += 1;
      continue;
    }
    const parsed = parseKnownCommand(body, index, command, state, generated, diagnostics);
    index = parsed?.end ?? index + command.length + 1;
  }
}

function parseKnownCommand(source, start, command, state, generated, diagnostics) {
  switch (command) {
    case "drift":
      return parseDrift(source, start, state, generated);
    case "dipole":
      return parseDipole(source, start, state, generated);
    case "quadrupole":
    case "sextupole":
    case "kicker":
    case "corrector":
    case "cavity":
    case "solenoid":
    case "beamdump":
    case "source":
      return parseRectangleElement(source, start, command, state, generated);
    case "screen":
      return parseScreen(source, start, state, generated);
    case "valve":
      return parseValve(source, start, state, generated);
    case "marker":
      return parseMarker(source, start, state, generated);
    case "rotate":
      return parseAngleCommand(source, start, state, "add");
    case "setangle":
      return parseAngleCommand(source, start, state, "set");
    case "northlabels":
      state.labelSide = 1;
      return { end: start + command.length + 1 };
    case "southlabels":
      state.labelSide = -1;
      return { end: start + command.length + 1 };
    case "turnlabels":
      state.labelSide *= -1;
      return { end: start + command.length + 1 };
    case "setlabeldistance":
      return parseSetLabelDistance(source, start, state);
    case "rotatelabels":
      return parseRotateLabels(source, start, state);
    case "setelementcolor":
      return parseSetElementColor(source, start, state);
    case "resetelementcolor":
      return parseResetElementColor(source, start, state);
    case "setlinecolor":
      return parseSetLineColor(source, start, state);
    case "resetlinecolor":
      return parseResetLineColor(source, start, state);
    case "setlegendtext":
      return parseSetLegendText(source, start, state);
    case "addlegendentry":
      return parseAddLegendEntry(source, start, state);
    case "legend":
      return parseLegend(source, start, state, generated, false);
    case "completelegend":
      return parseLegend(source, start, state, generated, true);
    case "drawrule":
      return parseDrawRule(source, start, state, generated);
    case "savecoordinate":
      return parseSaveCoordinate(source, start, state, generated);
    case "goto":
      return parseGoto(source, start, state);
    case "start":
      return parseStart(source, start, state, generated);
    default:
      if (["setlabelfont", "setlabelcolor", "resetlabeldistance"].includes(command)) {
        return consumeSimpleCommand(source, start, command);
      }
      return null;
  }
}

function parseDrift(source, start, state, generated) {
  const args = readArguments(source, start, "drift", 1, 1);
  if (!args) return null;
  const length = finiteNumber(args.required[0], 0);
  const label = args.optional[0] || "";
  const from = point(state);
  const to = advance(state, length, 0);
  generated.push(drawLine(from, to, driftOptions(state)));
  if (label) generated.push(labelNode(midpoint(from, to), label, state));
  return { end: args.end };
}

function parseRectangleElement(source, start, command, state, generated) {
  const args = readArguments(source, start, command, 2, 1);
  if (!args) return null;
  const name = args.required[0];
  const length = finiteNumber(args.required[1], 0.1);
  const config = ELEMENTS.get(command) || { color: "gray", height: 0.3 };
  const height = finiteNumber(args.optional[0], config.height) * state.unit;
  const from = point(state);
  const to = advance(state, length, 0);
  const center = midpoint(from, to);
  generated.push(drawLine(from, to, driftOptions(state)));
  if (command === "source") generated.push(drawSource(from, to, height, elementOptions(command, config.color, state)));
  else generated.push(drawRectangle(from, to, height, elementOptions(command, config.color, state)));
  generated.push(labelNode(center, name, state));
  state.seen.add(command);
  return { end: args.end };
}

function parseDipole(source, start, state, generated) {
  const args = readArguments(source, start, "dipole", 3, 2);
  if (!args) return null;
  const name = args.required[0];
  const length = finiteNumber(args.required[1], 0.1);
  const bend = finiteNumber(args.required[2], 0);
  const height = finiteNumber(args.optional[1], 0.6) * state.unit;
  const from = point(state);
  const travelAngle = state.angle + bend / 2;
  const to = advance(state, length, bend);
  const center = midpoint(from, to);
  generated.push(drawLine(from, to, driftOptions(state)));
  generated.push(drawRectangle(from, to, height, elementOptions("dipole", "blue", state), travelAngle));
  generated.push(labelNode(center, name, state));
  state.seen.add("dipole");
  return { end: args.end };
}

function parseScreen(source, start, state, generated) {
  const args = readArguments(source, start, "screen", 1, 1);
  if (!args) return null;
  const name = args.required[0];
  const length = finiteNumber(args.optional[0], 0.2);
  const from = point(state);
  const to = advance(state, length, 0);
  const center = midpoint(from, to);
  const radius = Math.max(0.05, (length * state.unit) / 2);
  generated.push(drawLine(from, to, driftOptions(state)));
  generated.push(`\\draw[${elementOptions("screen", "white", state)}] (${fmt(center.x)},${fmt(center.y)}) circle (${fmt(radius)});`);
  generated.push(drawLine(center, add(center, vector(state.angle + 45, radius)), elementOptions("screen", "white", state)));
  generated.push(drawLine(center, add(center, vector(state.angle + 225, radius)), elementOptions("screen", "white", state)));
  generated.push(labelNode(center, name, state));
  state.seen.add("screen");
  return { end: args.end };
}

function parseValve(source, start, state, generated) {
  const args = readArguments(source, start, "valve", 1, 1);
  if (!args) return null;
  const name = args.required[0];
  const length = finiteNumber(args.optional[0], 0.01);
  const from = point(state);
  const to = advance(state, length, 0);
  const center = midpoint(from, to);
  generated.push(drawLine(from, to, driftOptions(state)));
  generated.push(drawRectangle(from, to, 0.15 * state.unit, valveOptions(state)));
  generated.push(labelNode(center, name, state));
  state.seen.add("valve");
  return { end: args.end };
}

function parseMarker(source, start, state, generated) {
  const args = readArguments(source, start, "marker", 1, 1);
  if (!args) return null;
  const name = args.required[0];
  const len = finiteNumber(args.optional[0], 0.35) * state.unit;
  const p = point(state);
  generated.push(drawLine(p, add(p, vector(state.angle - 90, len)), markerOptions(state)));
  generated.push(drawLine(p, add(p, vector(state.angle + 90, len)), markerOptions(state)));
  generated.push(labelNodeAt(add(p, vector(state.angle - state.labelSide * 90, len + state.labelDistance * 0.5)), name, state, labelAnchor(state, true)));
  state.seen.add("marker");
  return { end: args.end };
}

function parseAngleCommand(source, start, state, mode) {
  const args = readArguments(source, start, mode === "add" ? "rotate" : "setangle", 1, 0);
  if (!args) return null;
  const value = finiteNumber(args.required[0], 0);
  state.angle = mode === "add" ? state.angle + value : value;
  return { end: args.end };
}

function parseSetLabelDistance(source, start, state) {
  const args = readArguments(source, start, "setlabeldistance", 1, 0);
  if (!args) return null;
  state.labelDistance = finiteNumber(args.required[0], 0.35) * state.unit;
  return { end: args.end };
}

function parseRotateLabels(source, start, state) {
  const args = readArguments(source, start, "rotatelabels", 1, 1);
  if (!args) return null;
  state.labelRotation = finiteNumber(args.required[0], 0);
  return { end: args.end };
}

function parseSetElementColor(source, start, state) {
  const args = readArguments(source, start, "setelementcolor", 2, 1);
  if (!args) return null;
  state.elementColors.set(args.required[0], args.optional[0] || args.required[1]);
  return { end: args.end };
}

function parseResetElementColor(source, start, state) {
  const args = readArguments(source, start, "resetelementcolor", 1, 0);
  if (!args) return null;
  state.elementColors.delete(args.required[0]);
  return { end: args.end };
}

function parseSetLineColor(source, start, state) {
  const args = readArguments(source, start, "setlinecolor", 2, 0);
  if (!args) return null;
  state.lineColors.set(args.required[0], args.required[1]);
  return { end: args.end };
}

function parseResetLineColor(source, start, state) {
  const args = readArguments(source, start, "resetlinecolor", 1, 0);
  if (!args) return null;
  state.lineColors.delete(args.required[0]);
  return { end: args.end };
}

function parseSetLegendText(source, start, state) {
  const args = readArguments(source, start, "setlegendtext", 2, 0);
  if (!args) return null;
  state.legendText[args.required[0]] = args.required[1];
  return { end: args.end };
}

function parseAddLegendEntry(source, start, state) {
  const args = readArguments(source, start, "addlegendentry", 2, 0);
  if (!args) return null;
  state.customLegend.push({ name: args.required[0], style: args.required[1] });
  return { end: args.end };
}

function parseLegend(source, start, state, generated, complete) {
  const command = complete ? "completelegend" : "legend";
  const args = readArguments(source, start, command, 1, 1);
  if (!args) return null;
  const parsedOrigin = parseCoordinate(args.required[0]);
  const origin = parsedOrigin ? scalePoint(parsedOrigin, state.unit) : { x: state.x, y: state.y - 1.5 * state.unit };
  const scale = finiteNumber(args.optional[0], 1);
  const keys = complete
    ? LEGEND_ORDER
    : LEGEND_ORDER.filter((key) => state.seen.has(key) && key !== "marker" && key !== "beamdump");
  const iconWidth = 0.4 * scale;
  const iconHeight = 0.3 * scale;
  const rowStep = 0.48 * scale;
  const textX = origin.x + 0.5 * scale;
  const frameLeft = origin.x - 0.32 * scale;
  const frameTop = origin.y + 0.18 * scale;
  const frameRight = origin.x + 2.25 * scale;
  let y = origin.y - iconHeight / 2;
  for (const key of keys) {
    generated.push(legendIcon(key, { x: origin.x, y }, iconWidth, iconHeight, state));
    generated.push(`\\node[anchor=west,font=\\normalsize] at (${fmt(textX)},${fmt(y)}) {${state.legendText[key] || key}};`);
    y -= rowStep;
  }
  for (const entry of state.customLegend) {
    const style = entry.style || "fill=white";
    generated.push(legendRectangle({ x: origin.x, y }, iconWidth, iconHeight, `draw,${style},palattice legend custom`));
    generated.push(`\\node[anchor=west,font=\\normalsize] at (${fmt(textX)},${fmt(y)}) {${entry.name}};`);
    y -= rowStep;
  }
  const frameBottom = y + rowStep - iconHeight / 2 - 0.18 * scale;
  generated.push(
    `\\draw[draw=black,fill=none,line width=0.4pt,rounded corners=2pt,palattice legend frame] (${fmt(frameLeft)},${fmt(frameBottom)}) rectangle (${fmt(frameRight)},${fmt(frameTop)});`
  );
  return { end: args.end };
}

function parseDrawRule(source, start, state, generated) {
  const args = readArguments(source, start, "drawrule", 1, 3);
  if (!args) return null;
  const origin = parseCoordinate(args.required[0]) || point(state);
  const step = finiteNumber(args.optional[0], 1);
  const labelsScale = finiteNumber(args.optional[1], 1);
  const height = finiteNumber(args.optional[2], 0.06);
  for (let index = 0; index < 3; index += 1) {
    const x0 = origin.x + index * step * state.unit;
    const x1 = origin.x + (index + 1) * step * state.unit;
    const fill = index % 2 === 0 ? "black" : "white";
    generated.push(`\\draw[draw=black,fill=${fill},palattice rule] (${fmt(x0)},${fmt(origin.y)}) rectangle (${fmt(x1)},${fmt(origin.y + height)});`);
    generated.push(`\\node[font=\\scriptsize,scale=${fmt(labelsScale)}] at (${fmt(x0)},${fmt(origin.y - 0.22)}) {${fmt(index * step)} m};`);
  }
  generated.push(`\\node[font=\\scriptsize,scale=${fmt(labelsScale)}] at (${fmt(origin.x + 3 * step * state.unit)},${fmt(origin.y - 0.22)}) {${fmt(3 * step)} m};`);
  return { end: args.end };
}

function parseSaveCoordinate(source, start, state, generated) {
  const args = readArguments(source, start, "savecoordinate", 1, 1);
  if (!args) return null;
  const pointToSave = args.optional[0] === "center" ? state.lastCenter : state.lastEast;
  state.saved.set(args.required[0], { ...pointToSave, angle: state.angle });
  generated.push(`\\coordinate (${args.required[0]}) at (${fmt(pointToSave.x)},${fmt(pointToSave.y)});`);
  return { end: args.end };
}

function parseGoto(source, start, state) {
  const args = readArguments(source, start, "goto", 1, 0);
  if (!args) return null;
  const saved = state.saved.get(args.required[0]);
  if (saved) {
    state.x = saved.x;
    state.y = saved.y;
    state.angle = saved.angle;
  }
  return { end: args.end };
}

function parseStart(source, start, state, generated) {
  const args = readArguments(source, start, "start", 1, 0);
  if (!args) return null;
  const coord = parseCoordinate(args.required[0]);
  if (coord) {
    state.x = coord.x;
    state.y = coord.y;
    state.lastCenter = { ...coord };
    state.lastEast = { ...coord };
    generated.push(`\\coordinate (east0) at (${fmt(coord.x)},${fmt(coord.y)});`);
  }
  return { end: args.end };
}

function consumeSimpleCommand(source, start, command) {
  let cursor = start + command.length + 1;
  cursor = skipWhitespace(source, cursor);
  while (source[cursor] === "{" || source[cursor] === "[") {
    const balanced = extractBalanced(source, cursor, source[cursor], source[cursor] === "{" ? "}" : "]");
    if (!balanced) break;
    cursor = skipWhitespace(source, balanced.end);
  }
  return { end: cursor };
}

function advance(state, length, bend = 0) {
  const from = point(state);
  const travel = state.angle + bend / 2;
  const distance = length * state.unit;
  const to = add(from, vector(travel, distance));
  state.x = to.x;
  state.y = to.y;
  state.angle += bend;
  state.index += 1;
  state.lastCenter = midpoint(from, to);
  state.lastEast = to;
  return to;
}

function drawLine(from, to, options) {
  return `\\draw[${options}] (${fmt(from.x)},${fmt(from.y)}) -- (${fmt(to.x)},${fmt(to.y)});`;
}

function drawRectangle(from, to, height, options, angleOverride = null) {
  const angle = angleOverride ?? angleBetween(from, to);
  const normal = vector(angle + 90, height / 2);
  const p1 = add(from, normal);
  const p2 = add(to, normal);
  const p3 = add(to, scalePoint(normal, -1));
  const p4 = add(from, scalePoint(normal, -1));
  return `\\draw[${options}] (${fmt(p1.x)},${fmt(p1.y)}) -- (${fmt(p2.x)},${fmt(p2.y)}) -- (${fmt(p3.x)},${fmt(p3.y)}) -- (${fmt(p4.x)},${fmt(p4.y)}) -- cycle;`;
}

function drawSource(from, to, height, options) {
  const angle = angleBetween(from, to);
  const normal = vector(angle + 90, height / 2);
  const p1 = add(from, normal);
  const p2 = to;
  const p3 = add(from, scalePoint(normal, -1));
  return `\\draw[${options}] (${fmt(p1.x)},${fmt(p1.y)}) -- (${fmt(p2.x)},${fmt(p2.y)}) -- (${fmt(p3.x)},${fmt(p3.y)}) -- cycle;`;
}

function labelNode(center, text, state) {
  const offset = add(center, vector(state.angle + state.labelSide * 90, state.labelDistance));
  return labelNodeAt(offset, text, state, labelAnchor(state, false));
}

function labelNodeAt(pointValue, text, state, anchor = "center") {
  const rotate = state.labelRotation ? `,rotate=${fmt(state.labelRotation)}` : "";
  return `\\node[font=\\normalsize,anchor=${anchor}${rotate},palattice label] at (${fmt(pointValue.x)},${fmt(pointValue.y)}) {${text}};`;
}

function labelAnchor(state, marker = false) {
  const angle = normalizeAngle(state.angle);
  const positiveSide = state.labelSide > 0;
  if (marker) return positiveSide ? anchorForNegativeMarker(angle) : anchorForPositiveMarker(angle);
  return positiveSide ? anchorForNorthLabel(angle) : anchorForSouthLabel(angle);
}

function anchorForSouthLabel(angle) {
  if (angle > 330) return "north";
  if (angle > 210) return "east";
  if (angle > 150) return "south";
  if (angle > 30) return "west";
  return "north";
}

function anchorForNorthLabel(angle) {
  if (angle > 330) return "south";
  if (angle > 210) return "west";
  if (angle > 150) return "north";
  if (angle > 30) return "east";
  return "south";
}

function anchorForPositiveMarker(angle) {
  if (angle > 330) return "south";
  if (angle > 210) return "west";
  if (angle > 150) return "north";
  if (angle > 30) return "east";
  return "south";
}

function anchorForNegativeMarker(angle) {
  if (angle > 330) return "north";
  if (angle > 210) return "east";
  if (angle > 150) return "south";
  if (angle > 30) return "west";
  return "north";
}

function normalizeAngle(angle) {
  let normalized = Number(angle) || 0;
  while (normalized < 0) normalized += 360;
  while (normalized > 360) normalized -= 360;
  return normalized;
}

function driftOptions(state) {
  const color = state.lineColors.get("drift");
  return ["draw", color || "", "line width=0.8pt", "palattice drift"].filter(Boolean).join(",");
}

function markerOptions(state) {
  const color = state.lineColors.get("marker") || "red";
  return ["draw", color, "densely dashed", "palattice marker"].join(",");
}

function elementOptions(kind, fallbackColor, state) {
  const color = defaultColor(kind, state) || fallbackColor;
  return ["draw=black", "top color=white", `bottom color=${color}`, "line width=0.8pt", `palattice ${kind}`].join(",");
}

function valveOptions(state) {
  const color = defaultColor("valve", state) || "gray";
  return ["draw=none", `top color=${color}`, `bottom color=${color}`, "line width=0.8pt", "palattice valve"].join(",");
}

function legendIcon(kind, center, width, height, state) {
  if (kind === "source") return legendSource(center, width, height, legendElementOptions(kind, state));
  if (kind === "screen") return legendScreen(center, Math.min(width, height) / 2, legendElementOptions(kind, state));
  if (kind === "valve") return legendValve(center, width);
  return legendRectangle(center, width, height, legendElementOptions(kind, state));
}

function legendElementOptions(kind, state) {
  return elementOptions(kind, defaultColor(kind, state), state)
    .replace("line width=0.8pt", "line width=0.4pt")
    .replace(`palattice ${kind}`, `palattice legend ${kind}`);
}

function legendRectangle(center, width, height, options) {
  const left = center.x - width / 2;
  const right = center.x + width / 2;
  const top = center.y + height / 2;
  const bottom = center.y - height / 2;
  return `\\draw[${options}] (${fmt(left)},${fmt(top)}) -- (${fmt(right)},${fmt(top)}) -- (${fmt(right)},${fmt(bottom)}) -- (${fmt(left)},${fmt(bottom)}) -- cycle;`;
}

function legendSource(center, width, height, options) {
  const left = center.x - width / 2;
  const right = center.x + width / 2;
  const top = center.y + height / 2;
  const bottom = center.y - height / 2;
  return `\\draw[${options}] (${fmt(left)},${fmt(top)}) -- (${fmt(right)},${fmt(top)}) -- (${fmt(center.x)},${fmt(bottom)}) -- cycle;`;
}

function legendScreen(center, radius, options) {
  const slash = radius * 0.7071;
  return [
    `\\draw[${options}] (${fmt(center.x)},${fmt(center.y)}) circle (${fmt(radius)});`,
    `\\draw[${options}] (${fmt(center.x - slash)},${fmt(center.y - slash)}) -- (${fmt(center.x + slash)},${fmt(center.y + slash)});`
  ].join("\n");
}

function legendValve(center, width) {
  const half = width * 0.42;
  return `\\draw[draw=gray,fill=none,line width=0.4pt,palattice legend valve] (${fmt(center.x - half)},${fmt(center.y)}) -- (${fmt(center.x + half)},${fmt(center.y)});`;
}

function defaultColor(kind, state) {
  if (state.elementColors.has(kind)) return state.elementColors.get(kind);
  if (kind === "dipole") return "blue";
  return ELEMENTS.get(kind)?.color || "white";
}

function readArguments(source, start, command, requiredCount, optionalCount) {
  let cursor = skipWhitespace(source, start + command.length + 1);
  const required = [];
  const optional = [];
  for (let index = 0; index < requiredCount; index += 1) {
    const arg = extractBalanced(source, cursor, "{", "}");
    if (!arg) return null;
    required.push(arg.content.trim());
    cursor = skipWhitespace(source, arg.end);
  }
  for (let index = 0; index < optionalCount; index += 1) {
    const arg = readOptional(source, cursor, "[", "]");
    if (!arg) break;
    optional.push(arg.content.trim());
    cursor = skipWhitespace(source, arg.end);
  }
  return { required, optional, end: cursor };
}

function readOptional(source, start, open, close) {
  if (source[start] !== open) return null;
  return extractBalanced(source, start, open, close);
}

function extractBalanced(text, start, open, close) {
  if (text[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (char === open) depth += 1;
    if (char === close) depth -= 1;
    if (depth === 0) return { content: text.slice(start + 1, index), start, end: index + 1 };
  }
  return null;
}

function findMatchingEnvironmentEnd(source, start, name) {
  const open = `\\begin{${name}}`;
  const close = `\\end{${name}}`;
  let depth = 1;
  let index = start;
  while (index < source.length) {
    const nextOpen = source.indexOf(open, index);
    const nextClose = source.indexOf(close, index);
    if (nextClose === -1) return -1;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      index = nextOpen + open.length;
    } else {
      depth -= 1;
      if (depth === 0) return nextClose;
      index = nextClose + close.length;
    }
  }
  return -1;
}

function readCommandName(source, start) {
  let index = start + 1;
  while (index < source.length && /[A-Za-z@]/.test(source[index])) index += 1;
  return source.slice(start + 1, index);
}

function parseCoordinate(text) {
  const clean = String(text || "").trim().replace(/^\(/, "").replace(/\)$/, "");
  const parts = clean.split(",").map((part) => finiteNumber(part.trim(), NaN));
  if (parts.length < 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return null;
  return { x: parts[0], y: parts[1] };
}

function finiteNumber(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).replace(/[{}]/g, "").replace(/\\scal/g, "1");
  const number = Number(normalized);
  if (Number.isFinite(number)) return number;
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : fallback;
}

function point(state) {
  return { x: state.x, y: state.y };
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}

function scalePoint(pointValue, factor) {
  return { x: pointValue.x * factor, y: pointValue.y * factor };
}

function vector(angle, length) {
  const rad = (angle * Math.PI) / 180;
  return { x: Math.cos(rad) * length, y: Math.sin(rad) * length };
}

function angleBetween(a, b) {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

function fmt(value) {
  return Number(value.toFixed(4)).toString();
}

function skipWhitespace(source, start) {
  let index = start;
  while (index < source.length && /\s/.test(source[index])) index += 1;
  return index;
}
