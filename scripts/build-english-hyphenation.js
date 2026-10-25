import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

// MacTeX's language.dat assigns language 0 to Knuth's frozen hyphen.tex,
// not to the larger usenglishmax pattern set. Keep that distinction explicit.
const file = execFileSync("/Library/TeX/texbin/kpsewhich", ["hyphen.tex"], { encoding: "utf8" }).trim();
const source = readFileSync(file, "utf8");
const withoutComments = source.replace(/%[^\n]*/g, "");
const patterns = withoutComments.match(/\\patterns\{([^}]*)\}/)?.[1].trim().split(/\s+/);
const exceptions = withoutComments.match(/\\hyphenation\{([^}]*)\}/)?.[1].trim().split(/\s+/);
if (!patterns?.length || !exceptions?.length) throw new Error("Expected the original TeX pattern tables");
const notice = source.slice(0, source.indexOf("\\patterns")).replace(/^% ?/gm, "// ").trim();
const hash = createHash("sha256").update(source).digest("hex");
writeFileSync(new URL("../src/tex/englishPatterns.js", import.meta.url),
  `// Generated from MacTeX tex/generic/hyphen/hyphen.tex.\n// Source SHA-256: ${hash}\n${notice}\n` +
  `export const patterns = ${JSON.stringify(patterns.join(" "))};\nexport const exceptions = ${JSON.stringify(exceptions)};\n`);
console.log(`Imported ${patterns.length} patterns and ${exceptions.length} exceptions from ${file}`);
