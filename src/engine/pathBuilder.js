export function moveToCommand(pointOrX, y) {
  const point = pointFromArgs(pointOrX, y);
  return { type: "moveTo", x: point.x, y: point.y };
}

export function lineToCommand(pointOrX, y) {
  const point = pointFromArgs(pointOrX, y);
  return { type: "lineTo", x: point.x, y: point.y };
}

export function curveToCommand(c1, c2, to) {
  return { type: "curveTo", x1: c1.x, y1: c1.y, x2: c2.x, y2: c2.y, x: to.x, y: to.y };
}

export function quadToCommand(c1, to) {
  return { type: "quadTo", x1: c1.x, y1: c1.y, x: to.x, y: to.y };
}

export function closePathCommand() {
  return { type: "closePath" };
}

export function createPathBuilder() {
  const commands = [];
  return {
    commands,
    moveTo(x, y) {
      commands.push(moveToCommand(x, y));
      return this;
    },
    lineTo(x, y) {
      commands.push(lineToCommand(x, y));
      return this;
    },
    curveTo(x1, y1, x2, y2, x, y) {
      commands.push(curveToCommand({ x: x1, y: y1 }, { x: x2, y: y2 }, { x, y }));
      return this;
    },
    quadTo(x1, y1, x, y) {
      commands.push(quadToCommand({ x: x1, y: y1 }, { x, y }));
      return this;
    },
    closePath() {
      commands.push(closePathCommand());
      return this;
    },
    build() {
      return [...commands];
    }
  };
}

function pointFromArgs(pointOrX, y) {
  if (typeof pointOrX === "object" && pointOrX) return { x: pointOrX.x, y: pointOrX.y };
  return { x: pointOrX, y };
}
