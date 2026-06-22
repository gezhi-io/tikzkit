import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const JANOSH_ROOT = "work/janosh-diagrams/assets";
export const JANOSH_EXPECTED_TEX_COUNT = 134;
export const JANOSH_REPOSITORY_URL = "https://github.com/janosh/diagrams";

export function hasJanoshCorpus(root = JANOSH_ROOT) {
  return existsSync(root);
}

export async function listJanoshTexFiles(root = JANOSH_ROOT) {
  const files = [];
  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(".tex")) files.push(absolutePath);
    }
  }
  await walk(root);
  return files.sort((left, right) => left.localeCompare(right));
}

export async function loadJanoshCases(root = JANOSH_ROOT) {
  const files = await listJanoshTexFiles(root);
  return Promise.all(
    files.map(async (filePath) => {
      const relativePath = path.relative(root, filePath).split(path.sep).join("/");
      const source = await readFile(filePath, "utf8");
      return {
        title: titleFromPath(relativePath),
        origin: "janosh/diagrams",
        path: relativePath,
        sourceUrl: `${JANOSH_REPOSITORY_URL}/blob/main/assets/${relativePath}`,
        source
      };
    })
  );
}

function titleFromPath(relativePath) {
  const directory = path.dirname(relativePath);
  const stem = path.basename(relativePath, ".tex");
  const slug = directory === "." ? stem : directory;
  return slug.replace(/[-_]+/g, " ");
}
