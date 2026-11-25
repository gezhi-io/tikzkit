import { isColorToken } from "../../engine/colors.js";
import { mergeOptionOrder, optionSetsLineWidth } from "../../engine/options.js";
import { TIKZ_DASH_PATTERN_STYLES } from "../metrics.js";

// TikZ executes the scope's ordinary keys before switching boxes. Only
// the value of "on background layer" and its every-style execute inside.
export function backgroundScopeRequest(options) {
  for (const [key, value] of Object.entries(options)) {
    if (key === "on background layer" || key === "/tikz/on background layer") return { payload: value };
  }
  return options.layer === "background" ? { raw: true } : null;
}

export function currentInkKey(key, value) {
  return key === "color" || (value === true && isColorToken(key));
}

const driverKeys = new Set([
  "draw", "fill", "tikzkit stroke ink", "tikzkit fill ink", "line cap", "line join", "miter limit",
  "dash pattern", "dash phase", "opacity", "fill opacity", "draw opacity", "stroke opacity",
  "transform canvas"
]);

// Backend settings live in the layer's output box. Coordinate transforms,
// font declarations, node styles and path construction settings are TeX state.
export function isLayerDriverKey(key, value) {
  return currentInkKey(key, value) || driverKeys.has(key) || optionSetsLineWidth(key) ||
    Object.hasOwn(TIKZ_DASH_PATTERN_STYLES, key);
}

export function constructionKeys(options) {
  return Object.fromEntries(Object.entries(options).filter(([key, value]) => !isLayerDriverKey(key, value)));
}

export function backgroundTextInks(options, current = "black") {
  let text;
  for (const [key, value] of Object.entries(options)) {
    if (currentInkKey(key, value)) {
      current = key === "color" ? (value === "." ? current : value) : key;
      text = current;
    } else if (key === "text") text = value === "." ? current : value;
  }
  return { current, text };
}

export function recordBackgroundPaint(previous, keys, current) {
  const paint = { ...previous };
  let popColor = false;
  const inks = color => ({ "tikzkit stroke ink": color, "tikzkit fill ink": color });
  for (const [key, value] of Object.entries(keys)) {
    if (currentInkKey(key, value)) {
      current = key === "color" ? (value === "." ? current : value) : key;
      mergeOptionOrder(paint, inks(current));
      // The shorthand goes through xcolor's group-local color stack. In
      // contrast, color= emits a PGF stroke/fill write in the layer box.
      if (key !== "color") popColor = true;
    } else if (key === "draw" || key === "fill") {
      if (value !== true && value !== "" && value !== "none") {
        mergeOptionOrder(paint, { [key === "draw" ? "tikzkit stroke ink" : "tikzkit fill ink"]: value === "." ? current : value });
      }
    } else if (isLayerDriverKey(key, value) && key !== "transform canvas") {
      mergeOptionOrder(paint, { [key]: value });
    }
  }
  return popColor ? mergeOptionOrder(paint, inks("black")) : paint;
}
