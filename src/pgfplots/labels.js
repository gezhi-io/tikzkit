export function createAxisLabelModel(axisOptions = {}) {
  return {
    title: axisOptions.title || "",
    x: axisOptions.xlabel || axisOptions["x label"] || "",
    y: axisOptions.ylabel || axisOptions["y label"] || "",
    z: axisOptions.zlabel || axisOptions["z label"] || ""
  };
}
