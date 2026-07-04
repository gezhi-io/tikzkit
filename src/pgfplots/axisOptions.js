export function createAxisOptions(rawOptions = {}) {
  return {
    ...rawOptions,
    axisLines: rawOptions["axis lines"] ?? rawOptions.axis ?? "box",
    width: rawOptions.width,
    height: rawOptions.height
  };
}
