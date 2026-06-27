import { evaluateMath, roundNumber } from "../math.js";
import { splitTopLevel } from "../options.js";

export const stanliExtension = {
  name: "stanli",
  phase: "preprocess",
  description: "Expands practical TikZ-StructuralAnalysis/stanli commands into ordinary TikZ geometry.",
  commands: [
    "scaling",
    "point",
    "axis",
    "beam",
    "support",
    "hinge",
    "load",
    "lineload",
    "dimensioning",
    "influenceline",
    "internalforces",
    "temperature",
    "addon",
    "notation",
    "setcoords",
    "setaxis",
    "showpoint",
    "dscaling",
    "dpoint",
    "daxis",
    "dbeam",
    "dsupport",
    "dhinge",
    "dload",
    "dlineload",
    "sublineload",
    "dinternalforces",
    "subinternalforces",
    "ddimensioning",
    "subdimensioning",
    "dnotation",
    "daddon",
    "subaddon"
  ],
  preprocess(source, context = {}) {
    return expandStanli(source, context.diagnostics || []);
  }
};

const COMMANDS = new Set(stanliExtension.commands);

export function expandStanli(source, diagnostics = []) {
  if (!usesStanli(source)) return source;
  const state = createState();
  return expandWithState(String(source), state, diagnostics);
}

function usesStanli(source) {
  return /\\usepackage(?:\[[^\]]*\])?\{stanli\}/.test(String(source || ""));
}

function createState() {
  return {
    scale: 1,
    dscale: 1,
    coords: {
      xAngle: -12,
      yAngle: 37,
      zAngle: 90,
      xLength: 1,
      yLength: 1,
      zLength: 1
    },
    axisLabels: {
      global: ["$x$", "$y$", "$z$"],
      local: ["$x^\\prime$", "$y^\\prime$", "$z^\\prime$"]
    },
    axisLength: 1.5,
    localAxisLength: 0.5,
    axisDistance: 0.2,
    supportScale: 1,
    forceScale: 1,
    showPoints: false,
    points: {},
    uniqueIndex: 0
  };
}

function expandWithState(text, state, diagnostics) {
  let output = "";
  let index = 0;
  while (index < text.length) {
    if (text.startsWith("\\begin{tikzpicture}", index)) {
      const picture = rewriteTikzPictureBegin(text, index, state);
      output += picture.text;
      index = picture.end;
      continue;
    }
    if (text[index] !== "\\") {
      output += text[index];
      index += 1;
      continue;
    }
    const command = readCommandName(text, index + 1);
    if (!command || !COMMANDS.has(command.value)) {
      output += command ? text.slice(index, command.end) : text[index];
      index = command ? command.end : index + 1;
      continue;
    }
    const expanded = expandCommand(text, command.value, command.end, state, diagnostics);
    output += expanded?.text ?? text.slice(index, command.end);
    index = expanded?.end ?? command.end;
  }
  return output;
}

function rewriteTikzPictureBegin(source, start, state) {
  const token = "\\begin{tikzpicture}";
  let cursor = start + token.length;
  const options = parseOptionalArg(source, cursor);
  if (!options) return { text: token, end: cursor };
  const parts = splitTopLevel(options.content, ",").map((part) => part.trim()).filter(Boolean);
  if (!parts.includes("coords")) return { text: source.slice(start, options.end), end: options.end };
  const kept = parts.filter((part) => part !== "coords");
  kept.push(coordsBasisOptions(state));
  return {
    text: `${token}[${kept.join(",")}]`,
    end: options.end
  };
}

function coordsBasisOptions(state) {
  const { xAngle, yAngle, zAngle, xLength, yLength, zLength } = state.coords;
  return `x=(${fmt(xAngle)}:${fmt(xLength)}),y=(${fmt(yAngle)}:${fmt(yLength)}),z=(${fmt(zAngle)}:${fmt(zLength)})`;
}

