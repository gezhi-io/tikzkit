import { lineToCommand } from "../../engine/pathBuilder.js";

export const tikzLibrary = {
  name: "decorations.fractals",
  status: "builtin",
  implementedBy: [
    "src/frontend/parser.js:parseDecoratePathSegment",
    "src/tikz/libraries/decorations.fractals.js:applyKochSnowflakeDecoration"
  ],
  features: [
    "nested decorate path operation",
    "Koch snowflake recursive segment replacement"
  ],
  implements: [
    "nested decorate path operation",
    "Koch snowflake recursive segment replacement"
  ]
};

export function applyKochSnowflakeDecoration(commands) {
  const decorated = [];
  let current = null;
  let start = null;
  for (const command of commands) {
    if (command.type === "moveTo") {
      current = { x: command.x, y: command.y };
      start = current;
      decorated.push(command);
      continue;
    }
    if (command.type === "lineTo" && current) {
      appendKochSnowflakeLine(decorated, current, { x: command.x, y: command.y });
      current = { x: command.x, y: command.y };
      continue;
    }
    if (command.type === "closePath" && current && start) {
      appendKochSnowflakeLine(decorated, current, start);
      decorated.push(command);
      current = start;
      continue;
    }
    decorated.push(command);
    if ("x" in command && "y" in command) current = { x: command.x, y: command.y };
  }
  return decorated;
}

function appendKochSnowflakeLine(commands, from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const normalScale = Math.sqrt(3) / 6;
  commands.push(
    lineToCommand({ x: from.x + dx / 3, y: from.y + dy / 3 }),
    lineToCommand({
      x: from.x + dx / 2 - dy * normalScale,
      y: from.y + dy / 2 + dx * normalScale
    }),
    lineToCommand({ x: from.x + (2 * dx) / 3, y: from.y + (2 * dy) / 3 }),
    lineToCommand(to)
  );
}
