import { parseOptions, splitTopLevel } from "../engine/options.js";
import { parseDimension } from "../engine/math.js";

const unbrace = value => String(value || "").trim().replace(/^\{([\s\S]*)\}$/, "$1");
const enabled = value => value !== false && String(value).toLowerCase() !== "false";

// PGF applies per-value options after the visualizer's defaults, then adds
// odd/even text padding to the *tick endpoints*, before painting either node.
export function datavisTickVisual(axisOptions, axis, index, base, length, style, kind = "major") {
  if (!axisOptions["datavis axis label placement"]) return base;
  const school = Boolean(axisOptions["axis school book padding"]);
  const inner = axisOptions["datavis tick direction"] === "inner";
  const visual = { low: inner && !school ? 0 : -length, high: school || inner ? length : 0,
    direction: axis === "x" ? "y" : "x", style, tickTextAtLow: kind === "major", tickTextAtHigh: false, ...base };
  const raw = kind === "major" ? splitTopLevel(axisOptions[`datavis ${axis} tick options`] || "", ",")[index] : "";
  const padding = { "low odd": 0, "low even": 0, "high odd": 0, "high even": 0 };
  // Tick dimensions precede the 8pt node font. This lowering currently
  // carries the standard 10pt outer CM font; other outer fonts remain partial.
  const dimension = value => {
    const text = String(value);
    return parseDimension(/(?:pt|cm|mm|em|ex|in)\b/.test(text) ? text : `(${text})pt`, {},
      { font: { sizePt: 10, family: "serif" } });
  };
  const setPadding = (parities, value) => {
    for (const parity of parities) { padding[`low ${parity}`] = -value; padding[`high ${parity}`] = value; }
  };
  for (const part of splitTopLevel(unbrace(raw), ",")) {
    for (const [key, value] of Object.entries(parseOptions(part))) {
      if (key === "low" || key === "high") visual[key] = dimension(value);
      else if (key === "tick length") { visual.low = -dimension(value); visual.high = dimension(value); }
      else if (key === "style") {
        visual.style += `,${value}`;
        visual.scopeStyle = [visual.scopeStyle, value].filter(Boolean).join(",");
      }
      else if (key === "node style") visual.nodeStyle = [visual.nodeStyle, value].filter(Boolean).join(",");
      else if (key === "tick text at low") visual.tickTextAtLow = enabled(value);
      else if (key === "tick text at high") visual.tickTextAtHigh = enabled(value);
      else if (key === "no tick text") { visual.tickTextAtLow = false; visual.tickTextAtHigh = false; }
      else if (key === "tick text padding") setPadding(["odd", "even"], dimension(value));
      else if (key === "stack" || key === "tick text even padding") setPadding(["even"], dimension(value === true ? "1em" : value));
      else if (key === "stack'" || key === "tick text odd padding") setPadding(["odd"], dimension(value === true ? "1em" : value));
      else {
        const match = key.match(/^tick text (low|high) (odd|even) padding$/);
        if (match) padding[`${match[1]} ${match[2]}`] = dimension(value);
      }
    }
  }
  const parity = index % 2 ? "even" : "odd";
  if (visual.tickTextAtLow) visual.low += padding[`low ${parity}`];
  if (visual.tickTextAtHigh) visual.high += padding[`high ${parity}`];
  return visual;
}