function expandCommand(source, name, afterName, state, diagnostics) {
  if (name === "scaling") {
    const parsed = parseRequiredArgs(source, afterName, 1, diagnostics, name);
    if (!parsed) return null;
    state.scale = number(parsed.args[0], state.scale);
    return { text: "", end: parsed.end };
  }
  if (name === "dscaling") {
    const parsed = parseRequiredArgs(source, afterName, 2, diagnostics, name);
    if (!parsed) return null;
    const type = String(parsed.args[0]).trim();
    const scale = number(parsed.args[1], 1);
    if (type === "1") state.dscale = scale;
    if (type === "3") {
      state.axisLength *= scale;
      state.localAxisLength *= scale;
      state.axisDistance *= scale;
    }
    if (type === "2") state.supportScale *= scale;
    if (type === "4") state.forceScale *= scale;
    return { text: "", end: parsed.end };
  }
  if (name === "setcoords") {
    if (!hasRequiredArg(source, afterName)) return { text: "", end: afterName };
    const parsed = parseRequiredArgs(source, afterName, 2, diagnostics, name);
    if (!parsed) return null;
    const optional = parseOptionalArgs(source, parsed.end, 4);
    state.coords.xAngle = number(parsed.args[0], state.coords.xAngle);
    state.coords.yAngle = number(parsed.args[1], state.coords.yAngle);
    state.coords.xLength = number(optional.args[0], state.coords.xLength);
    state.coords.yLength = number(optional.args[1], state.coords.yLength);
    state.coords.zLength = number(optional.args[2], state.coords.zLength);
    state.coords.zAngle = number(optional.args[3], state.coords.zAngle);
    return { text: "", end: optional.end };
  }
  if (name === "setaxis") {
    if (!hasRequiredArg(source, afterName)) return { text: "", end: afterName };
    const parsed = parseRequiredArgs(source, afterName, 1, diagnostics, name);
    if (!parsed) return null;
    const optional = parseOptionalArgs(source, parsed.end, 6);
    if (String(parsed.args[0]).trim() === "2") {
      state.axisLabels.global = ["$X$", "$Y$", "$Z$"];
      state.axisLabels.local = ["$x$", "$y$", "$z$"];
    }
    if (String(parsed.args[0]).trim() === "3" && optional.args.length >= 6) {
      state.axisLabels.global = optional.args.slice(0, 3);
      state.axisLabels.local = optional.args.slice(3, 6);
    }
    return { text: "", end: optional.end };
  }
  if (name === "showpoint") {
    state.showPoints = true;
    return { text: "", end: afterName };
  }
  if (name === "point") return expandPoint(source, afterName, state, diagnostics);
  if (name === "dpoint") return expandDPoint(source, afterName, state, diagnostics);
  if (name === "beam" || name === "dbeam") return expandBeam(source, afterName, state, diagnostics, name);
  if (name === "support") return expandSupport(source, afterName, diagnostics);
  if (name === "dsupport") return expandDSupport(source, afterName, state, diagnostics);
  if (name === "hinge" || name === "dhinge") return expandHinge(source, afterName, diagnostics, name);
  if (name === "load" || name === "dload") return expandLoad(source, afterName, state, diagnostics, name);
  if (name === "lineload") return expandLineLoad(source, afterName, state, diagnostics);
  if (name === "dlineload" || name === "sublineload") return expandDLineLoad(source, afterName, state, diagnostics, name);
  if (name === "dinternalforces") return expandDInternalForces(source, afterName, diagnostics);
  if (name === "dimensioning") return expandDimensioning(source, afterName, diagnostics);
  if (name === "ddimensioning" || name === "subdimensioning") return expandDDimensioning(source, afterName, state, diagnostics, name);
  if (name === "daddon" || name === "subaddon") return expandDAddon(source, afterName, diagnostics, name);
  if (name === "notation" || name === "dnotation") return expandNotation(source, afterName, diagnostics, name);
  if (name === "axis") return expandAxis(source, afterName, diagnostics);
  if (name === "daxis") return expandDAxis(source, afterName, state, diagnostics);
  if (name === "influenceline") return expandInfluenceLine(source, afterName, diagnostics);
  return consumeStanliCommand(source, afterName, diagnostics, name);
}

function expandPoint(source, cursor, state, diagnostics) {
  const parsed = parseRequiredArgs(source, cursor, 3, diagnostics, "point");
  if (!parsed) return null;
  const [id, xRaw, yRaw] = parsed.args;
  const x = number(xRaw, 0) * state.scale;
  const y = number(yRaw, 0) * state.scale;
  state.points[safeId(id)] = { x, y, z: 0 };
  return { text: `\\coordinate (${safeId(id)}) at (${fmt(x)},${fmt(y)});`, end: parsed.end };
}

function expandDPoint(source, cursor, state, diagnostics) {
  const parsed = parseRequiredArgs(source, cursor, 3, diagnostics, "dpoint");
  if (!parsed) return null;
  const zArg = parseRequiredArg(source, parsed.end);
  const [id, xRaw, yRaw] = parsed.args;
  const zRaw = zArg?.content ?? 0;
  const x = number(xRaw, 0) * state.dscale;
  const y = number(yRaw, 0) * state.dscale;
  const z = number(zRaw, 0) * state.dscale;
  state.points[safeId(id)] = { x, y, z };
  const point = `(${fmt(x)},${fmt(y)},${fmt(z)})`;
  const label = state.showPoints ? `\\draw ${point} node[above,red] {${safeId(id)}};` : "";
  return { text: [`\\coordinate (${safeId(id)}) at ${point};`, label].filter(Boolean).join("\n"), end: zArg?.end ?? parsed.end };
}

const STANLI_BAR_GAP_CM = 0.15;
const STANLI_BAR_ANGLE_DEG = 45;

function expandBeam(source, cursor, state, diagnostics, name) {
  const parsed = parseRequiredArgs(source, cursor, 3, diagnostics, name);
  if (!parsed) return null;
  const optional = parseOptionalArgs(source, parsed.end, 2);
  const [type, start, end] = parsed.args.map((arg) => arg.trim());
  const startId = safeId(start);
  const endId = safeId(end);
  const style = beamStyle(type);
  const dots = [optional.args[0], optional.args[1]]
    .map((value, index) => (stanliEnabled(value) ? `\\fill (${index === 0 ? startId : endId}) circle (1pt);` : ""))
    .join("");
  const commands = [`\\draw[${style}] (${startId}) -- (${endId});`];
  if (name === "beam" && String(type).trim() === "1") {
    const helper = beamOffsetHelper(startId, endId, state);
    if (helper) {
      commands.push(
        `\\coordinate (${helper.aName}) at (${fmt(helper.a.x)},${fmt(helper.a.y)});`,
        `\\coordinate (${helper.bName}) at (${fmt(helper.b.x)},${fmt(helper.b.y)});`,
        `\\draw[line width=.7pt,dashed] (${helper.aName}) -- (${helper.bName});`
      );
    }
  }
  if (dots) commands.push(dots);
  return {
    text: commands.join("\n"),
    end: optional.end
  };
}

