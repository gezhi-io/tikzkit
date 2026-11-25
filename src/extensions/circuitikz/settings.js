import { evaluateMath, parseDimension } from "../../engine/math.js";
import { normalizeColor } from "../../engine/colors.js";

// Canonicalize only the Circuitikz keys whose values we actually interpret.
// A setter in a scope or a to[...] affects just that scope or component.
const keys = new Set(["bipoles/length", "bipoles/thickness", "bipoles/border margin",
  "bipoles/capacitor/width", "bipoles/capacitor/height", "capacitors/scale", "capacitors/thickness",
  "capacitors/fill", "bipoles/resistor/width", "bipoles/resistor/height", "bipoles/generic/width",
  "bipoles/generic/height", "resistors/zigs", "resistors/zigzag stub", "resistors/scale",
  "resistors/thickness", "resistors/fill", "label distance", "label/align",
  "sources/scale", "current arrow scale", "voltage/shift", "voltage/bump a",
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
    if (key === "resistors/width") {
      if (result === state) result = { ...state };
      result["bipoles/generic/width"] = stored;
      key = "bipoles/resistor/width";
    }
    if (key === "voltage shift") key = "voltage/shift";
    if (key === "american" || key === "american resistors" || key === "cute" ||
        key === "european" || key === "european resistors" ||
        (key === "resistor" && (value === "american" || value === "european"))) {
      stored = key === "resistor" ? value : key.startsWith("european") ? "european" : "american";
      key = "resistor/kind";
    } else if (key === "no v symbols" || key === "v symbols") {
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

// Both fixed resistors and capacitors use pgfcircdeclarebipolescaled and the
// same class/legacy pen and fill lookup. Rlen is independent of wire length.
export function fixedBipoleClass(name, keys = {}, variables, shapeScale = 1) {
  const number = (key, fallback) => {
    const raw = keys[key];
    if (raw == null || raw === true || raw === "none") return fallback;
    const value = evaluateMath(String(raw), variables);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  };
  const length = parseDimension(String(keys["bipoles/length"] ?? "1.4cm"), variables);
  return { number, rlen: (Number.isFinite(length) && length >= 0 ? length : 1.4) *
    number(name + "/scale", 1) * shapeScale,
    thickness: number(name + "/thickness", number("bipoles/thickness", 2)),
    fill: normalizeColor(String(keys[name + "/fill"] ?? "none")) };
}
