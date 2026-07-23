import { evaluateMath, roundNumber } from "../engine/math.js";
import { parseOptions, splitTopLevel } from "../engine/options.js";

const IMPLEMENTED_COMMANDS = [
  "usetkzobj",
  "tkzSetUpPoint",
  "tkzSetUpLine",
  "tkzSetUpLabel",
  "tkzSetUpStyle",
  "tkzDefPoint",
  "tkzDefPoints",
  "tkzDefMidPoint",
  "tkzDefCircle",
  "tkzDefLine",
  "tkzTangent",
  "tkzDefTangent",
  "tkzInterLL",
  "tkzInterLC",
  "tkzGetLength",
  "tkzGetPoint",
  "tkzGetPoints",
  "tkzDrawPoint",
  "tkzDrawPoints",
  "tkzDrawLine",
  "tkzDrawLines",
  "tkzDrawSegment",
  "tkzDrawSegments",
  "tkzDrawCircle",
  "tkzClipCircle",
  "tkzDrawArc",
  "tkzDrawPolygon",
  "tkzMarkSegment",
  "tkzMarkSegments",
  "tkzMarkAngle",
  "tkzMarkAngles",
  "tkzMarkRightAngle",
  "tkzMarkRightAngles",
  "tkzFillAngle",
  "tkzFillAngles",
  "tkzLabelAngle",
  "tkzLabelPoint",
  "tkzLabelPoints",
  "tkzLabelSegment",
  "tkzLabelSegments",
  "tkzLabelLine",
  "tkzFillPolygon"
];

const DEFERRED_COMMANDS = new Map();

const TKZ_COMMANDS = new Set([...IMPLEMENTED_COMMANDS, ...DEFERRED_COMMANDS.keys(), "pgfmathsetmacro"]);
const TKZ_LABEL_STYLE_DEFAULTS = String.raw`\tikzset{label style/.style={below,font=\normalsize},label angle style/.style={font=\normalsize}}`;

export const tkzEuclideExtension = {
  name: "tkz-euclide",
  phase: "preprocess",
  description: "Expands a practical tkz-euclide point, line, tangent, angle, polygon, arc, intersection, label, and shared-style subset into ordinary TikZ.",
  commands: IMPLEMENTED_COMMANDS,
  preprocess(source, context = {}) {
    return expandTkzEuclide(source, context.diagnostics || []);
  }
};

export function expandTkzEuclide(source, diagnostics = []) {
  const text = String(source || "");
  if (!usesTkzEuclide(text)) return text;
  return expandWithState(injectDefaultLabelStyles(text), createState(), diagnostics);
}

function usesTkzEuclide(source) {
  return /\\usepackage(?:\[[^\]]*\])?\{[^{}]*\btkz-euclide\b[^{}]*\}/.test(source);
}

function injectDefaultLabelStyles(source) {
  let injected = false;
  return source.replace(/\\usepackage(?:\[[^\]]*\])?\{([^{}]*)\}/g, (match, packages) => {
    if (injected || !String(packages).split(",").some((name) => name.trim() === "tkz-euclide")) return match;
    injected = true;
    return `${match}\n${TKZ_LABEL_STYLE_DEFAULTS}`;
  });
}