function beamOffsetHelper(startId, endId, state) {
  const start = state.points[startId];
  const end = state.points[endId];
  if (!start || !end || Number(start.z || 0) !== 0 || Number(end.z || 0) !== 0) return null;
  const theta = Math.atan2(end.y - start.y, end.x - start.x);
  if (!Number.isFinite(theta)) return null;
  const id = nextStanliId(state, "beam");
  return {
    aName: `${id}BarA`,
    bName: `${id}BarB`,
    a: polarOffset(start, theta - degreesToRadians(STANLI_BAR_ANGLE_DEG), STANLI_BAR_GAP_CM),
    b: polarOffset(end, theta + Math.PI + degreesToRadians(STANLI_BAR_ANGLE_DEG), STANLI_BAR_GAP_CM)
  };
}

function polarOffset(point, angle, distance) {
  return {
    x: point.x + Math.cos(angle) * distance,
    y: point.y + Math.sin(angle) * distance
  };
}

function degreesToRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

function beamStyle(type) {
  if (String(type).trim() === "2") return "line width=1.5pt";
  if (String(type).trim() === "3") return "line width=.7pt,dashed";
  return "line width=2pt";
}

function expandSupport(source, cursor, diagnostics) {
  const parsed = parseRequiredArgs(source, cursor, 2, diagnostics, "support");
  if (!parsed) return null;
  const optional = parseOptionalArgs(source, parsed.end, 1);
  const type = String(parsed.args[0]).trim();
  const point = safeId(parsed.args[1]);
  const rotation = optional.args[0] || "0";
  const support = supportCommands(type, point);
  if (support) {
    return {
      text: `\\begin{scope}[rotate around={${rotation}:(${point})}]\n${support.join("\n")}\n\\end{scope}`,
      end: optional.end
    };
  }
  return {
    text: [
      `\\draw[line width=1pt] (${point}) -- ++(.4,-.5) -- ++(-.8,0) -- cycle;`,
      `\\draw[line width=.3pt] ($(${point})+(-.38,-.43)$) -- ($(${point})+(.38,-.43)$);`
    ].join("\n"),
    end: optional.end
  };
}

function supportCommands(type, point) {
  if (type !== "1" && type !== "2") return null;
  const commands = [
    `\\draw[line width=1pt] (${point}) -- ++(.4,-.5) -- ++(-.8,0) -- cycle;`,
    `\\draw[line width=1pt] ($(${point})+(.6,-.5)$) -- ++(-1.2,0);`
  ];
  if (type === "2") {
    commands.push(`\\draw[line width=1pt] ($(${point})+(.6,-.6)$) -- ++(-1.2,0);`);
  }
  commands.push(...supportHatching(point, type === "2" ? -0.6 : -0.5));
  return commands;
}

function supportHatching(point, topY) {
  const commands = [];
  const xMin = -0.6;
  const xMax = 0.6;
  const yMin = topY - 0.35;
  const yMax = topY;
  for (let b = yMin - xMax; b <= yMax - xMin + 1e-9; b += 0.15) {
    const segment = clippedDiagonalSegment(xMin, xMax, yMin, yMax, b);
    if (!segment) continue;
    commands.push(
      `\\draw[line width=.3pt,stanli support hatch] ($(${point})+(${fmt(segment.a.x)},${fmt(segment.a.y)})$) -- ($(${point})+(${fmt(segment.b.x)},${fmt(segment.b.y)})$);`
    );
  }
  return commands;
}

function clippedDiagonalSegment(xMin, xMax, yMin, yMax, b) {
  const candidates = [
    { x: xMin, y: xMin + b },
    { x: xMax, y: xMax + b },
    { x: yMin - b, y: yMin },
    { x: yMax - b, y: yMax }
  ].filter((point) => point.x >= xMin - 1e-9 && point.x <= xMax + 1e-9 && point.y >= yMin - 1e-9 && point.y <= yMax + 1e-9);
  const unique = [];
  for (const point of candidates) {
    if (!unique.some((existing) => Math.hypot(existing.x - point.x, existing.y - point.y) < 1e-9)) {
      unique.push(point);
    }
  }
  if (unique.length < 2) return null;
  unique.sort((left, right) => left.x - right.x || left.y - right.y);
  return { a: unique[0], b: unique[unique.length - 1] };
}

