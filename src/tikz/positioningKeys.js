// The installed positioning library assigns a self anchor, a reference
// anchor, two direction signs and a scalar-only diagonal factor per key.
export const POSITIONING_ANCHORS = {
  above: { self: "south", reference: "north", x: 0, y: 1, factor: 1 },
  "above left": { self: "south east", reference: "north west", x: -1, y: 1, factor: Math.SQRT1_2 },
  "above right": { self: "south west", reference: "north east", x: 1, y: 1, factor: Math.SQRT1_2 },
  below: { self: "north", reference: "south", x: 0, y: -1, factor: 1 },
  "below left": { self: "north east", reference: "south west", x: -1, y: -1, factor: Math.SQRT1_2 },
  "below right": { self: "north west", reference: "south east", x: 1, y: -1, factor: Math.SQRT1_2 },
  left: { self: "east", reference: "west", x: -1, y: 0, factor: 1 },
  right: { self: "west", reference: "east", x: 1, y: 0, factor: 1 },
  "base left": { self: "base east", reference: "base west", x: -1, y: 0, factor: 1 },
  "base right": { self: "base west", reference: "base east", x: 1, y: 0, factor: 1 },
  "mid left": { self: "mid east", reference: "mid west", x: -1, y: 0, factor: 1 },
  "mid right": { self: "mid west", reference: "mid east", x: 1, y: 0, factor: 1 }
};

export function normalizePositioningKey(key) {
  if (!key.startsWith("/tikz/") && !/\s{2,}/.test(key)) return key;
  const bare = key.replace(/^\/tikz\//, "").replace(/\s+/g, " ");
  return Object.hasOwn(POSITIONING_ANCHORS, bare) || ["node distance", "on grid", "at", "anchor"].includes(bare) ? bare : key;
}

export function positioningRegisterName(key) {
  if (key === "node distance" || key === "on grid") return key;
  return key.startsWith("tikzkit prior ") ? /^tikzkit prior (node distance|on grid) \d+$/.exec(key)?.[1] : null;
}
