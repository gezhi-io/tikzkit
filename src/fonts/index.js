import { fontManifest } from "./manifest.js";
import { fontData } from "./data.js";

export { fontManifest };

const MATH_CLASS_FAMILIES = {
  mathbb: "AMS", textbb: "AMS", amsrm: "AMS", mathcal: "Caligraphic",
  mathfrak: "Fraktur", textfrak: "Fraktur", mathboldfrak: "Fraktur", textboldfrak: "Fraktur",
  mathscr: "Script", textscr: "Script", mathtt: "Typewriter", texttt: "Typewriter",
  mathsf: "SansSerif", textsf: "SansSerif", mathboldsf: "SansSerif", textboldsf: "SansSerif",
  mathitsf: "SansSerif", mathsfit: "SansSerif", textitsf: "SansSerif",
  "small-op": "Size1", "large-op": "Size2", "delim-size1": "Size1", "delim-size4": "Size4"
};

function cssUrl(value) {
  return String(value).replace(/[\\'\n\r\f<>]/g, (char) => `\\${char.codePointAt(0).toString(16)} `);
}

export function fontStyleSheet(options = {}) {
  const families = options.families ? new Set(options.families) : null;
  const prefix = options.fontUrlPrefix === undefined ? null : String(options.fontUrlPrefix).replace(/\/?$/, "/");
  return fontManifest.filter((font) => !families || families.has(font.family)).map((font) => {
    const url = prefix === null ? fontData[font.file] : prefix + font.file;
    return `@font-face{font-family:${font.family};font-style:${font.style};font-weight:${font.weight};src:url('${cssUrl(url)}') format('${font.format}')}`;
  }).join("\n");
}

export function fontFamiliesInMarkup(markup = "") {
  const source = String(markup);
  const families = new Set(source.match(/TikZKit(?:CM\w+|Math_\w+|Heros)/g) || []);
  const classGroups = [...source.matchAll(/\sclass\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
    .map((match) => (match[1] ?? match[2]).split(/\s+/));
  const classes = new Set(classGroups.flat());
  if (classes.has("tikzkit-math-scope")) {
    families.add("TikZKitMath_Main");
    families.add("TikZKitMath_Math");
    if (classes.has("tikzkit-math-sans")) families.add("TikZKitCMUSans");
    if (classes.has("tikzkit-math-helvetica")) families.add("TikZKitHeros");
    for (const [name, family] of Object.entries(MATH_CLASS_FAMILIES)) {
      if (classes.has(`tikzkit-math-${name}`)) families.add(`TikZKitMath_${family}`);
    }
    // A size class also occurs on ordinary superscripts; only delimiter spans
    // select a SizeN font. Stacked delimiters use the delim-sizeN classes above.
    for (const group of classGroups) {
      if (!group.includes("tikzkit-math-delimsizing")) continue;
      for (const size of [1, 2, 3, 4]) {
        if (group.includes(`tikzkit-math-size${size}`)) families.add(`TikZKitMath_Size${size}`);
      }
    }
  }
  if (families.has("TikZKitMath_AMS")) families.add("TikZKitMath_AMSCaps");
  return [...families];
}
