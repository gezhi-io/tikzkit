import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_REAL_GALLERY_CORPUS_ID = "core";

const fixtureManifestUrl = new URL("../test/fixtures/examples/manifest.json", import.meta.url);
const fixtureRoot = dirname(fileURLToPath(fixtureManifestUrl));

export async function loadRealGalleryCases(corpusId = DEFAULT_REAL_GALLERY_CORPUS_ID) {
  try {
    const { loadWebCorpus } = await import("../web/corpus-gallery-server.js");
    const gallery = await loadWebCorpus(corpusId);
    if (!gallery) throw new Error(`Unknown gallery corpus: ${corpusId}`);
    if (!gallery.available) throw new Error(`Gallery corpus is not available: ${corpusId}`);
    return gallery;
  } catch (error) {
    // The current web workbench intentionally has no legacy gallery server.
    // Keep audits usable by treating the maintained fixture manifest as core.
    if (error?.code !== "ERR_MODULE_NOT_FOUND") throw error;
    return loadFixtureCorpus(corpusId);
  }
}

export async function loadFixtureCorpus(corpusId = DEFAULT_REAL_GALLERY_CORPUS_ID) {
  if (corpusId !== DEFAULT_REAL_GALLERY_CORPUS_ID) {
    throw new Error(`Unknown gallery corpus: ${corpusId}`);
  }
  const manifest = JSON.parse(await readFile(fixtureManifestUrl, "utf8"));
  const cases = await Promise.all((manifest.cases || []).map(async (entry) => {
    const path = String(entry.source || "");
    const source = path ? await readFile(resolve(fixtureRoot, path), "utf8") : "";
    return {
      id: entry.id,
      title: entry.title || entry.id,
      source,
      origin: entry.sourceCorpus || "fixture-core",
      path
    };
  }));
  return {
    id: "fixture-core",
    label: "Current fixture corpus",
    origin: "fixture-core",
    root: fixtureRoot,
    available: true,
    cases
  };
}