function expandDSupport(source, cursor, state, diagnostics) {
  const parsed = parseRequiredArgs(source, cursor, 2, diagnostics, "dsupport");
  if (!parsed) return null;
  const optional = parseOptionalArgs(source, parsed.end, 4);
  const type = String(parsed.args[0]).trim();
  const point = safeId(parsed.args[1]);
  const dirs = [number(optional.args[0], 1), number(optional.args[1], 1), number(optional.args[2], 1)];
  const commands = [];

  if (type === "2") {
    return {
      text: [
        `\\draw[line width=1.5pt] (${point}) -- ++(-${fmt(0.5 * state.supportScale)},0,0) -- ++(${fmt(state.supportScale)},0,0);`,
        `\\draw[line width=1.5pt] (${point}) -- ++(0,-${fmt(0.5 * state.supportScale)},0) -- ++(0,${fmt(state.supportScale)},0);`
      ].join("\n"),
      end: optional.end
    };
  }

  const shifted = type === "3" || type === "5";
  const spring = type === "4" || type === "5";
  const axialHeight = 0.4 * state.supportScale;
  const supportLength = 1 * state.supportScale;
  const xStart = shifted ? { x: 0, y: 0, z: -axialHeight * 2 / 3 } : { x: 0, y: 0, z: 0 };
  const yStart = shifted ? { x: 0, y: 0, z: -axialHeight * 2 / 3 } : { x: 0, y: 0, z: 0 };
  const zStart = shifted ? { x: 0, y: 0, z: -axialHeight / 2.5 } : { x: 0, y: 0, z: 0 };
  const support = [
    { value: dirs[0], start: xStart, vector: (value) => ({ x: -supportLength * value, y: 0, z: 0 }), circle: (value) => ({ x: -supportLength * value, y: 0, z: shifted ? -axialHeight * 2 / 3 : 0 }) },
    { value: dirs[1], start: yStart, vector: (value) => ({ x: 0, y: -supportLength * value, z: 0 }), circle: (value) => ({ x: 0, y: -supportLength * value, z: shifted ? -axialHeight * 2 / 3 : 0 }) },
    {
      value: dirs[2],
      start: zStart,
      vector: (value) => ({ x: 0, y: 0, z: shifted ? -supportLength * value + axialHeight / 2 : -supportLength * value }),
      circle: (value) => ({ x: 0, y: 0, z: -supportLength * value })
    }
  ];
  for (const item of support) {
    if (!item.value) continue;
    const start = vectorText(item.start);
    const vector = vectorText(item.vector(item.value));
    const circle = vectorText(item.circle(item.value));
    const lineStyle = spring ? `${stanliDSpringStyle(state.supportScale)},stanli dspring` : "line width=1pt";
    commands.push(`\\draw[${lineStyle}] ${pointOffset(point, item.start)} -- ++${vector};`);
    commands.push(`\\filldraw[fill=white,line width=1pt] ${pointOffset(point, item.circle(item.value))} circle (${fmt(state.supportScale)}mm);`);
  }
  return {
    text: commands.join("\n"),
    end: optional.end
  };
}

function pointOffset(point, offset) {
  if (Math.abs(offset.x || 0) < 1e-12 && Math.abs(offset.y || 0) < 1e-12 && Math.abs(offset.z || 0) < 1e-12) {
    return `(${point})`;
  }
  return `($(${point})+${vectorText(offset)}$)`;
}

function stanliDSpringStyle(scale = 1) {
  return [
    "line width=1pt",
    "decorate",
    `decoration={zigzag,pre length=${fmt(7 * scale)}pt,post length=${fmt(5 * scale)}pt,segment length=${fmt(3 * scale)}pt,amplitude=${fmt(1.5 * scale)}mm}`
  ].join(",");
}

function expandHinge(source, cursor, diagnostics, name) {
  const parsed = parseRequiredArgs(source, cursor, 2, diagnostics, name);
  if (!parsed) return null;
  const optional = parseOptionalArgs(source, parsed.end, 3);
  const type = String(parsed.args[0]).trim();
  const point = safeId(parsed.args[1]);
  if (type === "2") {
    const start = safeId(optional.args[0] || "");
    const end = safeId(optional.args[1] || "");
    const connector = start && end && start !== "0" && end !== "0"
      ? `\\draw[line width=2pt] ($(${point})!0.05!(${start})$) -- (${point}) -- ($(${point})!0.05!(${end})$);`
      : "";
    return {
      text: [`\\draw[line width=1pt,fill=white] (${point}) circle (1.5mm);`, connector].filter(Boolean).join("\n"),
      end: optional.end
    };
  }
  return { text: `\\draw[line width=1pt,fill=white] (${point}) circle (1mm);`, end: optional.end };
}

function expandLoad(source, cursor, state, diagnostics, name) {
  const requiredCount = name === "dload" ? 2 : 2;
  const parsed = parseRequiredArgs(source, cursor, requiredCount, diagnostics, name);
  if (!parsed) return null;
  const optional = parseOptionalArgs(source, parsed.end, name === "dload" ? 4 : 3);
  const point = safeId(parsed.args[1]);
  if (name === "dload") {
    const type = String(parsed.args[0]).trim();
    const rotationA = number(optional.args[0], 0);
    const rotationB = number(optional.args[1], 0);
    const forceLength = stanliOptionalNumber(optional.args[2], 1) * state.forceScale;
    const forceDistance = stanliOptionalNumber(optional.args[3], 0.15) * state.forceScale;
    const start = vectorFromSpherical(forceDistance, rotationA, rotationB);
    const vector = vectorFromSpherical(forceLength, rotationA, rotationB);
    return {
      text: `\\draw[>=latex,line width=1pt,${dloadArrowOption(type)}] ${pointOffset(point, start)} -- ++${vectorText(vector)};`,
      end: optional.end
    };
  }
  const angle = number(optional.args[0], 270);
  const length = Math.abs(number(optional.args[1], 0.75)) || 0.75;
  return { text: `\\draw[-latex,line width=1pt] (${point}) -- ++(${fmt(angle)}:${fmt(length)});`, end: optional.end };
}

function stanliOptionalNumber(value, fallback) {
  const parsed = number(value, 0);
  return parsed === 0 ? fallback : parsed;
}

function dloadArrowOption(type) {
  if (String(type).trim() === "2") return "->";
  if (String(type).trim() === "4") return "->";
  return "<-";
}

