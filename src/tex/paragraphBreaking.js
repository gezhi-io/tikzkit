import { englishHyphenationPoints } from "./hyphenation.js";

// Minimum-demerit paragraph breaking with the local LaTeX minipage settings.
// Math is an indivisible inline box here; unsupported material is rejected by
// measure instead of silently disappearing. This is not a general TeX engine.
export function breakNativeParagraph(source, width, measure, options = {}) {
  const text = source.trim().replace(/\s+/g, " ");
  if (!text || text.length > 4096) return null;
  const breaks = [{ end: 0, next: 0, hyphen: false }];
  let math = false;
  for (let i = 0; i < text.length;) {
    if (text[i] === "$") { math = !math; i++; continue; }
    if (math) { i++; continue; }
    if (text[i] === " ") { breaks.push({ end: i, next: i + 1, hyphen: false }); i++; continue; }
    const word = text.slice(i).match(/^[A-Za-z]+/)?.[0];
    if (word) {
      if (options.hyphenate !== false) for (const offset of englishHyphenationPoints(word)) {
        breaks.push({ end: i + offset, next: i + offset, hyphen: true });
      }
      i += word.length;
    } else i++;
  }
  if (math || breaks.length > 512) return null;
  breaks.push({ end: text.length, next: text.length, hyphen: false });
  const measured = new Map();
  const candidate = (start, end) => {
    const key = `${start}:${end}`;
    if (!measured.has(key)) {
      const line = text.slice(breaks[start].next, breaks[end].end) + (breaks[end].hyphen ? "-" : "");
      measured.set(key, { line, box: measure(line) });
    }
    return measured.get(key);
  };
  for (const [hyphenate, tolerance, emergency] of [[false, 100, 0], [true, 9999, 0], [true, 9999, options.emergencyStretch || 0]]) {
    const states = breaks.map(() => new Map());
    states[0].set(2, { cost: 0, fitness: 2, lines: [] });
    for (let end = 1; end < breaks.length; end++) {
      if (!hyphenate && breaks[end].hyphen) continue;
      const last = end === breaks.length - 1;
      for (let start = end - 1; start >= 0; start--) {
        if (!states[start].size) continue;
        const { line, box } = candidate(start, end);
        if (!box) return null;
        const delta = width - box.width;
        if (delta < -box.shrink - 1 / 65536) continue;
        const available = delta < 0 ? box.shrink : box.stretch + emergency;
        const badness = delta >= 0 && last ? 0 : texBadness(Math.abs(delta), available);
        if (badness > tolerance) continue;
        const fitness = badness <= 12 ? 2 : delta < 0 ? 3 : badness > 99 ? 0 : 1;
        for (const previous of states[start].values()) {
          const cost = previous.cost + (10 + badness) ** 2 + (breaks[end].hyphen ? 50 ** 2 : 0)
            + (Math.abs(fitness - previous.fitness) > 1 ? 10000 : 0)
            + (breaks[start].hyphen ? last ? 5000 : breaks[end].hyphen ? 10000 : 0 : 0);
          if (cost <= (states[end].get(fitness)?.cost ?? Infinity)) {
            states[end].set(fitness, { cost, fitness, lines: [...previous.lines, line] });
          }
        }
      }
    }
    const best = [...states.at(-1).values()].sort((a, b) => a.cost - b.cost)[0];
    if (best) return best.lines;
  }
  return null;
}

function texBadness(amount, capacity) {
  const t = Math.round(amount * 65536), s = Math.round(capacity * 65536);
  if (!t) return 0;
  if (s <= 0) return 10000;
  const r = t <= 7230584 ? Math.floor(t * 297 / s)
    : s >= 1663497 ? Math.floor(t / Math.floor(s / 297)) : t;
  return r > 1290 ? 10000 : Math.floor((r ** 3 + 131072) / 262144);
}
