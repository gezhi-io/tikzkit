import { tikzCommand as addplotCommand } from "./addplot.js";
import { tikzCommand as axisCommand } from "./axis.js";
import { tikzCommand as coordinateCommand } from "./coordinate.js";
import { tikzCommand as drawCommand } from "./draw.js";
import { tikzCommand as nodeCommand } from "./node.js";
import { tikzCommand as pathCommand } from "./path.js";
import { tikzCommand as tikzpictureCommand } from "./tikzpicture.js";

const tikzCommands = Object.freeze([
  tikzpictureCommand,
  drawCommand,
  pathCommand,
  nodeCommand,
  coordinateCommand,
  axisCommand,
  addplotCommand
].map(normalizeTikzCommand));

export const tikzCommandCatalog = Object.freeze(Object.fromEntries(tikzCommands.map((command) => [command.name, command])));
export const knownTikzCommands = Object.freeze(tikzCommands.map((command) => command.name));
export const supportedTikzCommands = Object.freeze(
  tikzCommands.filter((command) => command.status && command.status !== "unsupported").map((command) => command.name)
);

export { tikzCommand as addplotCommand } from "./addplot.js";
export { tikzCommand as axisCommand } from "./axis.js";
export { tikzCommand as coordinateCommand } from "./coordinate.js";
export { tikzCommand as drawCommand } from "./draw.js";
export { tikzCommand as nodeCommand } from "./node.js";
export { tikzCommand as pathCommand } from "./path.js";
export { tikzCommand as tikzpictureCommand } from "./tikzpicture.js";

function normalizeTikzCommand(command) {
  return Object.freeze({
    ...command,
    implementedBy: Object.freeze([...(command.implementedBy || [])]),
    aliases: Object.freeze([...(command.aliases || [])]),
    options: Object.freeze((command.options || []).map((option) => Object.freeze({ ...option }))),
    examples: Object.freeze([...(command.examples || [])])
  });
}
