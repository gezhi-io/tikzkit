import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gzipSync } from "node:zlib";
import { cmRoman10GlyphPath } from "../src/fonts/cmRoman10Outlines.js";
import { nativeMathFont } from "../src/tex/mathFonts.js";

test("every visible CMR10 mapping has a closed outline, including all five TeX ligatures", () => {
  // The WOFF maps the printable ASCII slots as well as the TFM paint glyphs,
  // plus soft hyphen, Ohm sign, and increment as aliases.
  const visible = new Set([...Object.keys(nativeMathFont("CMR", 10).glyphs),
    ...Array.from({ length: 94 }, (_, i) => String.fromCharCode(33 + i)), "\u00ad", "\u2126", "\u2206"]);
  assert.equal(visible.size, 141);
  const paths = [...visible].map(char => {
    const d = cmRoman10GlyphPath(char);
    assert.match(d, /^M[MLHVCZ0-9 .-]+Z$/, char);
    assert.equal(d.match(/M/g).length, d.match(/Z/g).length, char);
    return d;
  });
  assert.equal(new Set(paths).size, 126);
  assert.equal(new Set([..."\ufb00\ufb01\ufb02\ufb03\ufb04"].map(cmRoman10GlyphPath)).size, 5);
});

test("lookup preserves font coordinates and cmap aliases without shaping words or drawing blanks", () => {
  assert.equal(cmRoman10GlyphPath("-"), "M276 187V245H11V187Z"); // Above the baseline, native 1000/em.
  assert.match(cmRoman10GlyphPath("p"), /V-194(?=[A-Z])/);
  for (const [slot, unicode] of [["'", "\u2019"], ["`", "\u2018"], ['"', "\u201d"], ["\\", "\u201c"],
    ["-", "\u00ad"], ["\u03a9", "\u2126"], ["\u0394", "\u2206"]]) {
    assert.equal(cmRoman10GlyphPath(slot), cmRoman10GlyphPath(unicode));
  }
  assert.notEqual(cmRoman10GlyphPath("\u201c"), cmRoman10GlyphPath("\u201d"));
  for (const text of ["", " ", "\u00a0", "ffi", "\u2603", "\u{1f600}", "constructor", "__proto__", 65, null]) {
    assert.equal(cmRoman10GlyphPath(text), null);
  }
});

test("the standalone outline module stays small and identifies its packaged WOFF", () => {
  const data = readFileSync(new URL("../src/fonts/cmRoman10Outlines.js", import.meta.url));
  const woff = readFileSync(new URL("../web/fonts/TikZKitCMR10-Regular.woff", import.meta.url));
  assert.ok(data.includes(createHash("sha256").update(woff).digest("hex")), "regenerate after changing the face");
  assert.ok(data.byteLength < 48 * 1024, `${data.byteLength} bytes`);
  assert.ok(gzipSync(data).byteLength < 20 * 1024);
});
