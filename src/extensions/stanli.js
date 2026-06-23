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
    }
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
    state.dscale = number(parsed.args[0], state.dscale);
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
  if (name === "showpoint") return { text: "", end: afterName };
  if (name === "point") return expandPoint(source, afterName, state, diagnostics);
  if (name === "dpoint") return expandDPoint(source, afterName, state, diagnostics);
  if (name === "beam" || name === "dbeam") return expandBeam(source, afterName, diagnostics, name);
  if (name === "support") return expandSupport(source, afterName, diagnostics);
  if (name === "dsupport") return expandDSupport(source, afterName, diagnostics);
  if (name === "hinge" || name === "dhinge") return expandHinge(source, afterName, diagnostics, name);
  if (name === "load" || name === "dload") return expandLoad(source, afterName, diagnostics, name);
  if (name === "lineload") return expandLineLoad(source, afterName, diagnostics);
  if (name === "dlineload" || name === "sublineload") return expandDLineLoad(source, afterName, diagnostics, name);
  if (name === "dinternalforces") return expandDInternalForces(source, afterName, diagnostics);
  if (name === "dimensioning") return expandDimensioning(source, afterName, diagnostics);
  if (name === "ddimensioning" || name === "subdimensioning") return expandDDimensioning(source, afterName, diagnostics, name);
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
  return { text: `\\coordinate (${safeId(id)}) at (${fmt(x)},${fmt(y)},${fmt(z)});`, end: zArg?.end ?? parsed.end };
}

function expandBeam(source, cursor, diagnostics, name) {
  const parsed = parseRequiredArgs(source, cursor, 3, diagnostics, name);
  if (!parsed) return null;
  const optional = parseOptionalArgs(source, parsed.end, 2);
  const [type, start, end] = parsed.args.map((arg) => arg.trim());
  const style = beamStyle(type);
  const dots = [optional.args[0], optional.args[1]]
    .map((value, index) => (value && value.trim() !== "0" ? `\\fill (${safeId(index === 0 ? start : end)}) circle (1pt);` : ""))
    .join("");
  return {
    text: `\\draw[${style}] (${safeId(start)}) -- (${safeId(end)});${dots}`,
    end: optional.end
  };
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
  const point = safeId(parsed.args[1]);
  return {
    text: [
      `\\draw[line width=.7pt] (${point}) -- ++(.25,-.35) -- ++(-.5,0) -- cycle;`,
      `\\draw[line width=.3pt] ($(${point})+(-.38,-.43)$) -- ($(${point})+(.38,-.43)$);`
    ].join("\n"),
    end: optional.end
  };
}

function expandDSupport(source, cursor, diagnostics) {
  const parsed = parseRequiredArgs(source, cursor, 2, diagnostics, "dsupport");
  if (!parsed) return null;
  const optional = parseOptionalArgs(source, parsed.end, 4);
  const point = safeId(parsed.args[1]);
  return {
    text: [
      `\\draw[line width=.7pt] (${point}) -- ++(-.45,0,0);`,
      `\\draw[line width=.7pt] (${point}) -- ++(0,-.45,0);`,
      `\\draw[line width=.7pt] (${point}) -- ++(0,0,-.45);`
    ].join("\n"),
    end: optional.end
  };
}

function expandHinge(source, cursor, diagnostics, name) {
  const parsed = parseRequiredArgs(source, cursor, 2, diagnostics, name);
  if (!parsed) return null;
  const optional = parseOptionalArgs(source, parsed.end, 3);
  const point = safeId(parsed.args[1]);
  return { text: `\\draw[line width=.7pt,fill=white] (${point}) circle (.06);`, end: optional.end };
}

function expandLoad(source, cursor, diagnostics, name) {
  const requiredCount = name === "dload" ? 2 : 2;
  const parsed = parseRequiredArgs(source, cursor, requiredCount, diagnostics, name);
  if (!parsed) return null;
  const optional = parseOptionalArgs(source, parsed.end, name === "dload" ? 4 : 3);
  const point = safeId(parsed.args[1]);
  const angle = number(optional.args[0], 270);
  const length = Math.abs(number(optional.args[1], 0.75)) || 0.75;
  return { text: `\\draw[-latex,line width=1pt] (${point}) -- ++(${fmt(angle)}:${fmt(length)});`, end: optional.end };
}

function expandLineLoad(source, cursor, diagnostics) {
  const parsed = parseRequiredArgs(source, cursor, 3, diagnostics, "lineload");
  if (!parsed) return null;
  const optional = parseOptionalArgs(source, parsed.end, 4);
  const [, start, end] = parsed.args.map((arg) => arg.trim());
  return {
    text: `\\draw[-latex,line width=.7pt] (${safeId(start)}) -- (${safeId(end)});`,
    end: optional.end
  };
}

function expandDLineLoad(source, cursor, diagnostics, name) {
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
  const start = parsed.args[0].trim();
  const end = parsed.args[1].trim();
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

function expandDDimensioning(source, cursor, diagnostics, name) {
  if (name === "subdimensioning") {
    const parsed = parseRequiredArgs(source, cursor, 4, diagnostics, name);
    if (!parsed) return null;
    const optional = parseOptionalArgs(source, parsed.end, 3);
    const start = parsed.args[1].trim();
    const end = parsed.args[2].trim();
    const offset = number(parsed.args[3], 0);
    const label = optional.args.find((arg) => /\S/.test(arg || "")) || "";
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
  const start = parsed.args[0].trim();
  const end = parsed.args[1].trim();
  const offset = number(parsed.args[2], 0);
  const label = optional.args.find((arg) => /\S/.test(arg || "")) || "";
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
  return {
    text: [
      `\\draw[->] (${point}) -- ++(.8,0,0) node[right] {${xLabel}};`,
      `\\draw[->] (${point}) -- ++(0,.8,0) node[above] {${yLabel}};`,
      `\\draw[->] (${point}) -- ++(0,0,.8) node[above] {${zLabel}};`
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
