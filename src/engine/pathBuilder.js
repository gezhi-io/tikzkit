export function createPathBuilder() {
  const commands = [];
  return {
    commands,
    moveTo(x, y) {
      commands.push({ type: "moveTo", x, y });
      return this;
    },
    lineTo(x, y) {
      commands.push({ type: "lineTo", x, y });
      return this;
    },
    curveTo(x1, y1, x2, y2, x, y) {
      commands.push({ type: "curveTo", x1, y1, x2, y2, x, y });
      return this;
    },
    quadTo(x1, y1, x, y) {
      commands.push({ type: "quadTo", x1, y1, x, y });
      return this;
    },
    closePath() {
      commands.push({ type: "closePath" });
      return this;
    },
    build() {
      return [...commands];
    }
  };
}
