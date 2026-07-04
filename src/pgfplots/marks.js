export function createPlotMarkModel(plotOptions = {}) {
  const raw = plotOptions.mark ?? (plotOptions["only marks"] ? "*" : "none");
  return {
    mark: raw === true ? "*" : String(raw || "none"),
    onlyMarks: Boolean(plotOptions["only marks"]),
    size: plotOptions["mark size"] || "2pt"
  };
}
