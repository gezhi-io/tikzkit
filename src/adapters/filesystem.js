import { readFile, writeFile } from "node:fs/promises";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

export function createLocalTableResolver(input) {
  const directory = dirname(resolve(input));
  const cache = new Map();
  const within = (base, file) => {
    const tail = relative(base, file);
    return tail !== ".." && !tail.startsWith(".." + sep) && !isAbsolute(tail);
  };
  return (name) => {
    if (typeof name !== "string" || isAbsolute(name) || /^[A-Za-z][\w+.-]*:/.test(name) ||
        !/\.(?:csv|tsv|dat|data|table|txt)$/i.test(name)) return undefined;
    if (cache.has(name)) return cache.get(name);
    let content;
    try {
      const file = resolve(directory, name);
      if (!within(directory, file)) return undefined;
      const target = realpathSync(file);
      if (within(realpathSync(directory), target) && statSync(target).isFile()) content = readFileSync(target, "utf8");
    } catch (error) {
      if (!["ENOENT", "ENOTDIR", "EACCES", "EPERM", "ELOOP"].includes(error.code)) throw error;
    }
    cache.set(name, content);
    return content;
  };
}

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
    createLocalTableResolver,
    ...overrides
  };
}