function createState() {
  return {
    points: new Map(),
    pointResult: null,
    pointResults: [],
    lengthResult: null,
    numericMacros: new Map(),
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
    circleStyle: {
      lineWidth: "0.2pt",
      color: "black!50",
      style: "solid"
    },
    circleClip: null,
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
      state.pointResults = [];
      state.lengthResult = null;
      state.circleClip = null;
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
  if (name === "pgfmathsetmacro") return expandPgfMathSetMacro(source, afterName, state);
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
  if (name === "tkzSetUpLabel") return expandSetUpLabel(source, afterName);
  if (name === "tkzSetUpStyle") return expandSetUpStyle(source, afterName, diagnostics);
  if (name === "tkzDefPoints") return expandDefPoints(source, afterName, state, diagnostics);
  if (name === "tkzDefPoint") return expandDefPoint(source, afterName, state, diagnostics);
  if (name === "tkzDefMidPoint") return expandDefMidPoint(source, afterName, state, diagnostics);
  if (name === "tkzDefCircle") return expandDefCircle(source, afterName, state, diagnostics);
  if (name === "tkzDefLine") return expandDefLine(source, afterName, state, diagnostics);
  if (name === "tkzTangent" || name === "tkzDefTangent") return expandTangent(source, afterName, state, diagnostics);
  if (name === "tkzInterLL") return expandInterLL(source, afterName, state, diagnostics);
  if (name === "tkzInterLC") return expandInterLC(source, afterName, state, diagnostics);
  if (name === "tkzGetLength") return expandGetLength(source, afterName, state, diagnostics);
  if (name === "tkzGetPoint") return expandGetPoint(source, afterName, state, diagnostics);
  if (name === "tkzGetPoints") return expandGetPoints(source, afterName, state, diagnostics);
  if (name === "tkzDrawPoint" || name === "tkzDrawPoints") {
    return expandDrawPoints(source, afterName, state, diagnostics, name === "tkzDrawPoint");
  }
  if (name === "tkzDrawLine" || name === "tkzDrawSegment") {
    return expandDrawPairs(source, afterName, state, diagnostics, name === "tkzDrawLine", true);
  }
  if (name === "tkzDrawLines" || name === "tkzDrawSegments") {
    return expandDrawPairs(source, afterName, state, diagnostics, name === "tkzDrawLines", false);
  }
  if (name === "tkzDrawCircle") return expandDrawCircle(source, afterName, state, diagnostics);
  if (name === "tkzClipCircle") return expandClipCircle(source, afterName, state, diagnostics);
  if (name === "tkzDrawArc") return expandDrawArc(source, afterName, state, diagnostics);
  if (name === "tkzDrawPolygon") return expandDrawPolygon(source, afterName, state, diagnostics);
  if (name === "tkzMarkSegment" || name === "tkzMarkSegments") {
    return expandMarkSegments(source, afterName, state, diagnostics, name === "tkzMarkSegment");
  }
  if (name === "tkzMarkAngle") return expandMarkAngle(source, afterName, state, diagnostics);
  if (name === "tkzMarkAngles") return expandMarkAngles(source, afterName, state, diagnostics);
  if (name === "tkzMarkRightAngle") return expandMarkRightAngle(source, afterName, state, diagnostics);
  if (name === "tkzMarkRightAngles") return expandMarkRightAngles(source, afterName, state, diagnostics);
  if (name === "tkzFillAngle") return expandFillAngle(source, afterName, state, diagnostics);
  if (name === "tkzFillAngles") return expandFillAngles(source, afterName, state, diagnostics);
  if (name === "tkzLabelAngle") return expandLabelAngle(source, afterName, state, diagnostics);
  if (name === "tkzLabelPoint") return expandLabelPoint(source, afterName, diagnostics);
  if (name === "tkzLabelPoints") return expandLabelPoints(source, afterName, diagnostics);
  if (name === "tkzLabelSegment") return expandLabelSegment(source, afterName, diagnostics);
  if (name === "tkzLabelSegments") return expandLabelSegments(source, afterName, diagnostics);
  if (name === "tkzLabelLine") return expandLabelLine(source, afterName, diagnostics);
  if (name === "tkzFillPolygon") return expandFillPolygon(source, afterName, diagnostics);
  return null;
}

function expandPgfMathSetMacro(source, afterName, state) {
  const name = parseRequiredArg(source, afterName);
  const expression = name && parseRequiredArg(source, name.end);
  if (!name || !expression) return null;
  const macroName = name.content.trim().replace(/^\\/, "");
  const value = evaluateMath(expression.content.trim());
  if (macroName && Number.isFinite(value)) state.numericMacros.set(macroName, value);
  return {
    text: source.slice(afterName - "pgfmathsetmacro".length - 1, expression.end),
    end: expression.end
  };
}

function expandSetUpLabel(source, afterName) {
  const optional = parseOptionalArg(source, afterName);
  return {
    text: `\\tikzset{label style/.style={${optional.content}}}`,
    end: optional.end
  };
}

function expandSetUpStyle(source, afterName, diagnostics) {
  const optional = parseOptionalArg(source, afterName);
  const style = parseRequiredArg(source, optional.end);
  if (!style || !style.content.trim()) return malformed(diagnostics, "tkzSetUpStyle");
  return {
    text: `\\tikzset{${style.content.trim()}/.style={${optional.content}}}`,
    end: style.end
  };
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

function expandDefMidPoint(source, afterName, state, diagnostics) {
  const pair = parseParenthesizedArg(source, afterName);
  state.pointResult = null;
  state.pointResults = [];
  if (!pair) return malformed(diagnostics, "tkzDefMidPoint");

  const pointNames = parsePointPair(pair.content);
  const first = pointNames && state.points.get(pointNames[0]);
  const second = pointNames && state.points.get(pointNames[1]);
  if (!pointNames) {
    warn(diagnostics, `Could not resolve tkzDefMidPoint points (${pair.content})`);
    return { text: "", end: pair.end };
  }

  if (!first || !second) {
    state.pointResult = {
      expression: `($(${pointNames[0]})!.5!(${pointNames[1]})$)`
    };
    return {
      text: `\\coordinate (tkzPointResult) at ${renderPointResultCoordinate(state.pointResult)};`,
      end: pair.end
    };
  }

  // tkz-euclide averages the two point anchors' centers and stores the
  // coordinate as tkzPointResult for the following tkzGetPoint command.
  state.pointResult = {
    x: roundNumber((first.x + second.x) / 2, 10),
    y: roundNumber((first.y + second.y) / 2, 10)
  };
  return {
    text: `\\coordinate (tkzPointResult) at (${formatNumber(state.pointResult.x)},${formatNumber(state.pointResult.y)});`,
    end: pair.end
  };
}

function expandDefCircle(source, afterName, state, diagnostics) {
  const optional = parseOptionalArg(source, afterName);
  const points = parseParenthesizedArg(source, optional.end);
  state.pointResult = null;
  state.pointResults = [];
  state.lengthResult = null;
  if (!points) return malformed(diagnostics, "tkzDefCircle");

  const options = parseOptions(optional.content);
  const optionKeys = optionParts(optional.content).map((part) => part.key);
  const isCircumcircle = options.circum === true || optionKeys.includes("circum");
  const isIncircle = options.in === true || optionKeys.includes("in");
  const names = parsePointTriple(points.content);
  if ((!isCircumcircle && !isIncircle) || !names) {
    warnOnce(
      state,
      diagnostics,
      "tkzDefCircle-variants",
      "tkz-euclide compatibility currently supports tkzDefCircle[circum](A,B,C) and tkzDefCircle[in](A,B,C)"
    );
    return { text: "", end: points.end };
  }

  const [firstName, secondName, thirdName] = names;
  const first = state.points.get(firstName);
  const second = state.points.get(secondName);
  const third = state.points.get(thirdName);
  const center = first && second && third && (isCircumcircle
    ? circumcenter(first, second, third)
    : incenter(first, second, third));
  const through = center && (isCircumcircle ? first : orthogonalProjection(center, first, third));
  if (!center || !through) {
    warn(diagnostics, `Could not construct tkzDefCircle[${isCircumcircle ? "circum" : "in"}] from (${points.content})`);
    return { text: "", end: points.end };
  }

  const radius = roundNumber(distanceBetween(center, through), 10);
  state.pointResult = center;
  state.pointResults = [center, through];
  state.lengthResult = radius;
  state.points.set("tkzPointResult", center);
  state.points.set("tkzFirstPointResult", center);
  state.points.set("tkzSecondPointResult", through);
  return {
    text: [
      `\\coordinate (tkzPointResult) at (${formatNumber(center.x)},${formatNumber(center.y)});`,
      `\\coordinate (tkzFirstPointResult) at (${formatNumber(center.x)},${formatNumber(center.y)});`,
      isCircumcircle
        ? `\\coordinate (tkzSecondPointResult) at (${firstName});`
        : `\\coordinate (tkzSecondPointResult) at (${formatNumber(through.x)},${formatNumber(through.y)});`
    ].join("\n"),
    end: points.end
  };
}

function expandDefLine(source, afterName, state, diagnostics) {
  const optional = parseOptionalArg(source, afterName);
  const pointsArgument = parseParenthesizedArg(source, optional.end);
  if (!pointsArgument) return malformed(diagnostics, "tkzDefLine");
  const options = parseOptions(optional.content);
  const parallel = String(options.parallel || "").match(/^through\s+(.+)$/);
  const perpendicular = String(options.perpendicular || options.orthogonal || "").match(/^through\s+(.+)$/);
  const tangentAtName = String(options["tangent at"] ?? "").trim();
  const tangentFromName = String(options["tangent from"] ?? "").trim();
  const bisectorMode = isEnabledOption(options, "bisector out")
    ? "external"
    : isEnabledOption(options, "bisector")
      ? "internal"
      : null;
  const altitude = isEnabledOption(options, "altitude");
  const euler = isEnabledOption(options, "euler");
  const symmedian = isEnabledOption(options, "symmedian");
  // `mediator` is the native default when no alternate tkzDefLine family is
  // selected, including the no-optional-argument form \tkzDefLine(A,B).
  const mediator = isEnabledOption(options, "mediator") || (
    !parallel && !perpendicular && !tangentAtName && !tangentFromName &&
    !bisectorMode && !altitude && !euler && !symmedian
  );
  const pointNames = splitTopLevel(pointsArgument.content, ",").map((point) => point.trim()).filter(Boolean);
  const points = bisectorMode || altitude || euler || symmedian
    ? parsePointTriple(pointsArgument.content)
    : parsePointPair(pointsArgument.content);
  if ((mediator && !points) ||
      (!mediator && !parallel && !perpendicular && !tangentAtName && !tangentFromName && !bisectorMode && !altitude && !euler && !symmedian) ||
      (tangentAtName ? pointNames.length !== 1 : tangentFromName ? !points : !points)) {
    state.pointResult = null;
    warnOnce(
      state,
      diagnostics,
      "tkzDefLine",
      "tkz-euclide compatibility currently supports the default tkzDefLine[mediator], tkzDefLine[parallel=through P], tkzDefLine[perpendicular=through P], tkzDefLine[bisector], tkzDefLine[bisector out], tkzDefLine[altitude], tkzDefLine[euler], tkzDefLine[symmedian], tkzDefLine[tangent at=P], and tkzDefLine[tangent from=P]"
    );
    return { text: "", end: pointsArgument.end };
  }

  if (mediator) {
    const [firstName, secondName] = points;
    const first = state.points.get(firstName);
    const second = state.points.get(secondName);
    const factor = numericOption(options.K, 1);
    const normalizedLength = isEnabledOption(options, "normed")
      ? factor
      : null;
    const result = first && second
      ? mediatorLinePoints(first, second, factor, normalizedLength)
      : null;
    if (!result) {
      state.pointResult = null;
      state.pointResults = [];
      warn(diagnostics, `Could not resolve tkzDefLine[mediator] points ${pointsArgument.content}`);
      return { text: "", end: pointsArgument.end };
    }
    const [firstResult, secondResult] = result;
    // tkzDefMediatorLine builds the +60-degree equilateral point first and
    // the reversed one second. The second remains tkzPointResult while both
    // are available to tkzGetPoints.
    state.pointResult = secondResult;
    state.pointResults = [firstResult, secondResult];
    state.points.set("tkzPointResult", secondResult);
    state.points.set("tkzFirstPointResult", firstResult);
    state.points.set("tkzSecondPointResult", secondResult);
    return {
      text: [
        `\\coordinate (tkzPointResult) at ${renderPointResultCoordinate(secondResult)};`,
        `\\coordinate (tkzFirstPointResult) at ${renderPointResultCoordinate(firstResult)};`,
        `\\coordinate (tkzSecondPointResult) at ${renderPointResultCoordinate(secondResult)};`
      ].join("\n"),
      end: pointsArgument.end
    };
  }

  if (tangentAtName) {
    const center = state.points.get(pointNames[0]);
    const tangentPoint = state.points.get(tangentAtName);
    // tkzTgtAt(center)(point) delegates to tkz@VecKOrthNorm[-1](point,center).
    // It always returns a one-centimeter clockwise normal from the contact point.
    state.pointResult = center && tangentPoint
      ? tangentDirectionPoint(center, tangentPoint)
      : null;
    if (!state.pointResult) {
      warn(diagnostics, `Could not resolve tkzDefLine[tangent at=${tangentAtName}] circle center ${pointsArgument.content}`);
      return { text: "", end: pointsArgument.end };
    }
    state.pointResults = [];
    state.points.set("tkzPointResult", state.pointResult);
    return {
      text: `\\coordinate (tkzPointResult) at ${renderPointResultCoordinate(state.pointResult)};`,
      end: pointsArgument.end
    };
  }

  if (tangentFromName) {
    const [centerName, radiusPointName] = points;
    const center = state.points.get(centerName);
    const radiusPoint = state.points.get(radiusPointName);
    const external = state.points.get(tangentFromName);
    const radius = center && radiusPoint
      ? Math.hypot(radiusPoint.x - center.x, radiusPoint.y - center.y)
      : Number.NaN;
    const contacts = center && external && Number.isFinite(radius)
      ? tangentContactsFromExternal(center, radius, external)
      : null;
    if (!contacts) {
      state.pointResult = null;
      state.pointResults = [];
      warn(diagnostics, `Could not resolve tkzDefLine[tangent from=${tangentFromName}] circle (${pointsArgument.content})`);
      return { text: "", end: pointsArgument.end };
    }
    const { first, second, midpoint } = contacts;
    // tkzTgtFromP creates this midpoint before calling tkzInterCCR. The
    // latter only publishes first/second results, leaving tkzPointResult at
    // that midpoint as in TeX Live.
    state.pointResult = midpoint;
    state.pointResults = [first, second];
    state.points.set("tkzPointResult", midpoint);
    state.points.set("tkzFirstPointResult", first);
    state.points.set("tkzSecondPointResult", second);
    return {
      text: [
        `\\coordinate (tkzPointResult) at ${renderPointResultCoordinate(midpoint)};`,
        `\\coordinate (tkzFirstPointResult) at ${renderPointResultCoordinate(first)};`,
        `\\coordinate (tkzSecondPointResult) at ${renderPointResultCoordinate(second)};`
      ].join("\n"),
      end: pointsArgument.end
    };
  }

  if (bisectorMode) {
    const [firstName, vertexName, thirdName] = points;
    const first = state.points.get(firstName);
    const vertex = state.points.get(vertexName);
    const third = state.points.get(thirdName);
    const factor = numericOption(options.K, 1);
    const normalizedLength = isEnabledOption(options, "normed")
      ? factor
      : null;
    state.pointResult = first && vertex && third
      ? bisectorMode === "external"
        ? externalAngleBisectorPoint(first, vertex, third, factor, normalizedLength)
        : internalAngleBisectorPoint(first, vertex, third, factor, normalizedLength)
      : null;
    if (!state.pointResult) {
      warn(diagnostics, `Could not resolve tkzDefLine[${bisectorMode === "external" ? "bisector out" : "bisector"}] points ${pointsArgument.content}`);
      return { text: "", end: pointsArgument.end };
    }
    state.points.set("tkzPointResult", state.pointResult);
    return {
      text: `\\coordinate (tkzPointResult) at ${renderPointResultCoordinate(state.pointResult)};`,
      end: pointsArgument.end
    };
  }

  if (symmedian) {
    const [firstName, vertexName, thirdName] = points;
    const first = state.points.get(firstName);
    const vertex = state.points.get(vertexName);
    const third = state.points.get(thirdName);
    const factor = numericOption(options.K, 1);
    const normalizedLength = isEnabledOption(options, "normed")
      ? factor
      : null;
    state.pointResult = first && vertex && third
      ? symmedianPoint(first, vertex, third, factor, normalizedLength)
      : null;
    if (!state.pointResult) {
      warn(diagnostics, `Could not resolve tkzDefLine[symmedian] points ${pointsArgument.content}`);
      return { text: "", end: pointsArgument.end };
    }
    state.points.set("tkzPointResult", state.pointResult);
    return {
      text: `\\coordinate (tkzPointResult) at ${renderPointResultCoordinate(state.pointResult)};`,
      end: pointsArgument.end
    };
  }

  if (altitude) {
    const [firstName, vertexName, thirdName] = points;
    const first = state.points.get(firstName);
    const vertex = state.points.get(vertexName);
    const third = state.points.get(thirdName);
    // tkzDefAltitudeLine(P,V,Q) delegates to tkzUProjection(P,Q)(V).
    // Its native branch does not apply the general K or normed line options.
    state.pointResult = first && vertex && third
      ? orthogonalProjection(vertex, first, third)
      : null;
    if (!state.pointResult) {
      warn(diagnostics, `Could not resolve tkzDefLine[altitude] points ${pointsArgument.content}`);
      return { text: "", end: pointsArgument.end };
    }
    state.points.set("tkzPointResult", state.pointResult);
    return {
      text: `\\coordinate (tkzPointResult) at ${renderPointResultCoordinate(state.pointResult)};`,
      end: pointsArgument.end
    };
  }

  if (euler) {
    const [firstName, secondName, thirdName] = points;
    const first = state.points.get(firstName);
    const second = state.points.get(secondName);
    const third = state.points.get(thirdName);
    const result = first && second && third ? eulerLinePoints(first, second, third) : null;
    if (!result) {
      warn(diagnostics, `Could not resolve tkzDefLine[euler] points ${pointsArgument.content}`);
      return { text: "", end: pointsArgument.end };
    }
    const [orthocenter, eulerCenter] = result;
    // tkzDefEulerLine returns the orthocenter first and the nine-point
    // center second. The native macro leaves tkzPointResult at that latter
    // construction while also publishing both named result registers.
    state.pointResult = eulerCenter;
    state.pointResults = [orthocenter, eulerCenter];
    state.points.set("tkzPointResult", eulerCenter);
    state.points.set("tkzFirstPointResult", orthocenter);
    state.points.set("tkzSecondPointResult", eulerCenter);
    return {
      text: [
        `\\coordinate (tkzPointResult) at ${renderPointResultCoordinate(eulerCenter)};`,
        `\\coordinate (tkzFirstPointResult) at ${renderPointResultCoordinate(orthocenter)};`,
        `\\coordinate (tkzSecondPointResult) at ${renderPointResultCoordinate(eulerCenter)};`
      ].join("\n"),
      end: pointsArgument.end
    };
  }

  const throughName = (parallel || perpendicular)[1].trim();
  const through = state.points.get(throughName);
  const first = state.points.get(points[0]);
  const second = state.points.get(points[1]);
  if (!first || !second) {
    state.pointResult = null;
    warn(diagnostics, `Could not resolve tkzDefLine points ${pointsArgument.content}`);
    return { text: "", end: pointsArgument.end };
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
    end: pointsArgument.end
  };
}

function expandTangent(source, afterName, state, diagnostics) {
  const optional = parseOptionalArg(source, afterName);
  const circle = parseParenthesizedArg(source, optional.end);
  if (!circle) return malformed(diagnostics, "tkzTangent");

  const options = parseOptions(optional.content);
  const fromName = String(options["from with R"] ?? "").trim();
  const [centerName, rawRadius] = splitTopLevel(circle.content, ",").map((part) => part.trim());
  const center = state.points.get(centerName);
  const from = state.points.get(fromName);
  const radius = dimensionToCentimeters(resolveNumericMacros(rawRadius, state));

  state.pointResult = null;
  state.pointResults = [];
  if (!fromName || !centerName || !rawRadius) {
    warnOnce(
      state,
      diagnostics,
      "tkzTangent-variants",
      "tkz-euclide compatibility currently supports tkzTangent[from with R=P](center,radius) from an external named point"
    );
    return { text: "", end: circle.end };
  }
  if (!center || !from || !Number.isFinite(radius) || radius <= 0) {
    warn(diagnostics, `Could not resolve tkzTangent circle (${circle.content}) or external point ${fromName}`);
    return { text: "", end: circle.end };
  }

  const contacts = tangentContactsFromExternal(center, radius, from);
  if (!contacts) {
    warn(diagnostics, `tkzTangent requires an external point outside the circle: ${fromName}`);
    return { text: "", end: circle.end };
  }
  const { first, second, midpoint } = contacts;
  state.pointResult = midpoint;
  state.pointResults = [first, second];
  state.points.set("tkzPointResult", midpoint);
  state.points.set("tkzFirstPointResult", first);
  state.points.set("tkzSecondPointResult", second);
  return {
    text: [
      `\\coordinate (tkzPointResult) at ${renderPointResultCoordinate(midpoint)};`,
      `\\coordinate (tkzFirstPointResult) at (${formatNumber(first.x)},${formatNumber(first.y)});`,
      `\\coordinate (tkzSecondPointResult) at (${formatNumber(second.x)},${formatNumber(second.y)});`
    ].join("\n"),
    end: circle.end
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

function expandInterLC(source, afterName, state, diagnostics) {
  const optional = parseOptionalArg(source, afterName);
  const line = parseParenthesizedArg(source, optional.end);
  const circle = line && parseParenthesizedArg(source, line.end);
  state.pointResult = null;
  state.pointResults = [];
  if (!line || !circle) return malformed(diagnostics, "tkzInterLC");

  const lineNames = parsePointPair(line.content);
  const circleNames = splitTopLevel(circle.content, ",").map((name) => name.trim()).filter(Boolean);
  const options = parseOptions(optional.content);
  const firstLinePoint = lineNames && state.points.get(lineNames[0]);
  const secondLinePoint = lineNames && state.points.get(lineNames[1]);
  const center = circleNames[0] && state.points.get(circleNames[0]);
  const useExplicitRadius = Object.hasOwn(options, "R");
  const useRadiusNodes = Object.hasOwn(options, "with nodes");

  let radius = Number.NaN;
  if (useExplicitRadius) {
    radius = dimensionToCentimeters(resolveNumericMacros(circleNames[1], state));
  } else if (useRadiusNodes) {
    const radiusStart = circleNames[1] && state.points.get(circleNames[1]);
    const radiusEnd = circleNames[2] && state.points.get(circleNames[2]);
    if (radiusStart && radiusEnd) radius = distanceBetween(radiusStart, radiusEnd);
  } else {
    const radiusPoint = circleNames[1] && state.points.get(circleNames[1]);
    if (radiusPoint && center) radius = distanceBetween(center, radiusPoint);
  }

  if (!lineNames || !firstLinePoint || !secondLinePoint || !center || !Number.isFinite(radius) || radius <= 0) {
    warn(diagnostics, `Could not resolve tkzInterLC inputs (${line.content})(${circle.content})`);
    return { text: "", end: circle.end };
  }

  let intersections = lineCircleIntersections(firstLinePoint, secondLinePoint, center, radius);
  if (!intersections) {
    warn(diagnostics, `tkzInterLC has no real intersection: (${line.content}) and (${circle.content})`);
    return { text: "", end: circle.end };
  }

  intersections = orderLineCircleIntersections(intersections, firstLinePoint, center, options, state);
  state.pointResults = intersections;
  return {
    text: [
      `\\coordinate (tkzFirstPointResult) at (${formatNumber(intersections[0].x)},${formatNumber(intersections[0].y)});`,
      `\\coordinate (tkzSecondPointResult) at (${formatNumber(intersections[1].x)},${formatNumber(intersections[1].y)});`
    ].join("\n"),
    end: circle.end
  };
}

function expandGetLength(source, afterName, state, diagnostics) {
  const name = parseRequiredArg(source, afterName);
  if (!name) return malformed(diagnostics, "tkzGetLength");
  const macroName = name.content.trim().replace(/^\\/, "");
  if (!macroName || !Number.isFinite(state.lengthResult)) {
    warn(diagnostics, `tkzGetLength could not resolve ${macroName || "an unnamed length"}`);
    return { text: "", end: name.end };
  }
  state.numericMacros.set(macroName, state.lengthResult);
  return {
    // The value is consumed by following tkz-euclide commands through
    // state.numericMacros. Emitting a TeX \def here would make the current
    // single-pass frontend swallow the following ordinary TikZ statement.
    text: "",
    end: name.end
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

function expandGetPoints(source, afterName, state, diagnostics) {
  const firstName = parseRequiredArg(source, afterName);
  const secondName = firstName && parseRequiredArg(source, firstName.end);
  if (!firstName || !secondName) return malformed(diagnostics, "tkzGetPoints");
  const first = firstName.content.trim();
  const second = secondName.content.trim();
  const [firstPoint, secondPoint] = state.pointResults;
  if (!first || !second || !firstPoint || !secondPoint) {
    warn(diagnostics, `tkzGetPoints could not resolve ${first || "the first"} and ${second || "the second"} point`);
    return { text: "", end: secondName.end };
  }
  state.points.set(first, firstPoint);
  state.points.set(second, secondPoint);
  return {
    text: [
      `\\coordinate (${first}) at (${formatNumber(firstPoint.x)},${formatNumber(firstPoint.y)});`,
      `\\coordinate (${second}) at (${formatNumber(secondPoint.x)},${formatNumber(secondPoint.y)});`
    ].join("\n"),
    end: secondName.end
  };
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

function expandDrawCircle(source, afterName, state, diagnostics) {
  const optional = parseOptionalArg(source, afterName);
  const pair = parseParenthesizedArg(source, optional.end);
  const points = pair && parsePointPair(pair.content);
  if (!pair || !points) return malformed(diagnostics, "tkzDrawCircle");
  const circle = tkzCircleGeometry(points, optional.content, state, diagnostics);
  if (!circle) return { text: "", end: pair.end };
  const options = tkzCircleDrawOptions(optional.content, state);
  return {
    text: renderTkzCircle(circle, options, state.circleClip),
    end: pair.end
  };
}

function expandClipCircle(source, afterName, state, diagnostics) {
  const optional = parseOptionalArg(source, afterName);
  const pair = parseParenthesizedArg(source, optional.end);
  const points = pair && parsePointPair(pair.content);
  if (!pair || !points) return malformed(diagnostics, "tkzClipCircle");
  const circle = tkzCircleGeometry(points, optional.content, state, diagnostics);
  if (circle) state.circleClip = circle;
  return { text: "", end: pair.end };
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
  const radius = normalizeDimensionWhitespace(resolveNumericMacros(radiusParts[1], state));
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

function expandMarkSegments(source, afterName, state, diagnostics, single) {
  const optional = parseOptionalArg(source, afterName);
  const list = parseParenthesizedArg(source, optional.end);
  if (!list) return malformed(diagnostics, single ? "tkzMarkSegment" : "tkzMarkSegments");

  const pairs = single ? [parsePointPair(list.content)] : parsePointPairs(list.content);
  const options = parseOptions(optional.content);
  const mark = String(options.mark ?? "|").trim();
  const count = tkzSegmentMarkCount(mark);
  const customMark = !count && tkzAngleMarkIsSupported(mark);
  if (!count && !customMark) {
    warnOnce(
      state,
      diagnostics,
      "tkzMarkSegments-variants",
      "tkz-euclide compatibility supports segment marks |, ||, |||, s|, s||, s|||, z, s, oo, x, o, *, and +; other mark variants remain deferred"
    );
    return { text: "", end: list.end };
  }

  const markerOptions = renderSegmentMarkOptions(optional.content);
  const markerSize = dimensionToCentimeters(options.size ?? "4pt");
  const markerLineWidth = dimensionToCentimeters(options["line width"] ?? "0.4pt");
  const position = numericOption(options.pos, 0.5);
  if (!Number.isFinite(markerSize) || !Number.isFinite(markerLineWidth) || !Number.isFinite(position)) {
    warn(diagnostics, `Could not resolve tkz-euclide segment mark options [${optional.content}]`);
    return { text: "", end: list.end };
  }

  const marks = [];
  for (const pair of pairs.filter(Boolean)) {
    const points = pair.map((name) => state.points.get(name));
    if (!points[0] || !points[1]) {
      warn(diagnostics, `Could not resolve tkz-euclide segment mark points (${pair.join(",")})`);
      continue;
    }
    if (count) {
      marks.push(...segmentMarkCommands(points[0], points[1], count, position, markerSize, markerLineWidth, markerOptions));
    } else {
      marks.push(segmentCustomMarkCommand(points[0], points[1], mark, position, options, markerOptions));
    }
  }
  return { text: marks.join("\n"), end: list.end };
}

function expandMarkAngle(source, afterName, state, diagnostics) {
  const optional = parseOptionalArg(source, afterName);
  const triple = parseParenthesizedArg(source, optional.end);
  const points = triple && parsePointTriple(triple.content);
  if (!triple || !points) return malformed(diagnostics, "tkzMarkAngle");
  return {
    text: expandMarkAngleTriple(points, optional.content, state, diagnostics),
    end: triple.end
  };
}

function expandMarkAngles(source, afterName, state, diagnostics) {
  const optional = parseOptionalArg(source, afterName);
  const triples = parseParenthesizedArg(source, optional.end);
  if (!triples) return malformed(diagnostics, "tkzMarkAngles");
  const pointTriples = splitTopLevelWhitespace(triples.content).map(parsePointTriple).filter(Boolean);
  if (!pointTriples.length) return malformed(diagnostics, "tkzMarkAngles");
  return {
    text: pointTriples.map((points) => expandMarkAngleTriple(points, optional.content, state, diagnostics)).filter(Boolean).join("\n"),
    end: triples.end
  };
}

function expandMarkRightAngle(source, afterName, state, diagnostics) {
  const optional = parseOptionalArg(source, afterName);
  const triple = parseParenthesizedArg(source, optional.end);
  const points = triple && parsePointTriple(triple.content);
  if (!triple || !points) return malformed(diagnostics, "tkzMarkRightAngle");
  return {
    text: expandMarkRightAngleTriple(points, optional.content, state, diagnostics),
    end: triple.end
  };
}

function expandMarkRightAngles(source, afterName, state, diagnostics) {
  const optional = parseOptionalArg(source, afterName);
  const triples = parseParenthesizedArg(source, optional.end);
  if (!triples) return malformed(diagnostics, "tkzMarkRightAngles");
  const pointTriples = splitTopLevelWhitespace(triples.content).map(parsePointTriple).filter(Boolean);
  if (!pointTriples.length) return malformed(diagnostics, "tkzMarkRightAngles");
  return {
    text: pointTriples.map((points) => expandMarkRightAngleTriple(points, optional.content, state, diagnostics)).filter(Boolean).join("\n"),
    end: triples.end
  };
}

function expandFillAngle(source, afterName, state, diagnostics) {
  const optional = parseOptionalArg(source, afterName);
  const triple = parseParenthesizedArg(source, optional.end);
  const points = triple && parsePointTriple(triple.content);
  if (!triple || !points) return malformed(diagnostics, "tkzFillAngle");
  return {
    text: expandFillAngleTriple(points, optional.content, state, diagnostics),
    end: triple.end
  };
}

function expandFillAngles(source, afterName, state, diagnostics) {
  const optional = parseOptionalArg(source, afterName);
  const triples = parseParenthesizedArg(source, optional.end);
  if (!triples) return malformed(diagnostics, "tkzFillAngles");
  const pointTriples = splitTopLevelWhitespace(triples.content).map(parsePointTriple).filter(Boolean);
  if (!pointTriples.length) return malformed(diagnostics, "tkzFillAngles");
  return {
    text: pointTriples.map((points) => expandFillAngleTriple(points, optional.content, state, diagnostics)).filter(Boolean).join("\n"),
    end: triples.end
  };
}

function expandFillAngleTriple(points, rawOptions, state, diagnostics) {
  const geometry = angleGeometry(points, state);
  if (!geometry) {
    warn(diagnostics, `Could not resolve tkzFillAngle points ${points.join(",")}`);
    return "";
  }
  const options = parseOptions(rawOptions);
  const sizeValue = resolveNumericMacros(options.size ?? "1", state);
  const size = dimensionToCentimeters(sizeValue);
  if (!Number.isFinite(size) || size <= 0) {
    warn(diagnostics, `Could not resolve tkzFillAngle size ${String(options.size ?? "1")}`);
    return "";
  }

  // tkz-euclide installs a default fill of the current line color at 10%.
  // The caller's TikZ options follow it so an explicit fill or shading wins.
  const pathOptions = [
    `fill=${state.lineStyle.color}!10`,
    ...optionParts(rawOptions)
      .filter((part) => part.key !== "size")
      .map((part) => part.raw)
  ].join(",");
  const radius = formatCentimeterDimension(size);
  return `\\path[${pathOptions}] (${geometry.centerName}) -- ($(${geometry.centerName})+(${formatNumber(geometry.start)}:${radius})$) arc (${formatNumber(geometry.start)}:${formatNumber(geometry.end)}:${radius}) -- cycle;`;
}

function expandMarkRightAngleTriple(names, rawOptions, state, diagnostics) {
  const [firstName, centerName, lastName] = names;
  const first = state.points.get(firstName);
  const center = state.points.get(centerName);
  const last = state.points.get(lastName);
  if (!first || !center || !last) {
    warn(diagnostics, `Could not resolve tkzMarkRightAngle points ${names.join(",")}`);
    return "";
  }

  const firstLength = distanceBetween(center, first);
  const lastLength = distanceBetween(center, last);
  if (firstLength < 1e-12 || lastLength < 1e-12) {
    warn(diagnostics, `tkzMarkRightAngle requires points distinct from ${centerName}`);
    return "";
  }

  const options = parseOptions(rawOptions);
  const size = dimensionToCentimeters(options.size ?? ".25");
  if (!Number.isFinite(size) || size <= 0) {
    warn(diagnostics, `Could not resolve tkzMarkRightAngle size ${String(options.size ?? ".25")}`);
    return "";
  }

  const firstUnit = {
    x: (first.x - center.x) / firstLength,
    y: (first.y - center.y) / firstLength
  };
  const lastUnit = {
    x: (last.x - center.x) / lastLength,
    y: (last.y - center.y) / lastLength
  };
  const drawOptions = optionParts(rawOptions)
    .filter((part) => !["size", "dotsize", "german"].includes(part.key))
    .map((part) => part.raw)
    .join(",");

  if (options.german === true) {
    const geometry = angleGeometry(names, state);
    if (!geometry) return "";
    const angle = (geometry.start + geometry.end) / 2;
    const dotRadius = dimensionToCentimeters(options.dotsize ?? "3pt") / 2;
    const dotColor = String(options.fill ?? options.color ?? (options.draw !== true ? options.draw : "black")).trim();
    return [
      `\\draw[${drawOptions}] ($(${centerName})+(${formatNumber(geometry.start)}:${formatCentimeterDimension(size)})$) arc (${formatNumber(geometry.start)}:${formatNumber(geometry.end)}:${formatCentimeterDimension(size)});`,
      `\\fill[fill=${dotColor}] ($(${centerName})+(${formatNumber(angle)}:${formatCentimeterDimension(size / 2)})$) circle (${formatCentimeterDimension(dotRadius)});`
    ].join("\n");
  }

  const firstCorner = {
    x: center.x + firstUnit.x * size,
    y: center.y + firstUnit.y * size
  };
  const oppositeCorner = {
    x: firstCorner.x + lastUnit.x * size,
    y: firstCorner.y + lastUnit.y * size
  };
  const lastCorner = {
    x: center.x + lastUnit.x * size,
    y: center.y + lastUnit.y * size
  };
  const coordinate = (point) => `(${formatNumber(point.x)},${formatNumber(point.y)})`;
  return `\\draw[${drawOptions}] (${centerName}) -- ${coordinate(firstCorner)} -- ${coordinate(oppositeCorner)} -- ${coordinate(lastCorner)} -- cycle;`;
}

function expandMarkAngleTriple(points, rawOptions, state, diagnostics) {
  const geometry = angleGeometry(points, state);
  if (!geometry) {
    warn(diagnostics, `Could not resolve tkzMarkAngle points ${points.join(",")}`);
    return "";
  }
  const options = parseOptions(rawOptions);
  const arc = String(options.arc ?? "l").trim();
  const mark = String(options.mark ?? "none").trim();
  const arcCount = tkzAngleArcCount(arc);
  if (!arcCount || !tkzAngleMarkIsSupported(mark)) {
    warnOnce(
      state,
      diagnostics,
      "tkzMarkAngle-variants",
      "tkz-euclide compatibility supports tkzMarkAngle arcs l, ll, lll and marks x, |, ||, |||, o, *, +; other mark variants remain deferred"
    );
  }
  const radius = normalizeBareCoordinateDimension(options.size ?? "1");
  const drawOptions = optionParts(rawOptions)
    .filter((part) => !["arc", "size", "mark", "mksize", "mkcolor", "mkpos", "fill"].includes(part.key))
    .map((part) => part.raw);
  drawOptions.push("fill=none");
  const radii = tkzAngleArcRadii(radius, options["line width"], arcCount || 1);
  const arcs = radii
    .map(
      (arcRadius) =>
        `\\draw[${drawOptions.join(",")}] ($(${geometry.centerName})+(${formatNumber(geometry.start)}:${arcRadius})$) arc (${formatNumber(geometry.start)}:${formatNumber(geometry.end)}:${arcRadius});`
    )
    .join("\n");
  const marker = tkzAngleMarkCommand(geometry, radius, mark, options);
  return [arcs, marker].filter(Boolean).join("\n");
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
  const nodeOptions = ["label angle style", ...optionParts(optional.content)
    .filter((part) => !["angle", "dist"].includes(part.key))
    .map((part) => part.raw)];
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
  const options = renderLabelStyleOptions(optional.content);
  return {
    text: `\\node[${options}] at (${point.content.trim()}) {${label.content}};`,
    end: label.end
  };
}

function expandLabelPoints(source, afterName, diagnostics) {
  const optional = parseOptionalArg(source, afterName);
  const list = parseParenthesizedArg(source, optional.end);
  if (!list) return malformed(diagnostics, "tkzLabelPoints");
  const options = renderLabelStyleOptions(optional.content);
  const pointNames = splitTopLevel(list.content, ",").map((name) => name.trim()).filter(Boolean);
  return {
    text: pointNames.map((name) => `\\node[${options}] at (${name}) {$${name}$};`).join("\n"),
    end: list.end
  };
}

function expandLabelSegment(source, afterName, diagnostics) {
  const optional = parseOptionalArg(source, afterName);
  const pair = parseParenthesizedArg(source, optional.end);
  const label = pair && parseRequiredArg(source, pair.end);
  const points = pair && parsePointPair(pair.content);
  if (!pair || !label || !points) return malformed(diagnostics, "tkzLabelSegment");
  return {
    text: renderLabelSegment(points, optional.content, label.content),
    end: label.end
  };
}

function expandLabelSegments(source, afterName, diagnostics) {
  const optional = parseOptionalArg(source, afterName);
  const list = parseParenthesizedArg(source, optional.end);
  const label = list && parseRequiredArg(source, list.end);
  if (!list || !label) return malformed(diagnostics, "tkzLabelSegments");

  const pairs = splitTopLevelWhitespace(list.content)
    .map(parsePointPair)
    .filter(Boolean);
  if (pairs.length === 0) return malformed(diagnostics, "tkzLabelSegments");
  return {
    text: pairs.map((points) => renderLabelSegment(points, optional.content, label.content)).join("\n"),
    end: label.end
  };
}

function renderLabelSegment(points, rawOptions, label) {
  return `\\path (${points[0]}) to node[${renderLabelStyleOptions(rawOptions)}] {${label}} (${points[1]});`;
}

function renderLabelStyleOptions(rawOptions) {
  return ["label style", ...optionParts(rawOptions).map((part) => part.raw)].join(",");
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

function renderSegmentMarkOptions(rawOptions) {
  const options = parseOptions(rawOptions);
  const color = String(options.color ?? options.draw ?? "black").trim();
  const width = normalizeBarePointDimension(options["line width"] ?? "0.4pt");
  return `draw=${color},line width=${width}`;
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

function tkzCircleGeometry([centerName, throughName], rawOptions, state, diagnostics) {
  const center = state.points.get(centerName);
  const through = state.points.get(throughName);
  if (!center || !through) {
    warn(diagnostics, `Could not resolve tkzDrawCircle points (${centerName},${throughName})`);
    return null;
  }
  const boundaryRadius = distanceBetween(center, through);
  if (boundaryRadius < 1e-12) {
    warn(diagnostics, `tkzDrawCircle requires distinct points (${centerName},${throughName})`);
    return null;
  }
  const orthogonal = String(rawOptions || "").match(/(?:^|,)\s*orthogonal\s+through\s*=\s*([^,]+?)\s+and\s+([^,]+?)\s*(?=,|$)/i);
  if (!orthogonal) return { center, radius: boundaryRadius, centerName, throughName };

  const firstName = orthogonal[1].trim();
  const secondName = orthogonal[2].trim();
  const first = state.points.get(firstName);
  const second = state.points.get(secondName);
  if (!first || !second) {
    warn(diagnostics, `Could not resolve tkzDrawCircle orthogonal-through points ${firstName} and ${secondName}`);
    return null;
  }
  const inverse = inversePointOnCircle(first, center, boundaryRadius);
  const orthogonalCenter = circumcenter(inverse, first, second);
  if (!orthogonalCenter) {
    warn(diagnostics, `tkzDrawCircle orthogonal-through points are collinear: ${firstName}, ${secondName}`);
    return null;
  }
  return {
    center: orthogonalCenter,
    radius: distanceBetween(orthogonalCenter, first),
    centerName: null,
    throughName: firstName
  };
}

function tkzCircleDrawOptions(rawOptions, state) {
  const options = optionParts(rawOptions)
    .filter((part) => part.key.toLowerCase() !== "orthogonal through")
    .map((part) => part.raw)
    .join(",");
  const defaults = [
    `color=${state.circleStyle.color}`,
    `line width=${state.circleStyle.lineWidth}`
  ];
  return [...defaults, options].filter(Boolean).join(",");
}

function renderTkzCircle(circle, rawOptions, clip) {
  const options = withTkzCircleClip(rawOptions, clip);
  if (!clip || circlesCoincide(circle, clip)) return renderFullTkzCircle(circle, options);
  const overlap = circleOverlap(circle, clip);
  if (overlap.kind === "inside") return renderFullTkzCircle(circle, options);
  if (overlap.kind === "contains" && hasFillOption(options)) return renderFullTkzCircle(clip, options);
  if (overlap.kind !== "intersect") return "";

  const subjectArc = insideCircleArc(circle, clip, overlap.subjectAngles[0], overlap.subjectAngles[1]);
  if (!hasFillOption(options)) return renderTkzCircleArc(circle, options, subjectArc);

  const subjectStart = pointOnCircle(circle, subjectArc.start);
  const subjectEnd = pointOnCircle(circle, subjectArc.end);
  const clipStart = angleOfPoint(clip.center, subjectEnd);
  const clipEnd = angleOfPoint(clip.center, subjectStart);
  const clipArc = insideCircleArc(clip, circle, clipStart, clipEnd);
  return `\\draw${options ? `[${options}]` : ""} (${formatNumber(subjectStart.x)},${formatNumber(subjectStart.y)}) arc (${formatNumber(subjectArc.start)}:${formatNumber(subjectArc.end)}:${formatNumber(circle.radius)}cm) arc (${formatNumber(clipArc.start)}:${formatNumber(clipArc.end)}:${formatNumber(clip.radius)}cm) -- cycle;`;
}

function withTkzCircleClip(rawOptions, clip) {
  if (!clip) return rawOptions;
  const clipOption = `tikzkit clip circle={${formatNumber(clip.center.x)}cm,${formatNumber(clip.center.y)}cm,${formatNumber(clip.radius)}cm}`;
  return [rawOptions, clipOption].filter(Boolean).join(",");
}

function renderFullTkzCircle(circle, rawOptions) {
  const center = circle.centerName ? `(${circle.centerName})` : `(${formatNumber(circle.center.x)},${formatNumber(circle.center.y)})`;
  return `\\draw${rawOptions ? `[${rawOptions}]` : ""} ${center} circle (${formatNumber(circle.radius)}cm);`;
}

function renderTkzCircleArc(circle, rawOptions, arc) {
  const start = pointOnCircle(circle, arc.start);
  return `\\draw${rawOptions ? `[${rawOptions}]` : ""} (${formatNumber(start.x)},${formatNumber(start.y)}) arc (${formatNumber(arc.start)}:${formatNumber(arc.end)}:${formatNumber(circle.radius)}cm);`;
}

function circleOverlap(subject, clip) {
  const deltaX = clip.center.x - subject.center.x;
  const deltaY = clip.center.y - subject.center.y;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance + subject.radius <= clip.radius + 1e-9) return { kind: "inside" };
  if (distance + clip.radius <= subject.radius + 1e-9) return { kind: "contains" };
  if (distance >= subject.radius + clip.radius - 1e-9 || distance < 1e-12) return { kind: "disjoint" };
  const along = (subject.radius ** 2 - clip.radius ** 2 + distance ** 2) / (2 * distance);
  const heightSquared = subject.radius ** 2 - along ** 2;
  if (heightSquared <= 1e-12) return { kind: "disjoint" };
  const base = {
    x: subject.center.x + (deltaX * along) / distance,
    y: subject.center.y + (deltaY * along) / distance
  };
  const height = Math.sqrt(heightSquared);
  const first = { x: base.x - (deltaY * height) / distance, y: base.y + (deltaX * height) / distance };
  const second = { x: base.x + (deltaY * height) / distance, y: base.y - (deltaX * height) / distance };
  return {
    kind: "intersect",
    subjectAngles: [angleOfPoint(subject.center, first), angleOfPoint(subject.center, second)]
  };
}

function insideCircleArc(circle, other, start, end) {
  const counterClockwiseSweep = normalizedPositiveAngle(end - start);
  const middle = start + counterClockwiseSweep / 2;
  if (distanceBetween(pointOnCircle(circle, middle), other.center) <= other.radius + 1e-9) {
    return { start, end: start + counterClockwiseSweep };
  }
  return { start: end, end: end + 360 - counterClockwiseSweep };
}

function hasFillOption(rawOptions) {
  const fill = parseOptions(rawOptions).fill;
  return fill !== undefined && fill !== false && fill !== "none";
}

function circlesCoincide(left, right) {
  return distanceBetween(left.center, right.center) < 1e-9 && Math.abs(left.radius - right.radius) < 1e-9;
}

function inversePointOnCircle(point, center, radius) {
  const deltaX = point.x - center.x;
  const deltaY = point.y - center.y;
  const distanceSquared = deltaX * deltaX + deltaY * deltaY;
  const factor = (radius * radius) / distanceSquared;
  return { x: center.x + deltaX * factor, y: center.y + deltaY * factor };
}

function circumcenter(first, second, third) {
  const ax = first.x;
  const ay = first.y;
  const bx = second.x;
  const by = second.y;
  const cx = third.x;
  const cy = third.y;
  const denominator = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(denominator) < 1e-12) return null;
  const firstLength = ax * ax + ay * ay;
  const secondLength = bx * bx + by * by;
  const thirdLength = cx * cx + cy * cy;
  return {
    x: roundNumber((firstLength * (by - cy) + secondLength * (cy - ay) + thirdLength * (ay - by)) / denominator, 10),
    y: roundNumber((firstLength * (cx - bx) + secondLength * (ax - cx) + thirdLength * (bx - ax)) / denominator, 10)
  };
}

function incenter(first, second, third) {
  const oppositeFirst = distanceBetween(second, third);
  const oppositeSecond = distanceBetween(first, third);
  const oppositeThird = distanceBetween(first, second);
  const perimeter = oppositeFirst + oppositeSecond + oppositeThird;
  if (perimeter < 1e-12) return null;
  return {
    x: roundNumber((oppositeFirst * first.x + oppositeSecond * second.x + oppositeThird * third.x) / perimeter, 10),
    y: roundNumber((oppositeFirst * first.y + oppositeSecond * second.y + oppositeThird * third.y) / perimeter, 10)
  };
}

function internalAngleBisectorPoint(first, vertex, third, factor = 1, normalizedLength = null) {
  const firstLength = distanceBetween(vertex, first);
  const thirdLength = distanceBetween(vertex, third);
  if (firstLength < 1e-12 || thirdLength < 1e-12) return null;

  // Native tkz-euclide duplicates |vertex-first| on vertex-third, then takes
  // the midpoint with first. This is the internal unit-vector bisector.
  const direction = {
    x: (first.x - vertex.x) / firstLength + (third.x - vertex.x) / thirdLength,
    y: (first.y - vertex.y) / firstLength + (third.y - vertex.y) / thirdLength
  };
  const directionLength = Math.hypot(direction.x, direction.y);
  if (directionLength < 1e-12) return null;
  const scale = normalizedLength === null
    ? (factor * firstLength) / 2
    : normalizedLength / directionLength;
  return {
    x: roundNumber(vertex.x + direction.x * scale, 10),
    y: roundNumber(vertex.y + direction.y * scale, 10)
  };
}

function externalAngleBisectorPoint(first, vertex, third, factor = 1, normalizedLength = null) {
  const internalPoint = internalAngleBisectorPoint(first, vertex, third);
  if (!internalPoint) return null;
  // tkzDefBisectorOutLine rotates its duplicate-segment/midpoint result by
  // +90 degrees around the vertex. That gives the exterior bisector selected
  // by the ordered (first, vertex, third) input triple.
  const vector = {
    x: -(internalPoint.y - vertex.y),
    y: internalPoint.x - vertex.x
  };
  const vectorLength = Math.hypot(vector.x, vector.y);
  if (vectorLength < 1e-12) return null;
  const scale = normalizedLength === null ? factor : normalizedLength / vectorLength;
  return {
    x: roundNumber(vertex.x + vector.x * scale, 10),
    y: roundNumber(vertex.y + vector.y * scale, 10)
  };
}

function symmedianPoint(first, vertex, third, factor = 1, normalizedLength = null) {
  // TeX Live tkzDefSymmedianLine first constructs the unscaled internal
  // bisector, then mirrors the opposite-side midpoint across that line.
  const bisectorPoint = internalAngleBisectorPoint(first, vertex, third);
  const oppositeMidpoint = midpoint(first, third);
  const reflectedProjection = bisectorPoint
    ? orthogonalProjection(oppositeMidpoint, vertex, bisectorPoint)
    : null;
  if (!reflectedProjection) return null;

  const vector = {
    x: 2 * reflectedProjection.x - oppositeMidpoint.x - vertex.x,
    y: 2 * reflectedProjection.y - oppositeMidpoint.y - vertex.y
  };
  const vectorLength = Math.hypot(vector.x, vector.y);
  if (vectorLength < 1e-12) return null;
  const scale = normalizedLength === null ? factor : normalizedLength / vectorLength;
  return {
    x: roundNumber(vertex.x + vector.x * scale, 10),
    y: roundNumber(vertex.y + vector.y * scale, 10)
  };
}

function mediatorLinePoints(first, second, factor = 1, normalizedLength = null) {
  const center = midpoint(first, second);
  const deltaX = second.x - first.x;
  const deltaY = second.y - first.y;
  const unscaledVector = {
    x: (-Math.sqrt(3) * deltaY) / 2,
    y: (Math.sqrt(3) * deltaX) / 2
  };
  const vectorLength = Math.hypot(unscaledVector.x, unscaledVector.y);
  if (vectorLength < 1e-12) return null;
  const scale = normalizedLength === null ? factor : normalizedLength / vectorLength;
  const vector = {
    x: unscaledVector.x * scale,
    y: unscaledVector.y * scale
  };
  // tkzDefEquilateral(first, second) rotates second around first by +60°;
  // reversing the inputs provides the second, clockwise endpoint.
  return [
    {
      x: roundNumber(center.x + vector.x, 10),
      y: roundNumber(center.y + vector.y, 10)
    },
    {
      x: roundNumber(center.x - vector.x, 10),
      y: roundNumber(center.y - vector.y, 10)
    }
  ];
}

function orthogonalProjection(point, first, second) {
  const deltaX = second.x - first.x;
  const deltaY = second.y - first.y;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  if (lengthSquared < 1e-12) return null;
  const progress = ((point.x - first.x) * deltaX + (point.y - first.y) * deltaY) / lengthSquared;
  return {
    x: roundNumber(first.x + progress * deltaX, 10),
    y: roundNumber(first.y + progress * deltaY, 10)
  };
}

function eulerLinePoints(first, second, third) {
  // This mirrors tkzDefEulerLine: intersect two altitude lines for H, then
  // take the circumcenter of the three side midpoints for the nine-point N.
  const footOnFirstSecond = orthogonalProjection(third, first, second);
  const footOnFirstThird = orthogonalProjection(second, first, third);
  const orthocenter = footOnFirstSecond && footOnFirstThird
    ? lineIntersection(second, footOnFirstThird, third, footOnFirstSecond)
    : null;
  if (!orthocenter) return null;
  const midpointFirstSecond = midpoint(first, second);
  const midpointFirstThird = midpoint(first, third);
  const midpointSecondThird = midpoint(second, third);
  const eulerCenter = circumcenter(midpointSecondThird, midpointFirstThird, midpointFirstSecond);
  return eulerCenter ? [orthocenter, eulerCenter] : null;
}

function tangentDirectionPoint(center, tangentPoint) {
  const dx = center.x - tangentPoint.x;
  const dy = center.y - tangentPoint.y;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length < 1e-12) return null;
  return {
    x: roundNumber(tangentPoint.x + dy / length, 10),
    y: roundNumber(tangentPoint.y - dx / length, 10)
  };
}

function tangentContactsFromExternal(center, radius, external) {
  if (!Number.isFinite(radius) || radius <= 0) return null;
  const deltaX = external.x - center.x;
  const deltaY = external.y - center.y;
  const distanceSquared = deltaX * deltaX + deltaY * deltaY;
  if (distanceSquared <= radius * radius + 1e-12) return null;

  const baseFactor = (radius * radius) / distanceSquared;
  const offsetFactor = (radius * Math.sqrt(distanceSquared - radius * radius)) / distanceSquared;
  const base = {
    x: center.x + baseFactor * deltaX,
    y: center.y + baseFactor * deltaY
  };
  const offset = {
    x: -offsetFactor * deltaY,
    y: offsetFactor * deltaX
  };
  // TeX swaps tkzInterCCR's raw contacts until the directed angle
  // (external point, first contact, center) is counterclockwise and < 180°.
  return {
    first: {
      x: roundNumber(base.x - offset.x, 10),
      y: roundNumber(base.y - offset.y, 10)
    },
    second: {
      x: roundNumber(base.x + offset.x, 10),
      y: roundNumber(base.y + offset.y, 10)
    },
    midpoint: {
      x: roundNumber((center.x + external.x) / 2, 10),
      y: roundNumber((center.y + external.y) / 2, 10)
    }
  };
}

function midpoint(first, second) {
  return {
    x: roundNumber((first.x + second.x) / 2, 10),
    y: roundNumber((first.y + second.y) / 2, 10)
  };
}

function pointOnCircle(circle, angle) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: circle.center.x + circle.radius * Math.cos(radians),
    y: circle.center.y + circle.radius * Math.sin(radians)
  };
}

function angleOfPoint(center, point) {
  return (Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI;
}

function normalizedPositiveAngle(angle) {
  const result = angle % 360;
  return result < 0 ? result + 360 : result;
}

function distanceBetween(first, second) {
  return Math.hypot(second.x - first.x, second.y - first.y);
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

function lineCircleIntersections(first, second, center, radius) {
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared < 1e-12) return null;

  const projection = ((center.x - first.x) * dx + (center.y - first.y) * dy) / lengthSquared;
  const closest = {
    x: first.x + projection * dx,
    y: first.y + projection * dy
  };
  const distanceSquared = (center.x - closest.x) ** 2 + (center.y - closest.y) ** 2;
  const remaining = radius * radius - distanceSquared;
  if (remaining < -1e-10) return null;

  const offset = Math.sqrt(Math.max(0, remaining) / lengthSquared);
  return [
    {
      x: roundNumber(first.x + (projection - offset) * dx, 10),
      y: roundNumber(first.y + (projection - offset) * dy, 10)
    },
    {
      x: roundNumber(first.x + (projection + offset) * dx, 10),
      y: roundNumber(first.y + (projection + offset) * dy, 10)
    }
  ];
}

function orderLineCircleIntersections(intersections, lineStart, center, options, state) {
  let [first, second] = intersections;
  const nearestTo = (target) => {
    if (!target || distanceBetween(target, first) < distanceBetween(target, second)) return;
    [first, second] = [second, first];
  };

  if (options.near === true || String(options.near).trim().toLowerCase() === "true") {
    nearestTo(lineStart);
  } else if (typeof options.common === "string" && options.common.trim()) {
    nearestTo(state.points.get(options.common.trim()));
  } else if (typeof options["next to"] === "string" && options["next to"].trim()) {
    nearestTo(state.points.get(options["next to"].trim()));
  }

  // tkzInterLCR produces the point opposite the line direction first and
  // the point in the line direction second. tkzInterLC preserves that order
  // unless an explicit near/common/next to selector asks for a reordering.

  return [first, second];
}

function numericOption(value, fallback) {
  if (value === undefined || value === null || value === true || String(value).trim() === "") return fallback;
  const number = evaluateMath(String(value).trim());
  return Number.isFinite(number) ? number : fallback;
}

function isEnabledOption(options, key) {
  const value = options?.[key];
  return value === true || String(value).trim().toLowerCase() === "true";
}

function resolveNumericMacros(value, state) {
  return String(value ?? "").replace(/\\([A-Za-z@]+)/g, (match, name) => {
    const number = state.numericMacros.get(name);
    return Number.isFinite(number) ? formatNumber(number) : match;
  });
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

function tkzAngleArcCount(arc) {
  if (arc === "l") return 1;
  if (arc === "ll") return 2;
  if (arc === "lll") return 3;
  return 0;
}

function tkzAngleMarkIsSupported(mark) {
  return new Set(["none", "x", "|", "||", "|||", "s|", "s||", "s|||", "z", "s", "o", "oo", "*", "+"]).has(String(mark || "none").trim());
}

function tkzAngleMarkCommand(geometry, radius, mark, options = {}) {
  if (mark === "none" || !tkzAngleMarkIsSupported(mark)) return "";
  const position = Math.max(0, Math.min(1, numericOption(options.mkpos, 0.5)));
  const angle = geometry.start + (geometry.end - geometry.start) * position;
  const color = String(options.mkcolor ?? "black").trim();
  const size = normalizeBarePointDimension(options.mksize ?? "4pt");
  const tangent = angle + 90;
  return `\\draw[draw=${color},mark size=${size},mark options={rotate=${formatNumber(tangent)}}] plot[mark=${mark}] coordinates {($(${geometry.centerName})+(${formatNumber(angle)}:${radius})$)};`;
}

function tkzSegmentMarkCount(mark) {
  if (mark === "|") return 1;
  if (mark === "||") return 2;
  if (mark === "|||") return 3;
  return 0;
}

function segmentMarkCommands(from, to, count, position, size, lineWidth, options) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-12) return [];

  const tangent = { x: dx / length, y: dy / length };
  const normal = { x: -tangent.y, y: tangent.x };
  const center = {
    x: from.x + dx * position,
    y: from.y + dy * position
  };
  const offsets = count === 1
    ? [0]
    : count === 2
      ? [-2 * lineWidth, 2 * lineWidth]
      : [-3 * lineWidth, 0, 3 * lineWidth];

  return offsets.map((offset) => {
    const anchor = {
      x: center.x + tangent.x * offset,
      y: center.y + tangent.y * offset
    };
    const start = {
      x: anchor.x + normal.x * size,
      y: anchor.y + normal.y * size
    };
    const end = {
      x: anchor.x - normal.x * size,
      y: anchor.y - normal.y * size
    };
    return `\\draw[${options}] (${formatNumber(start.x)},${formatNumber(start.y)}) -- (${formatNumber(end.x)},${formatNumber(end.y)});`;
  });
}

function segmentCustomMarkCommand(from, to, mark, position, options, drawOptions) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const center = {
    x: from.x + dx * position,
    y: from.y + dy * position
  };
  const markerSize = normalizeBarePointDimension(options.size ?? "4pt");
  return `\\draw[${drawOptions},mark size=${markerSize},mark options={rotate=${formatNumber(angle)}}] plot[mark=${mark}] coordinates {(${formatNumber(center.x)},${formatNumber(center.y)})};`;
}

function tkzAngleArcRadii(radius, lineWidth, count) {
  if (count < 2) return [radius];
  const radiusCm = dimensionToCentimeters(radius);
  // tkz-euclide offsets multi-arcs by 2.5\pgflinewidth. PGF's default
  // \pgflinewidth is 0.4pt, even when the caller did not set line width.
  const lineWidthCm = dimensionToCentimeters(lineWidth ?? "0.4pt");
  if (!Number.isFinite(radiusCm) || !Number.isFinite(lineWidthCm)) return [radius];

  const gapCm = 2.5 * lineWidthCm;
  if (count === 2) return [formatCentimeterDimension(radiusCm - gapCm), formatCentimeterDimension(radiusCm + gapCm)];
  return [
    formatCentimeterDimension(radiusCm),
    formatCentimeterDimension(radiusCm - gapCm),
    formatCentimeterDimension(radiusCm + gapCm)
  ];
}

function dimensionToCentimeters(value) {
  const match = normalizeDimensionWhitespace(value).match(/^([-+]?(?:\d+\.?\d*|\.\d+))(pt|mm|cm|in)?$/i);
  if (!match) return Number.NaN;
  const numeric = Number(match[1]);
  const unit = (match[2] || "cm").toLowerCase();
  const scale = { pt: 1 / 28.45274, mm: 0.1, cm: 1, in: 2.54 }[unit];
  return Number.isFinite(numeric) && scale ? numeric * scale : Number.NaN;
}

function formatCentimeterDimension(value) {
  return `${formatNumber(value)}cm`;
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
