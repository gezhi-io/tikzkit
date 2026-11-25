import { stripOuterBraces } from "../engine/options.js";

export function texDataFilename(raw) {
  return stripOuterBraces(raw).replace(/^"([^"]*)"$/, "$1");
}

// Keep the AST serializable. A table name is an exact key, never a path to open.
export function documentDataFiles(supplied, embedded) {
  const files = Object.create(null);
  if (supplied instanceof Map) {
    for (const [name, text] of supplied) {
      if (typeof name === "string" && typeof text === "string") files[name] = text;
    }
  } else if (supplied && typeof supplied === "object") {
    for (const name of Object.keys(supplied)) {
      const text = Object.getOwnPropertyDescriptor(supplied, name)?.value;
      if (typeof text === "string") files[name] = text;
    }
  }
  for (const [name, text] of embedded) files[name] = text;
  return Object.keys(files).length ? files : undefined;
}

export function resolveDataFile(name, dataFiles, resolver) {
  const text = dataFiles instanceof Map ? dataFiles.get(name) : Object.getOwnPropertyDescriptor(dataFiles ?? {}, name)?.value;
  if (typeof text === "string") return text;
  if (typeof resolver === "function") return resolver(name);
}
