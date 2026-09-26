import { parseDimension } from "../../engine/math.js";
import { parseFinitePgfLength } from "../../engine/units.js";
import { tikzBoolean } from "../../engine/options.js";
import { polylineLength, pointOnPolyline } from "../decorations/pathGeometry.js";
import { appendNativeSnakePolyline, appendNativeZigzagPolyline } from "./decorations.pathmorphing.js";

export const tikzLibrary = {
  "name": "snakes",
  "status": "partial",
  "implementedBy": "src/tikz/libraries/snakes.js:legacySnakeSpec/applyLegacySnakePath/appendLegacySnakeLine",
  "localSourceReviewed": true,
  "features": [
    "legacy snake and snake=zigzag path options",
    "legacy line/gap before, after, and around snake controls",
    "legacy mirror snake and raise snake transforms"
  ],
  "implements": [
    "legacy snakes compatibility subset"
  ],
  "notes": "MacTeX's deprecated snakes library forwards to decorations, but its legacy `snake` option still morphs every individual `--` command. TikZKit maps the default to zigzag and supports snake=snake, segment amplitude/length, mirror/raise, and line/gap before/after/around controls. Custom pgfdeclaresnake states and old triangle object shapes remain deferred."
};

export function legacySnakeSpec(pathOptions, env) {
  if (pathOptions.snake === undefined || pathOptions.snake === false) return null;
  const requested = String(pathOptions.snake === true ? "" : pathOptions.snake).trim().toLowerCase();
  if (requested === "none") return null;
  const mode = requested === "" || requested === "zigzag" ? "zigzag" : requested === "snake" ? "snake" : null;
  if (!mode) return null;

  const defaultAmplitude = parseDimension("2.5pt", env.variables);
  const defaultSegmentLength = parseDimension("10pt", env.variables);
  const minimumSegmentLength = parseDimension("1pt", env.variables);
  const around = legacySnakeEndpointOptions(pathOptions, "around", env);
  const before = around || legacySnakeEndpointOptions(pathOptions, "before", env);
  const after = around || legacySnakeEndpointOptions(pathOptions, "after", env);

  return {
    mode,
    amplitude: Math.max(0, parseFinitePgfLength(pathOptions["segment amplitude"] ?? "2.5pt", env, defaultAmplitude)),
    segmentLength: Math.max(
      minimumSegmentLength,
      parseFinitePgfLength(pathOptions["segment length"] ?? "10pt", env, defaultSegmentLength)
    ),
    before,
    after,
    mirrored: tikzBoolean(pathOptions["mirror snake"]),
    raise: parseFinitePgfLength(pathOptions["raise snake"] ?? "0", env, 0)
  };
}

function legacySnakeEndpointOptions(pathOptions, position, env) {
  const lineKey = `line ${position} snake`;
  const gapKey = `gap ${position} snake`;
  if (pathOptions[lineKey] !== undefined) {
    return { type: "line", length: Math.max(0, parseFinitePgfLength(pathOptions[lineKey], env, 0)) };
  }
  if (pathOptions[gapKey] !== undefined) {
    return { type: "gap", length: Math.max(0, parseFinitePgfLength(pathOptions[gapKey], env, 0)) };
  }
  return null;
}

export function applyLegacySnakePath(commands, spec) {
  const morphed = [];
  let current = null;
  let start = null;

  for (const command of commands) {
    if (command.type === "moveTo") {
      morphed.push(command);
      current = { x: command.x, y: command.y };
      start = current;
      continue;
    }
    if (command.type === "lineTo" && current) {
      appendLegacySnakeLine(morphed, current, { x: command.x, y: command.y }, spec);
      current = { x: command.x, y: command.y };
      continue;
    }
    if (command.type === "closePath" && current && start) {
      appendLegacySnakeLine(morphed, current, start, spec);
      morphed.push(command);
      current = start;
      continue;
    }
    morphed.push(command);
    if ("x" in command) current = { x: command.x, y: command.y };
  }

  return morphed;
}

function appendLegacySnakeLine(commands, from, to, spec) {
  const points = [from, to];
  const length = polylineLength(points);
  if (length < 1e-12 || spec.amplitude <= 0) {
    commands.push({ type: "lineTo", x: to.x, y: to.y });
    return;
  }

  const beforeLength = Math.min(length, spec.before?.length ?? 0);
  const afterLength = Math.min(
    Math.max(0, length - beforeLength),
    spec.after?.length ?? 0
  );
  const activeLength = length - beforeLength - afterLength;
  const normalSign = spec.mirrored ? -1 : 1;

  if (beforeLength > 1e-12) {
    const beforeEnd = pointOnPolyline(points, beforeLength);
    if (spec.before?.type === "gap") commands.push({ type: "moveTo", x: beforeEnd.x, y: beforeEnd.y });
    else commands.push({ type: "lineTo", x: beforeEnd.x, y: beforeEnd.y });
  }

  if (activeLength > 1e-12) {
    if (spec.mode === "snake") {
      appendNativeSnakePolyline(
        commands,
        points,
        spec.amplitude,
        spec.segmentLength,
        beforeLength,
        activeLength,
        normalSign,
        spec.raise,
        false
      );
    } else {
      appendNativeZigzagPolyline(commands, points, spec.amplitude, spec.segmentLength, beforeLength, activeLength, normalSign, spec.raise);
    }
  }

  if (afterLength > 1e-12) {
    if (spec.after?.type === "gap") commands.push({ type: "moveTo", x: to.x, y: to.y });
    else commands.push({ type: "lineTo", x: to.x, y: to.y });
  } else if (activeLength < 1e-12) {
    commands.push({ type: "lineTo", x: to.x, y: to.y });
  }
}
