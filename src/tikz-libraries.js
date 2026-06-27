import { tikzLibraryCatalog } from "./libraries/index.js";

export const BUILTIN_TIKZ_LIBRARIES = tikzLibraryCatalog;

export function collectTikzLibraries(source) {
  const names = [];
  const pattern = /\\usetikzlibrary(?:\[[^\]]*\])?\{([^{}]*)\}/g;
  let match;
  while ((match = pattern.exec(String(source)))) {
    for (const name of parseTikzLibraryList(match[1])) {
      if (!names.includes(name)) names.push(name);
    }
  }
  return resolveTikzLibraries(names);
}

export function stripTikzLibraryDeclarations(source) {
  return String(source).replace(/\\usetikzlibrary(?:\[[^\]]*\])?\{[^{}]*\}\s*;?/g, "");
}

export function resolveTikzLibraries(names = []) {
  return names.map((rawName) => {
    const name = String(rawName).trim();
    const support = BUILTIN_TIKZ_LIBRARIES[name];
    if (support) {
      return {
        name: support.name,
        status: support.status,
        implementedBy: support.implementedBy,
        features: [...support.features]
      };
    }
    return {
      name,
      status: "unsupported",
      implementedBy: null,
      features: []
    };
  });
}

export function parseTikzLibraryList(input = "") {
  return String(input)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}
