export function sampleRawGnuplotAddplot(rawSource, diagnostics = []) {
  const source = String(rawSource || "");
  const kind = rawGnuplotKind(source);
  if (!kind) {
    diagnostics.push({ severity: "warning", message: "Unsupported raw gnuplot addplot" });
    return [];
  }

  const k = rawGnuplotChiSquaredK(source);
  if (!Number.isFinite(k)) {
    diagnostics.push({ severity: "warning", message: "Unsupported raw gnuplot chi-squared parameter" });
    return [];
  }

  const xRange = rawGnuplotRange(source, "x") || { start: 0, end: 1 };
  const yRange = rawGnuplotRange(source, "y");
  const samples = rawGnuplotSamples(source);
  const points = [];
  for (let index = 0; index < samples; index += 1) {
    const t = samples === 1 ? 0 : index / (samples - 1);
    const x = xRange.start + (xRange.end - xRange.start) * t;
    const y = kind === "chi-squared-cdf" ? chiSquaredCdf(x, k) : chiSquaredPdf(x, k);
    if (!Number.isFinite(y)) continue;
    if (yRange && (y < yRange.start || y > yRange.end)) continue;
    points.push({ x: roundPlotNumber(x), y: roundPlotNumber(y), raw: `(${roundPlotNumber(x)},${roundPlotNumber(y)})` });
  }
  return points;
}

export function lowerRawGnuplotAddplotsToCoordinates(source, diagnostics = []) {
  const expanded = expandRawGnuplotForeach(source);
  let output = "";
  let index = 0;
  while (index < expanded.length) {
    const start = expanded.indexOf("\\addplot", index);
    if (start === -1) {
      output += expanded.slice(index);
      break;
    }
    output += expanded.slice(index, start);
    const lowered = parseRawGnuplotAddplotStatement(expanded, start, diagnostics);
    if (!lowered) {
      output += expanded.slice(start, start + "\\addplot".length);
      index = start + "\\addplot".length;
      continue;
    }
    output += lowered.replacement;
    index = lowered.end;
  }
  return output;
}

function parseRawGnuplotAddplotStatement(source, start, diagnostics) {
  let cursor = start + "\\addplot".length;
  let suffix = "";
  if (source[cursor] === "3") {
    suffix = "3";
    cursor += 1;
  }
  cursor = skipWhitespace(source, cursor);
  if (source[cursor] === "+") {
    suffix += "+";
    cursor += 1;
  }
  const optionsStart = cursor;
  const options = parseOptionalOptions(source, cursor);
  cursor = skipWhitespace(source, options.end);
  if (!source.startsWith("gnuplot", cursor) || !isBoundary(source, cursor + "gnuplot".length)) return null;
  cursor += "gnuplot".length;
  const gnuplotOptions = parseOptionalOptions(source, cursor);
  cursor = skipWhitespace(source, gnuplotOptions.end);
  const raw = extractBalanced(source, cursor, "{", "}");
  if (!raw) return null;
  const points = sampleRawGnuplotAddplot(raw.content, diagnostics);
  if (!points.length) return null;
  const rawOptions = source.slice(optionsStart, options.end);
  const coordinates = points.map((point) => `(${formatPointNumber(point.x)},${formatPointNumber(point.y)})`).join(" ");
  return {
    replacement: `\\addplot${suffix}${rawOptions} coordinates {${coordinates}}`,
    end: raw.end
  };
}

