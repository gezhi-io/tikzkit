import { curveToCommand } from "../../engine/pathBuilder.js";
import { roundPoint } from "../../engine/math.js";

const FIRST_CONTROL_X = 0.1125;
const FIRST_CONTROL_Y = 0.225;
const SECOND_CONTROL_X = 0.5;
const THIRD_CONTROL_X = 0.8875;
const THIRD_CONTROL_Y = 0.775;

export function pgfParabolaCommands(start, bend, end, transform = null) {
  const localStart = transform ? inverseTransformPoint(start, transform) : start;
  const localBend = transform ? inverseTransformPoint(bend, transform) : bend;
  const localEnd = transform ? inverseTransformPoint(end, transform) : end;
  const localCommands = pgfLocalParabolaCommands(localStart, localBend, localEnd);
  return transform ? localCommands.map((command) => transformCurveCommand(command, transform)) : localCommands;
}

function pgfLocalParabolaCommands(start, bend, end) {
  const commands = [];
  const first = relativeVector(start, bend);
  if (!isZeroVector(first)) {
    commands.push(curveToCommand(
      offsetPoint(start, FIRST_CONTROL_X * first.x, FIRST_CONTROL_Y * first.y),
      offsetPoint(start, SECOND_CONTROL_X * first.x, first.y),
      roundPoint(bend)
    ));
  }

  const second = relativeVector(bend, end);
  if (!isZeroVector(second)) {
    commands.push(curveToCommand(
      offsetPoint(bend, SECOND_CONTROL_X * second.x, 0),
      offsetPoint(bend, THIRD_CONTROL_X * second.x, THIRD_CONTROL_Y * second.y),
      roundPoint(end)
    ));
  }
  return commands;
}

function transformCurveCommand(command, transform) {
  const c1 = transformPoint({ x: command.x1, y: command.y1 }, transform);
  const c2 = transformPoint({ x: command.x2, y: command.y2 }, transform);
  const end = transformPoint({ x: command.x, y: command.y }, transform);
  return curveToCommand(c1, c2, end);
}

function transformPoint(point, transform) {
  return roundPoint({
    x: point.x * transform.a + point.y * transform.c + transform.x,
    y: point.x * transform.b + point.y * transform.d + transform.y
  });
}

function inverseTransformPoint(point, transform) {
  const determinant = transform.a * transform.d - transform.b * transform.c;
  if (Math.abs(determinant) < 1e-12) return roundPoint(point);
  const x = point.x - transform.x;
  const y = point.y - transform.y;
  return roundPoint({
    x: (transform.d * x - transform.c * y) / determinant,
    y: (-transform.b * x + transform.a * y) / determinant
  });
}

function relativeVector(from, to) {
  return { x: to.x - from.x, y: to.y - from.y };
}

function offsetPoint(point, x, y) {
  return roundPoint({ x: point.x + x, y: point.y + y });
}

function isZeroVector(vector) {
  return Math.abs(vector.x) < 1e-12 && Math.abs(vector.y) < 1e-12;
}