const STANLI_LINELOAD_DISTANCE_CM = 0.3;
const STANLI_LINELOAD_INTERVAL = 0.2;

function expandLineLoad(source, cursor, state, diagnostics) {
  const parsed = parseRequiredArgs(source, cursor, 3, diagnostics, "lineload");
  if (!parsed) return null;
  const optional = parseOptionalArgs(source, parsed.end, 4);
  const [type, start, end] = parsed.args.map((arg) => arg.trim());
  if (String(type).trim() === "2") {
    return {
      text: expandLineLoadType2({
        start,
        end,
        startForce: number(optional.args[0], 1),
        endForce: number(optional.args[1], 1),
        interval: Math.max(0.02, number(optional.args[2], STANLI_LINELOAD_INTERVAL)),
        state
      }),
      end: optional.end
    };
  }
  return {
    text: `\\draw[-latex,line width=.7pt] (${safeId(start)}) -- (${safeId(end)});`,
    end: optional.end
  };
}

function expandLineLoadType2({ start, end, startForce, endForce, interval, state }) {
  const id = nextStanliId(state, "lineload");
  const startId = safeId(start);
  const endId = safeId(end);
  const names = {
    a1: `${id}VarA1`,
    b1: `${id}VarB1`,
    a2: `${id}VarA2`,
    b2: `${id}VarB2`
  };
  const commands = [
    `\\coordinate (${names.a1}) at ($(${startId})+(0,${fmt(STANLI_LINELOAD_DISTANCE_CM)})$);`,
    `\\coordinate (${names.b1}) at ($(${endId})+(0,${fmt(STANLI_LINELOAD_DISTANCE_CM)})$);`,
    `\\coordinate (${names.a2}) at ($(${startId})+(0,${fmt(STANLI_LINELOAD_DISTANCE_CM + startForce)})$);`,
    `\\coordinate (${names.b2}) at ($(${endId})+(0,${fmt(STANLI_LINELOAD_DISTANCE_CM + endForce)})$);`
  ];
  if (startForce !== 0) commands.push(`\\draw[-latex,line width=1pt,stanli lineload arrow] (${names.a2}) -- (${names.a1});`);
  if (endForce !== 0) commands.push(`\\draw[-latex,line width=1pt,stanli lineload arrow] (${names.b2}) -- (${names.b1});`);
  commands.push(
    `\\draw[line width=.7pt,stanli lineload outline] (${names.a1}) -- (${names.b1});`,
    `\\draw[line width=1pt,stanli lineload outline] (${names.a2}) -- (${names.b2});`,
    `\\fill[stanli lineload endpoint] (${names.a2}) circle (.5pt);`,
    `\\fill[stanli lineload endpoint] (${names.b2}) circle (.5pt);`
  );
  const arrowCount = lineLoadIntervalCount(interval);
  for (let index = 0; index < arrowCount; index += 1) {
    const t = roundNumber(interval * (index + 1));
    commands.push(
      `\\draw[-latex,line width=1pt,stanli lineload arrow] ($(${names.a2})!${fmt(t)}!(${names.b2})$) -- ($(${names.a1})!${fmt(t)}!(${names.b1})$);`
    );
  }
  return commands.join("\n");
}

function lineLoadIntervalCount(interval) {
  if (!Number.isFinite(interval) || interval <= 0 || interval >= 1) return 0;
  let count = 0;
  for (let value = interval; value <= 1 - interval + 1e-9; value += interval) {
    count += 1;
  }
  return count;
}

function expandDLineLoad(source, cursor, state, diagnostics, name) {
  if (name === "sublineload") {
    const parsed = parseRequiredArgs(source, cursor, 3, diagnostics, name);
    if (!parsed) return null;
    const optional = parseOptionalArgs(source, parsed.end, 7);
    const start = parsed.args[1].trim();
    const end = parsed.args[2].trim();
    return {
      text: `\\draw[-latex,line width=.7pt] (${safeId(start)}) -- (${safeId(end)});`,
      end: optional.end
    };
  }
  const leading = parseRequiredArgs(source, cursor, 2, diagnostics, name);
  if (!leading) return null;
  const interleaved = parseOptionalArgs(source, leading.end, 1);
  const parsed = parseRequiredArgs(source, interleaved.end, 2, diagnostics, name);
  if (!parsed) return null;
  const optional = parseOptionalArgs(source, parsed.end, 6);
  const type = String(leading.args[0]).trim();
  const rotationA = number(leading.args[1], 0);
  const rotationB = number(interleaved.args[0], 0);
  const start = parsed.args[0].trim();
  const end = parsed.args[1].trim();
  if (type === "5") {
    return {
      text: expandDLineLoadSpace({
        start,
        end,
        startForce: number(optional.args[0], 1),
        endForce: number(optional.args[1], 1),
        interval: Math.max(0.02, number(optional.args[2], 0.2)),
        rotationA,
        rotationB,
        state
      }),
      end: optional.end
    };
  }
  if (type === "6") {
    const distance = vectorFromSpherical(0.3, rotationA, rotationB);
    const id = nextStanliId(state, "lineload");
    const a = `${id}VarA1`;
    const b = `${id}VarB1`;
    const step = Math.max(0.02, number(optional.args[0], 0.2));
    const forceLength = number(optional.args[1], 0.15);
    const top = vectorFromSpherical(0.3 + forceLength, rotationA, rotationB);
    const topA = `${id}VarA2`;
    const topB = `${id}VarB2`;
    return {
      text: [
        `\\coordinate (${a}) at ($(${safeId(start)})+${vectorText(distance)}$);`,
        `\\coordinate (${b}) at ($(${safeId(end)})+${vectorText(distance)}$);`,
        `\\coordinate (${topA}) at ($(${safeId(start)})+${vectorText(top)}$);`,
        `\\coordinate (${topB}) at ($(${safeId(end)})+${vectorText(top)}$);`,
        ...loadArrowLines(topA, topB, a, b, step)
      ].join("\n"),
      end: optional.end
    };
  }
  return {
    text: `\\draw[-latex,line width=.7pt] (${safeId(start)}) -- (${safeId(end)});`,
    end: optional.end
  };
}

