import { pgfplotsLibrary as dateplotLibrary } from "./dateplot.js";
import { pgfplotsLibrary as fillbetweenLibrary } from "./fillbetween.js";
import { pgfplotsLibrary as groupplotsLibrary } from "./groupplots.js";

const libraries = Object.freeze([dateplotLibrary, fillbetweenLibrary, groupplotsLibrary].map(normalizePgfplotsLibrary));

export const pgfplotsLibraryCatalog = Object.freeze(
  Object.fromEntries(libraries.map((library) => [library.name, library]))
);

export const knownPgfplotsLibraries = Object.freeze(libraries.map((library) => library.name));
export { dateplotLibrary, fillbetweenLibrary, groupplotsLibrary };

function normalizePgfplotsLibrary(library) {
  return Object.freeze({
    ...library,
    features: Object.freeze([...(library.features || [])])
  });
}
