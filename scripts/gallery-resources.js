import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

export function galleryRenderOptions(item, options = {}) {
  const tables = new Map(
    (item.resources || [])
      .filter((resource) => typeof resource.content === "string")
      .map((resource) => [normalizeGalleryResourceName(resource.name), resource.content])
  );
  if (!tables.size) return options;

  return {
    ...options,
    pgfplotsTableResolver(file) {
      return tables.get(normalizeGalleryResourceName(file));
    }
  };
}

export async function materializeGalleryResources(item, workDir) {
  const root = path.resolve(workDir);
  const copied = [];
  for (const resource of item.resources || []) {
    const sourcePath = resource.sourcePath;
    const name = normalizeGalleryResourceName(resource.name);
    if (!sourcePath || !name) continue;

    const destination = path.resolve(root, name);
    if (!isWithinDirectory(destination, root)) continue;
    try {
      await mkdir(path.dirname(destination), { recursive: true });
      await copyFile(sourcePath, destination);
      copied.push(name);
    } catch {
      // Retain the original TeX reference so the native log names a missing asset.
    }
  }
  return copied;
}

export function normalizeGalleryResourceName(value) {
  return String(value || "").trim().replace(/^\.\//, "").replaceAll("\\", "/");
}

function isWithinDirectory(candidate, root) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
