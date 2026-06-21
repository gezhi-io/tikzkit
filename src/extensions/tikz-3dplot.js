import { evaluateMath, roundNumber } from "../math.js";

export const tikzThreeDPlotExtension = {
  name: "tikz-3dplot",
  phase: "preprocess",
  description: "Expands common tikz-3dplot coordinate macros into ordinary TikZ styles, coordinates, and arcs.",
  commands: [
    "tdplotsetmaincoords",
    "tdplotsetrotatedcoords",
    "tdplotsetrotatedcoordsorigin",
    "tdplotresetrotatedcoordsorigin",
    "tdplotsetthetaplanecoords",
    "tdplotsetrotatedthetaplanecoords",
    "tdplotsetcoord",
    "tdplotdrawarc"
  ],
  preprocess(source, context = {}) {
    return expandTikzThreeDPlot(source, context.diagnostics || []);
  }
};

function expandTikzThreeDPlot(source, diagnostics = []) {
  let current = String(source);
  const variables = new Map();
  current = collectPgfMathMacros(current, variables);
  let mainBasis = tdplotMainBasis(0, 0);
  let rotatedBasis = null;
  let rotatedOrigin = "(0,0,0)";

  current = replaceCommand(current, "tdplotsetmaincoords", 2, (args) => {
    mainBasis = tdplotMainBasis(num(args[0], variables), num(args[1], variables));
    rotatedBasis = null;
    rotatedOrigin = "(0,0,0)";
    return `\\tikzset{tdplot_main_coords/.style={${basisStyle(mainBasis)}}}`;
  });

  current = replaceCommand(current, "tdplotsetrotatedcoords", 3, (args) => {
    rotatedBasis = tdplotRotatedBasis(mainBasis, num(args[0], variables), num(args[1], variables), num(args[2], variables));
    return `\\tikzset{tdplot_rotated_coords/.style={${basisStyle(rotatedBasis)},shift=${rotatedOrigin}}}`;
  });

  current = replaceCommand(current, "tdplotsetrotatedcoordsorigin", 1, (args) => {
    rotatedOrigin = args[0].trim();
    if (!rotatedBasis) return "";
    return `\\tikzset{tdplot_rotated_coords/.style={${basisStyle(rotatedBasis)},shift=${rotatedOrigin}}}`;
  });

  current = current.replace(/\\tdplotresetrotatedcoordsorigin\b/g, () => {
    rotatedOrigin = "(0,0,0)";
    if (!rotatedBasis) return "";
    return `\\tikzset{tdplot_rotated_coords/.style={${basisStyle(rotatedBasis)},shift=${rotatedOrigin}}}`;
  });

  current = replaceCommand(current, "tdplotsetthetaplanecoords", 1, (args) => {
    rotatedOrigin = "(0,0,0)";
    rotatedBasis = tdplotRotatedBasis(mainBasis, 270 + num(args[0], variables), 270, 0);
    return `\\tikzset{tdplot_rotated_coords/.style={${basisStyle(rotatedBasis)},shift=${rotatedOrigin}}}`;
  });

  current = replaceCommand(current, "tdplotsetrotatedthetaplanecoords", 1, (args) => {
    rotatedOrigin = "(0,0,0)";
    rotatedBasis = tdplotRotatedBasis(mainBasis, 270, 270, num(args[0], variables));
    return `\\tikzset{tdplot_rotated_coords/.style={${basisStyle(rotatedBasis)},shift=${rotatedOrigin}}}`;
  });

  current = replaceCommand(current, "tdplotsetcoord", 4, (args) => expandSetCoord(args, variables));
  current = replaceTdplotDrawArc(current, variables, diagnostics);
  return replaceKnownVariables(current, variables);
}

function collectPgfMathMacros(source, variables) {
  return replaceCommand(source, "pgfmathsetmacro", 2, (args) => {
    const name = args[0].trim().replace(/^\\/, "");
    variables.set(name, num(args[1], variables));
    return "";
  });
}

function expandSetCoord(args, variables) {
  const name = args[0].trim();
  const r = num(args[1], variables);
  const theta = deg(num(args[2], variables));
  const phi = deg(num(args[3], variables));
  const x = r * Math.sin(theta) * Math.cos(phi);
  const y = r * Math.sin(theta) * Math.sin(phi);
  const z = r * Math.cos(theta);
  return [
    `\\coordinate (${name}) at (${fmt(x)},${fmt(y)},${fmt(z)});`,
    `\\coordinate (${name}xy) at (${fmt(x)},${fmt(y)},0);`,
    `\\coordinate (${name}xz) at (${fmt(x)},0,${fmt(z)});`,
    `\\coordinate (${name}yz) at (0,${fmt(y)},${fmt(z)});`,
    `\\coordinate (${name}x) at (${fmt(x)},0,0);`,
    `\\coordinate (${name}y) at (0,${fmt(y)},0);`,
    `\\coordinate (${name}z) at (0,0,${fmt(z)});`
  ].join("\n");
}

