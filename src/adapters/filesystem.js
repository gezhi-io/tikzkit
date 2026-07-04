import { readFile, writeFile } from "node:fs/promises";

export async function readTextFile(path, encoding = "utf8") {
  return readFile(path, encoding);
}

export async function writeTextFile(path, content, encoding = "utf8") {
  await writeFile(path, content, encoding);
}

export function createFilesystemAdapter(overrides = {}) {
  return {
    readTextFile,
    writeTextFile,
    ...overrides
  };
}