function expandDInternalForces(source, cursor, diagnostics) {
  const leading = parseRequiredArgs(source, cursor, 1, diagnostics, "dinternalforces");
  if (!leading) return null;
  const interleaved = parseOptionalArgs(source, leading.end, 1);
  const parsed = parseRequiredArgs(source, interleaved.end, 4, diagnostics, "dinternalforces");
  if (!parsed) return null;
  const optional = parseOptionalArgs(source, parsed.end, 3);
  const [start, end] = parsed.args.map((arg) => arg.trim());
  const color = optional.args.find((arg) => /^[A-Za-z][\w-]*$/.test(arg || "")) || "red";
  return {
    text: `\\draw[${color},line width=.5pt] (${safeId(start)}) -- (${safeId(end)});`,
    end: optional.end
  };
}

function expandDimensioning(source, cursor, diagnostics) {
  const parsed = parseRequiredArgs(source, cursor, 4, diagnostics, "dimensioning");
  if (!parsed) return null;
  const optional = parseOptionalArgs(source, parsed.end, 1);
  const [type, start, end, offsetRaw] = parsed.args.map((arg) => arg.trim());
  const offset = number(offsetRaw, 0);
  const shift = String(type) === "2" ? `(${fmt(offset)},0)` : `(0,${fmt(offset)})`;
  const label = optional.args[0] || "";
  return {
    text: `\\draw[<->,line width=.3pt] ($(${safeId(start)})+${shift}$) -- ($(${safeId(end)})+${shift}$) node[midway,below] {${label}};`,
    end: optional.end
  };
}

function expandDDimensioning(source, cursor, state, diagnostics, name) {
  if (name === "subdimensioning") {
    const parsed = parseRequiredArgs(source, cursor, 4, diagnostics, name);
    if (!parsed) return null;
    const optional = parseOptionalArgs(source, parsed.end, 3);
    const plane = parsed.args[0].trim();
    const start = parsed.args[1].trim();
    const end = parsed.args[2].trim();
    const offset = number(parsed.args[3], 0);
    const label = optional.args.find((arg) => /\S/.test(arg || "")) || "";
    const planeDistance = number(optional.args[2], 0);
    const dimension = dimensionLineForPlane(plane, start, end, offset, planeDistance, state);
    if (dimension) {
      return { text: renderDimensionLine(dimension, start, end, label), end: optional.end };
    }
    return {
      text: `\\draw[<->,line width=.3pt] ($(${safeId(start)})+(0,${fmt(offset)},0)$) -- ($(${safeId(end)})+(0,${fmt(offset)},0)$) node[midway,above] {${label}};`,
      end: optional.end
    };
  }
  const leading = parseRequiredArgs(source, cursor, 1, diagnostics, name);
  if (!leading) return null;
  const interleaved = parseOptionalArgs(source, leading.end, 1);
  const parsed = parseRequiredArgs(source, interleaved.end, 3, diagnostics, name);
  if (!parsed) return null;
  const optional = parseOptionalArgs(source, parsed.end, 3);
  const plane = leading.args[0].trim();
  const start = parsed.args[0].trim();
  const end = parsed.args[1].trim();
  const offset = number(parsed.args[2], 0);
  const planeDistance = number(interleaved.args[0], 0);
  const label = optional.args.find((arg) => /\S/.test(arg || "")) || "";
  const dimension = dimensionLineForPlane(plane, start, end, offset, planeDistance, state);
  if (dimension) {
    return { text: renderDimensionLine(dimension, start, end, label), end: optional.end };
  }
  return {
    text: `\\draw[<->,line width=.3pt] ($(${safeId(start)})+(0,${fmt(offset)},0)$) -- ($(${safeId(end)})+(0,${fmt(offset)},0)$) node[midway,above] {${label}};`,
    end: optional.end
  };
}

function expandDAddon(source, cursor, diagnostics, name) {
  if (name === "subaddon") {
    const parsed = parseRequiredArgs(source, cursor, 4, diagnostics, name);
    if (!parsed) return null;
    const optional = parseOptionalArgs(source, parsed.end, 1);
    return { text: "", end: optional.end };
  }
  const leading = parseRequiredArgs(source, cursor, 2, diagnostics, name);
  if (!leading) return null;
  const interleaved = parseOptionalArgs(source, leading.end, 1);
  const parsed = parseRequiredArgs(source, interleaved.end, 3, diagnostics, name);
  if (!parsed) return null;
  const optional = parseOptionalArgs(source, parsed.end, 1);
  return { text: "", end: optional.end };
}