function replaceTdplotDrawArc(source, variables, diagnostics) {
  let output = "";
  let index = 0;
  while (index < source.length) {
    if (!source.startsWith("\\tdplotdrawarc", index)) {
      output += source[index];
      index += 1;
      continue;
    }
    let cursor = index + "\\tdplotdrawarc".length;
    cursor = skipWhitespace(source, cursor);
    let options = "tdplot_main_coords";
    if (source[cursor] === "[") {
      const optional = extractBalanced(source, cursor, "[", "]");
      if (!optional) {
        diagnostics.push({ severity: "warning", message: "Could not parse tikz-3dplot drawarc options" });
        output += source[index];
        index += 1;
        continue;
      }
      options = optional.content.trim() || options;
      cursor = skipWhitespace(source, optional.end);
    }
    const args = [];
    let ok = true;
    for (let i = 0; i < 6; i += 1) {
      const parsed = extractBalanced(source, cursor, "{", "}");
      if (!parsed) {
        ok = false;
        break;
      }
      args.push(parsed.content.trim());
      cursor = skipWhitespace(source, parsed.end);
    }
    if (!ok) {
      diagnostics.push({ severity: "warning", message: "Could not parse tikz-3dplot drawarc command" });
      output += source[index];
      index += 1;
      continue;
    }
    output += expandDrawArc(options, args, variables);
    index = cursor;
  }
  return output;
}

function expandDrawArc(options, args, variables) {
  const [center, radiusRaw, startRaw, endRaw, labelOptions, label] = args;
  const radius = fmt(num(radiusRaw, variables));
  const start = fmt(num(startRaw, variables));
  const end = fmt(num(endRaw, variables));
  const mid = fmt((num(startRaw, variables) + num(endRaw, variables)) / 2);
  const node = label ? `\\path[${options}] ${center} + (${mid}:${radius}) node[${labelOptions}]{${label}};` : "";
  return `${node}\n\\draw[${options}] ${center} + (${start}:${radius}) arc (${start}:${end}:${radius});`;
}

function tdplotMainBasis(thetaDeg, phiDeg) {
  const theta = deg(thetaDeg);
  const phi = deg(phiDeg);
  const sinTheta = Math.sin(theta);
  const cosTheta = Math.cos(theta);
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  return {
    x: { x: cosPhi, y: -cosTheta * sinPhi },
    y: { x: sinPhi, y: cosTheta * cosPhi },
    z: { x: 0, y: sinTheta }
  };
}

function tdplotRotatedBasis(main, alphaDeg, betaDeg, gammaDeg) {
  const alpha = deg(alphaDeg);
  const beta = deg(betaDeg);
  const gamma = deg(gammaDeg);
  const sinAlpha = Math.sin(alpha);
  const cosAlpha = Math.cos(alpha);
  const sinBeta = Math.sin(beta);
  const cosBeta = Math.cos(beta);
  const sinGamma = Math.sin(gamma);
  const cosGamma = Math.cos(gamma);
  const euler = {
    x: {
      x: cosAlpha * cosBeta * cosGamma - sinAlpha * sinGamma,
      y: sinAlpha * cosBeta * cosGamma + cosAlpha * sinGamma,
      z: -sinBeta * cosGamma
    },
    y: {
      x: -cosAlpha * cosBeta * sinGamma - sinAlpha * cosGamma,
      y: -sinAlpha * cosBeta * sinGamma + cosAlpha * cosGamma,
      z: sinBeta * sinGamma
    },
    z: {
      x: cosAlpha * sinBeta,
      y: sinAlpha * sinBeta,
      z: cosBeta
    }
  };
  return {
    x: combineBasis(main, euler.x),
    y: combineBasis(main, euler.y),
    z: combineBasis(main, euler.z)
  };
}

function combineBasis(main, vector) {
  return {
    x: main.x.x * vector.x + main.y.x * vector.y + main.z.x * vector.z,
    y: main.x.y * vector.x + main.y.y * vector.y + main.z.y * vector.z
  };
}

function basisStyle(basis) {
  return `x={(${fmt(basis.x.x)}cm,${fmt(basis.x.y)}cm)},y={(${fmt(basis.y.x)}cm,${fmt(basis.y.y)}cm)},z={(${fmt(
    basis.z.x
  )}cm,${fmt(basis.z.y)}cm)}`;
}

function replaceKnownVariables(source, variables) {
  return String(source).replace(/\\([A-Za-z@]\w*)/g, (match, name) => (variables.has(name) ? fmt(variables.get(name)) : match));
}

function replaceCommand(source, name, argCount, replacer) {
  let output = "";
  let index = 0;
  const token = `\\${name}`;
  while (index < source.length) {
    if (!source.startsWith(token, index)) {
      output += source[index];
      index += 1;
      continue;
    }
    let cursor = skipWhitespace(source, index + token.length);
    const args = [];
    let ok = true;
    for (let i = 0; i < argCount; i += 1) {
      const parsed = extractBalanced(source, cursor, "{", "}");
      if (!parsed) {
        ok = false;
        break;
      }
      args.push(parsed.content.trim());
      cursor = skipWhitespace(source, parsed.end);
    }
    if (!ok) {
      output += source[index];
      index += 1;
      continue;
    }
    output += replacer(args);
    index = cursor;
  }
  return output;
}

function extractBalanced(source, start, open, close) {
  if (source[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === open) depth += 1;
    if (source[index] === close) depth -= 1;
    if (depth === 0) {
      return { content: source.slice(start + 1, index), end: index + 1 };
    }
  }
  return null;
}

function skipWhitespace(source, index) {
  let cursor = index;
  while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;
  return cursor;
}

function num(value, variables) {
  return evaluateMath(String(value).trim(), Object.fromEntries(variables));
}

function deg(value) {
  return (value * Math.PI) / 180;
}

function fmt(value) {
  return String(roundNumber(value, 6));
}
