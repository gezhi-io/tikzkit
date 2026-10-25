import { patterns, exceptions } from "./englishPatterns.js";

let trie;
const exceptionPoints = new Map(exceptions.map(word => [word.replaceAll("-", ""),
  [...word.matchAll(/-/g)].map((match, i) => match.index - i)]));

// Liang's pattern maximum: odd weights permit a discretionary, even weights
// suppress it. TeX's default English minima leave two/three letters intact.
export function englishHyphenationPoints(word) {
  if (!/^[A-Za-z]+$/.test(word) || word.length > 63) return [];
  const lower = word.toLowerCase();
  if (exceptionPoints.has(lower)) return exceptionPoints.get(lower);
  if (!trie) {
    trie = new Map();
    for (const pattern of patterns.split(" ")) {
      let node = trie;
      const weights = [0];
      for (const char of pattern) {
        if (/\d/.test(char)) weights[weights.length - 1] = Number(char);
        else {
          if (!node.has(char)) node.set(char, new Map());
          node = node.get(char);
          weights.push(0);
        }
      }
      node.set(null, weights);
    }
  }
  const padded = `.${lower}.`;
  const weights = new Array(padded.length + 1).fill(0);
  for (let start = 0; start < padded.length; start++) {
    let node = trie;
    for (let end = start; end < padded.length; end++) {
      node = node.get(padded[end]);
      if (!node) break;
      node.get(null)?.forEach((weight, i) => { weights[start + i] = Math.max(weights[start + i], weight); });
    }
  }
  return Array.from({ length: Math.max(0, word.length - 4) }, (_, i) => i + 2)
    .filter(i => weights[i + 1] % 2 === 1);
}
