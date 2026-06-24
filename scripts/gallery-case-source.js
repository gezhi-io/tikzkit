import { loadWebCorpus } from "../web/corpus-gallery-server.js";

export const DEFAULT_REAL_GALLERY_CORPUS_ID = "core";

export async function loadRealGalleryCases(corpusId = DEFAULT_REAL_GALLERY_CORPUS_ID) {
  const gallery = await loadWebCorpus(corpusId);
  if (!gallery) throw new Error(`Unknown gallery corpus: ${corpusId}`);
  if (!gallery.available) throw new Error(`Gallery corpus is not available: ${corpusId}`);
  return gallery;
}