function expandRawGnuplotForeach(source) {
  const text = String(source || "");
  let output = "";
  let index = 0;
  while (index < text.length) {
    if (!text.startsWith("\\foreach", index) || !isBoundary(text, index + "\\foreach".length)) {
      output += text[index] || "";
      index += 1;
      continue;
    }
    const parsed = parseSimpleForeach(text, index);
    if (!parsed || !/gnuplot\s*\[?/.test(parsed.body)) {
      output += text[index] || "";
      index += 1;
      continue;
    }
    output += parsed.values.map((value) => replaceForeachVariable(parsed.body, parsed.variable, value)).join("\n");
    index = parsed.end;
  }
  return output;
}

function parseSimpleForeach(source, start) {
  let cursor = skipWhitespace(source, start + "\\foreach".length);
  if (source[cursor] !== "\\") return null;
  const variable = readCommandName(source, cursor + 1);
  if (!variable?.value) return null;
  cursor = skipWhitespace(source, variable.end);
  if (!source.startsWith("in", cursor) || !isBoundary(source, cursor + "in".length)) return null;
  cursor = skipWhitespace(source, cursor + "in".length);
  const values = extractBalanced(source, cursor, "{", "}");
  if (!values) return null;
  cursor = skipWhitespace(source, values.end);
  const body = extractBalanced(source, cursor, "{", "}");
  if (!body) return null;
  return {
    variable: variable.value,
    values: expandForeachValues(values.content),
    body: body.content,
    end: body.end
  };
}

function expandForeachValues(raw) {
  const parts = splitTopLevel(String(raw || ""), ",").map((part) => part.trim()).filter(Boolean);
  const values = [];
  for (let index = 0; index < parts.length; index += 1) {
    if (parts[index] === "..." && values.length && index + 1 < parts.length) {
      values.push(...numericRangeValues(Number(values.at(-1)), Number(parts[index + 1]), { skipFirst: true }));
      index += 1;
      continue;
    }
    values.push(parts[index]);
  }
  return values;
}

function numericRangeValues(start, end, options = {}) {
  if (!Number.isFinite(start) || !Number.isFinite(end)) return [];
  const step = start <= end ? 1 : -1;
  const values = [];
  for (let value = start + (options.skipFirst ? step : 0); step > 0 ? value <= end : value >= end; value += step) {
    values.push(String(value));
  }
  return values;
}

function replaceForeachVariable(body, variable, value) {
  return String(body || "").replace(new RegExp(`\\\\${escapeRegExp(variable)}(?![A-Za-z@])`, "g"), String(value));
}

function readCommandName(source, start) {
  const match = source.slice(start).match(/^[A-Za-z@]+/);
  if (!match) return null;
  return { value: match[0], end: start + match[0].length };
}

function parseOptionalOptions(source, start) {
  let cursor = skipWhitespace(source, start);
  if (source[cursor] !== "[") return { raw: "", end: cursor };
  const balanced = extractBalanced(source, cursor, "[", "]");
  return balanced ? { raw: source.slice(cursor, balanced.end), content: balanced.content, end: balanced.end } : { raw: "", end: cursor };
}

function extractBalanced(source, start, open, close) {
  if (source[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === "\\" && index + 1 < source.length) {
      index += 1;
      continue;
    }
    if (char === open) depth += 1;
    if (char === close) {
      depth -= 1;
      if (depth === 0) {
        return { content: source.slice(start + 1, index), end: index + 1 };
      }
    }
  }
  return null;
}

function skipWhitespace(source, index) {
  let cursor = index;
  while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;
  return cursor;
}

function splitTopLevel(source, separator) {
  const parts = [];
  let start = 0;
  let depth = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === "\\" && index + 1 < source.length) {
      index += 1;
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}") depth = Math.max(0, depth - 1);
    else if (char === separator && depth === 0) {
      parts.push(source.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(source.slice(start));
  return parts;
}

function isBoundary(source, index) {
  return !/[A-Za-z@]/.test(source[index] || "");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatPointNumber(value) {
  return String(roundPlotNumber(value));
}

function rawGnuplotKind(source) {
  if (/igamma\s*\(/.test(source) && /chisq\s*\(/.test(source)) return "chi-squared-cdf";
  if (/lgamma\s*\(/.test(source) && /chisq\s*\(/.test(source)) return "chi-squared-pdf";
  return "";
}

function rawGnuplotChiSquaredK(source) {
  const match = source.match(/plot\s+chisq\s*\(\s*x\s*,\s*([^)]+?)\s*\)/);
  if (!match) return NaN;
  return Number(String(match[1]).trim());
}

function rawGnuplotRange(source, axis) {
  const pattern = new RegExp(`set\\s+${axis}range\\s*\\[\\s*([^:\\]]+)\\s*:\\s*([^\\]]+)\\s*\\]`, "i");
  const match = source.match(pattern);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  return Number.isFinite(start) && Number.isFinite(end) ? { start, end } : null;
}

function rawGnuplotSamples(source) {
  const match = source.match(/\bsamples\s*=\s*(\d+)/i);
  if (!match) return 25;
  return Math.max(2, Math.min(2000, Number(match[1]) || 25));
}

function chiSquaredPdf(x, k) {
  if (x <= 0 || k <= 0) return 0;
  const halfK = k / 2;
  return Math.exp((halfK - 1) * Math.log(x) - x / 2 - logGamma(halfK) - halfK * Math.log(2));
}

function chiSquaredCdf(x, k) {
  if (x <= 0 || k <= 0) return 0;
  return regularizedLowerGamma(k / 2, x / 2);
}

function regularizedLowerGamma(a, x) {
  if (x <= 0) return 0;
  if (x < a + 1) return lowerGammaSeries(a, x);
  return 1 - upperGammaContinuedFraction(a, x);
}

function lowerGammaSeries(a, x) {
  const logTerm = -x + a * Math.log(x) - logGamma(a);
  let ap = a;
  let sum = 1 / a;
  let delta = sum;
  for (let n = 1; n <= 200; n += 1) {
    ap += 1;
    delta *= x / ap;
    sum += delta;
    if (Math.abs(delta) < Math.abs(sum) * 1e-14) break;
  }
  return clamp01(sum * Math.exp(logTerm));
}

function upperGammaContinuedFraction(a, x) {
  const logTerm = -x + a * Math.log(x) - logGamma(a);
  let b = x + 1 - a;
  let c = 1 / 1e-30;
  let d = 1 / Math.max(b, 1e-30);
  let h = d;
  for (let i = 1; i <= 200; i += 1) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = b + an / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-14) break;
  }
  return clamp01(Math.exp(logTerm) * h);
}

function logGamma(z) {
  const coefficients = [
    676.5203681218851,
    -1259.1392167224028,
    771.3234287776531,
    -176.6150291621406,
    12.507343278686905,
    -0.13857109526572012,
    9.984369578019572e-6,
    1.5056327351493116e-7
  ];
  if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  let x = 0.9999999999998099;
  const shifted = z - 1;
  for (let index = 0; index < coefficients.length; index += 1) {
    x += coefficients[index] / (shifted + index + 1);
  }
  const t = shifted + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(x);
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function roundPlotNumber(value) {
  return Number(Number(value).toFixed(6));
}
