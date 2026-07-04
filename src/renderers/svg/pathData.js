export function svgPathData(commands = [], unit = 1) {
  return commands
    .map((command) => {
      if (command.type === "moveTo") return `M ${format(command.x * unit)} ${format(-command.y * unit)}`;
      if (command.type === "lineTo") return `L ${format(command.x * unit)} ${format(-command.y * unit)}`;
      if (command.type === "curveTo") {
        return `C ${format(command.x1 * unit)} ${format(-command.y1 * unit)} ${format(command.x2 * unit)} ${format(
          -command.y2 * unit
        )} ${format(command.x * unit)} ${format(-command.y * unit)}`;
      }
      if (command.type === "quadTo") {
        return `Q ${format(command.x1 * unit)} ${format(-command.y1 * unit)} ${format(command.x * unit)} ${format(
          -command.y * unit
        )}`;
      }
      if (command.type === "closePath") return "Z";
      return "";
    })
    .filter(Boolean)
    .join(" ");
}

function format(value) {
  const rounded = Math.round((Number(value) + Number.EPSILON) * 1e6) / 1e6;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}
