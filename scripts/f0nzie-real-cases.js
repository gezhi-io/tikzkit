import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const F0NZIE_ROOT = "work/f0nzie-tikz-favorites/src";
export const F0NZIE_EXPECTED_TEX_COUNT = 257;
export const F0NZIE_REPOSITORY_URL = "https://github.com/f0nzie/tikz_favorites";

export function hasF0nzieCorpus(root = F0NZIE_ROOT) {
  return existsSync(root);
}

export async function listF0nzieTexFiles(root = F0NZIE_ROOT) {
  const entries = await readdir(root, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".tex") && entry.name !== "tikzlibraryunitcircle.code.tex")
    .map((entry) => path.join(root, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

export async function loadF0nzieCases(root = F0NZIE_ROOT) {
  const files = await listF0nzieTexFiles(root);
  return Promise.all(
    files.map(async (filePath) => {
      const relativePath = path.relative(root, filePath).split(path.sep).join("/");
      const source = await readFile(filePath, "utf8");
      return {
        title: path.basename(relativePath, ".tex").replace(/[-_+]+/g, " "),
        origin: "f0nzie/tikz_favorites",
        path: relativePath,
        sourceUrl: `${F0NZIE_REPOSITORY_URL}/blob/master/src/${relativePath}`,
        source
      };
    })
  );
}
