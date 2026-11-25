// Canonicalize only the Circuitikz keys whose values we actually interpret.
// A setter in a scope or a to[...] affects just that scope or component.
const keys = new Set(["bipoles/length", "bipoles/thickness", "bipoles/border margin",
  "bipoles/capacitor/width", "bipoles/capacitor/height", "capacitors/scale", "capacitors/thickness",
  "capacitors/fill", "sources/scale", "current arrow scale", "voltage/shift", "voltage/bump a",
  "voltage/european label distance", "voltage/straight label distance", "voltage shift sources adjust"]);
const sourceKey = /^bipoles\/(?:vsource|dcvsource|vsourcesin|vsourcesquare|vsourcetri)\/(?:width|height|voltage\/(?:bump a|additional shift|european label distance|straight label distance))$/;

export function withCircuitikzKeys(state, options) {
  let result = state;
  for (const [raw, value] of Object.entries(options || {})) {
    let key = raw.replace(/^(?:\/tikz\/)?circuitikz\//, "");
    let stored = value;
    if (key.endsWith("/.initial") && sourceKey.test(key.slice(0, -9))) key = key.slice(0, -9);
    if (key === "capacitors/width") key = "bipoles/capacitor/width";
    if (key === "capacitors/height") key = "bipoles/capacitor/height";
    if (key === "voltage shift") key = "voltage/shift";
    if (key === "no v symbols" || key === "v symbols") {
      stored = key === "v symbols";
      key = "voltage/symbols";
    } else if (key === "straight voltages" || key === "european voltages" ||
               (key === "voltage" && ["straight", "european", "curved"].includes(value))) {
      stored = key === "straight voltages" || value === "straight" ? "straight" : "european";
      key = "voltage/generator label mode";
    } else if (!keys.has(key) && !sourceKey.test(key)) continue;
    if (result === state) result = { ...state };
    result[key] = stored;
  }
  return result;
}