function expandNotation(source, cursor, diagnostics, name) {
  const parsed = parseRequiredArgs(source, cursor, 3, diagnostics, name);
  if (!parsed) return null;
  const optional = parseOptionalArgs(source, parsed.end, 4);
  const [type, target, text] = parsed.args.map((arg) => arg.trim());
  if (String(type) === "4") {
    const label = optional.args[0] || "";
    return {
      text: `\\path (${safeId(target)}) -- (${safeId(text)}) node[midway,above] {${label}};`,
      end: optional.end
    };
  }
  const position = optional.args[0] || "above right";
  return { text: `\\node[${position}] at (${safeId(target)}) {${text}};`, end: optional.end };
}

function expandAxis(source, cursor, diagnostics) {
  const optionalLeading = parseOptionalArgs(source, cursor, 2);
  const parsed = parseRequiredArgs(source, optionalLeading.end, 4, diagnostics, "axis");
  if (!parsed) return null;
  const optionalTrailing = parseOptionalArgs(source, parsed.end, 2);
  const [point, angleRaw, xLabel, yLabel] = parsed.args;
  const angle = number(angleRaw, 0);
  return {
    text: [
      `\\draw[->] (${safeId(point)}) -- ++(${fmt(angle)}:1) node[right] {${xLabel}};`,
      `\\draw[->] (${safeId(point)}) -- ++(${fmt(angle + 90)}:1) node[above] {${yLabel}};`
    ].join("\n"),
    end: optionalTrailing.end
  };
}

function expandDAxis(source, cursor, state, diagnostics) {
  const parsed = parseRequiredArgs(source, cursor, 2, diagnostics, "daxis");
  if (!parsed) return null;
  const optional = parseOptionalArgs(source, parsed.end, 7);
  const type = String(parsed.args[0]).trim();
  const point = type === "1" ? safeId(parsed.args[1]) : safeId(optional.args[0] || "0,0,0");
  const [xLabel, yLabel, zLabel] = type === "1" ? state.axisLabels.global : state.axisLabels.local;
  const xPosition = type === "1" ? optional.args[0] || "below" : "right";
  const yPosition = type === "1" ? optional.args[1] || "above" : "above";
  const zPosition = type === "1" ? optional.args[2] || "above" : "above";
  const length = type === "1" ? state.axisLength : state.localAxisLength;
  return {
    text: [
      `\\draw[axisarrow,->] (${point}) -- ++(${fmt(length)},0,0) node[${xPosition}] {${xLabel}};`,
      `\\draw[axisarrow,->] (${point}) -- ++(0,${fmt(length)},0) node[${yPosition}] {${yLabel}};`,
      `\\draw[axisarrow,->] (${point}) -- ++(0,0,${fmt(length)}) node[${zPosition}] {${zLabel}};`
    ].join("\n"),
    end: optional.end
  };
}

function expandInfluenceLine(source, cursor, diagnostics) {
  const parsed = parseRequiredArgs(source, cursor, 3, diagnostics, "influenceline");
  if (!parsed) return null;
  const optional = parseOptionalArgs(source, parsed.end, 1);
  return {
    text: `\\draw[dashed,line width=.3pt] (${safeId(parsed.args[0])}) -- (${safeId(parsed.args[1])});`,
    end: optional.end
  };
}

function consumeStanliCommand(source, cursor, diagnostics, name) {
  const counts = {
    internalforces: 4,
    dinternalforces: 6,
    subinternalforces: 4,
    temperature: 4,
    addon: 4,
    daddon: 4,
    subaddon: 4
  };
  const parsed = parseRequiredArgs(source, cursor, counts[name] || 1, diagnostics, name);
  if (!parsed) return null;
  const optional = parseOptionalArgs(source, parsed.end, 6);
  return { text: "", end: optional.end };
}

function stanliEnabled(value) {
  if (value === undefined || value === null || String(value).trim() === "") return true;
  return String(value).trim() !== "0";
}

function nextStanliId(state, prefix) {
  state.uniqueIndex += 1;
  return `stanli${prefix}${state.uniqueIndex}`;
}

function expandDLineLoadSpace({ start, end, startForce, endForce, interval, rotationA, rotationB, state }) {
  const id = nextStanliId(state, "lineload");
  const names = {
    a1: `${id}VarA1`,
    b1: `${id}VarB1`,
    a2: `${id}VarA2`,
    b2: `${id}VarB2`
  };
  const base = vectorFromSpherical(0.3, rotationA, rotationB);
  const topA = vectorFromSpherical(0.3 + startForce, rotationA, rotationB);
  const topB = vectorFromSpherical(0.3 + endForce, rotationA, rotationB);
  return [
    `\\coordinate (${names.a1}) at ($(${safeId(start)})+${vectorText(base)}$);`,
    `\\coordinate (${names.b1}) at ($(${safeId(end)})+${vectorText(base)}$);`,
    `\\coordinate (${names.a2}) at ($(${safeId(start)})+${vectorText(topA)}$);`,
    `\\coordinate (${names.b2}) at ($(${safeId(end)})+${vectorText(topB)}$);`,
    startForce === 0 ? "" : `\\draw[-latex,line width=1pt] (${names.a2}) -- (${names.a1});`,
    endForce === 0 ? "" : `\\draw[-latex,line width=1pt] (${names.b2}) -- (${names.b1});`,
    `\\draw[line width=.7pt] (${names.a1}) -- (${names.b1});`,
    `\\draw[line width=1pt] (${names.a2}) -- (${names.b2});`,
    `\\fill (${names.a2}) circle (.5pt);`,
    `\\fill (${names.b2}) circle (.5pt);`,
    ...loadArrowLines(names.a2, names.b2, names.a1, names.b1, interval)
  ].filter(Boolean).join("\n");
}

