export function createSceneStyle(overrides = {}) {
  return {
    stroke: "black",
    fill: "none",
    lineWidth: 1,
    opacity: 1,
    ...overrides
  };
}
