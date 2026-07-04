export function createAxisGridModel(axisOptions = {}) {
  return {
    x: shouldRenderAxisGrid(axisOptions, "x"),
    y: shouldRenderAxisGrid(axisOptions, "y"),
    minorX: shouldRenderMinorAxisGrid(axisOptions, "x"),
    minorY: shouldRenderMinorAxisGrid(axisOptions, "y"),
    mode: String(axisOptions.grid || "").trim() || "none",
    style: axisOptions["grid style"] || axisOptions["major grid style"] || ""
  };
}

export function shouldRenderAnyAxisGrid(axisOptions = {}) {
  return shouldRenderAxisGrid(axisOptions, "x") || shouldRenderAxisGrid(axisOptions, "y");
}

export function shouldRenderAxisGrid(axisOptions = {}, axis) {
  const axisSpecific =
    axis === "x"
      ? axisOptions["x grid"] ?? axisOptions.xgrid ?? axisOptions.xmajorgrids
      : axisOptions["y grid"] ?? axisOptions.ygrid ?? axisOptions.ymajorgrids;
  if (axisSpecific !== undefined && axisSpecific !== null && axisSpecific !== "") {
    const text = String(axisSpecific).toLowerCase();
    return text !== "false" && text !== "none";
  }
  const grid = String(axisOptions.grid || "").toLowerCase();
  return Boolean(grid && grid !== "false" && grid !== "none");
}

export function shouldRenderMinorAxisGrid(axisOptions = {}, axis) {
  const axisSpecific =
    axis === "x"
      ? axisOptions.xminorgrids ?? axisOptions["x minor grids"]
      : axisOptions.yminorgrids ?? axisOptions["y minor grids"];
  if (axisSpecific === undefined || axisSpecific === null || axisSpecific === "") return false;
  const text = String(axisSpecific).toLowerCase();
  return text !== "false" && text !== "none";
}