function loadArrowLines(topA, topB, baseA, baseB, interval) {
  const lines = [];
  for (let t = interval; t <= 1 - interval + 1e-9; t += interval * 2) {
    lines.push(
      `\\draw[-latex,line width=1pt] ($(${topA})!${fmt(t)}!(${topB})$) -- ($(${baseA})!${fmt(t)}!(${baseB})$);`
    );
  }
  return lines;
}

function vectorFromSpherical(distance, rotationA, rotationB) {
  const a = (rotationA * Math.PI) / 180;
  const b = (rotationB * Math.PI) / 180;
  return {
    x: distance * Math.cos(b) * Math.sin(a),
    y: distance * Math.sin(b) * Math.sin(a),
    z: distance * Math.cos(a)
  };
}

function vectorText(point) {
  return `(${fmt(point.x)},${fmt(point.y)},${fmt(point.z || 0)})`;
}

function dimensionLineForPlane(planeRaw, startRaw, endRaw, offset, planeDistance, state) {
  const start = state.points[safeId(startRaw)];
  const end = state.points[safeId(endRaw)];
  if (!start || !end) return null;
  const plane = String(planeRaw || "").trim().toLowerCase();
  if (plane === "xy") return { a: { x: start.x, y: offset, z: planeDistance }, b: { x: end.x, y: offset, z: planeDistance } };
  if (plane === "yx") return { a: { x: offset, y: start.y, z: planeDistance }, b: { x: offset, y: end.y, z: planeDistance } };
  if (plane === "xz") return { a: { x: start.x, y: planeDistance, z: offset }, b: { x: end.x, y: planeDistance, z: offset } };
  if (plane === "zx") return { a: { x: offset, y: planeDistance, z: start.z || 0 }, b: { x: offset, y: planeDistance, z: end.z || 0 } };
  if (plane === "yz") return { a: { x: planeDistance, y: start.y, z: offset }, b: { x: planeDistance, y: end.y, z: offset } };
  if (plane === "zy") return { a: { x: planeDistance, y: offset, z: start.z || 0 }, b: { x: planeDistance, y: offset, z: end.z || 0 } };
  return null;
}

function renderDimensionLine(dimension, start, end, label) {
  const a = vectorText(dimension.a);
  const b = vectorText(dimension.b);
  return [
    `\\draw[<->,line width=.7pt] ${a} -- ${b} node[sloped,midway,above] {${label}};`,
    `\\draw[dotted,line width=.3pt] ${a} -- (${safeId(start)});`,
    `\\draw[dotted,line width=.3pt] ${b} -- (${safeId(end)});`
  ].join("\n");
}

function parseRequiredArgs(source, start, count, diagnostics, commandName) {
  let cursor = start;
  const args = [];
  for (let index = 0; index < count; index += 1) {
    cursor = skipWhitespace(source, cursor);
    const arg = extractBalanced(source, cursor, "{", "}");
    if (!arg) {
      diagnostics.push({ severity: "warning", message: `Malformed \\${commandName} command` });
      return null;
    }
    args.push(arg.content.trim());
    cursor = arg.end;
  }
  return { args, end: cursor };
}

function parseRequiredArg(source, start) {
  const cursor = skipWhitespace(source, start);
  if (source[cursor] !== "{") return null;
  const arg = extractBalanced(source, cursor, "{", "}");
  if (!arg) return null;
  return { ...arg, content: arg.content.trim() };
}

function hasRequiredArg(source, start) {
  return source[skipWhitespace(source, start)] === "{";
}

function parseOptionalArgs(source, start, maxCount) {
  let cursor = start;
  const args = [];
  for (let index = 0; index < maxCount; index += 1) {
    const parsed = parseOptionalArg(source, cursor);
    if (!parsed) break;
    args.push(parsed.content.trim());
    cursor = parsed.end;
  }
  return { args, end: cursor };
}

function parseOptionalArg(source, start) {
  const cursor = skipWhitespace(source, start);
  if (source[cursor] !== "[") return null;
  const parsed = extractBalanced(source, cursor, "[", "]");
  if (!parsed) return null;
  return parsed;
}

function readCommandName(source, index) {
  const match = source.slice(index).match(/^[A-Za-z@]+/);
  if (!match) return null;
  return { value: match[0], end: index + match[0].length };
}

function skipWhitespace(source, index) {
  let cursor = index;
  while (/\s/.test(source[cursor] || "")) cursor += 1;
  return cursor;
}

function extractBalanced(source, start, open, close) {
  if (source[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === open && source[index - 1] !== "\\") depth += 1;
    if (char === close && source[index - 1] !== "\\") {
      depth -= 1;
      if (depth === 0) {
        return {
          content: source.slice(start + 1, index),
          start,
          end: index + 1
        };
      }
    }
  }
  return null;
}

function number(value, fallback) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const result = evaluateMath(String(value).replace(/\\(?:,|;|!)/g, ""), {});
  return Number.isFinite(result) ? result : fallback;
}

function fmt(value) {
  return String(roundNumber(Number(value) || 0));
}

function safeId(value) {
  return String(value || "").trim().replace(/[{}]/g, "");
}
