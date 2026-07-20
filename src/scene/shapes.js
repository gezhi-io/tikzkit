export function createPathShape(commands = [], style = {}, attributes = {}) {
  return { type: "path", ...attributes, commands, style };
}

export function createTextShape(text, x, y, style = {}, attributes = {}) {
  return { type: "textNode", ...attributes, text, x, y, style };
}

export function createGroupShape(items = [], style = {}, attributes = {}) {
  return { type: "group", ...attributes, items, style };
}

export function createBoundingBoxShape(commands = [], attributes = {}) {
  return { type: "bbox", ...attributes, commands };
}

export function createMarkerShape(attributes = {}) {
  return { type: "marker", ...attributes };
}

export function createRasterImageShape(attributes = {}) {
  return { type: "rasterImage", ...attributes };
}
