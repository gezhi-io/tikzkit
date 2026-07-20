import { libraryFontProfile, libraryRoleFontCommand } from "../tex/fontPolicies.js";

export const PGFPLOTS_PICTURE_SCALE_OPTION = "tikzkit pgfplots picture scale";

export function pgfplotsPictureFontScale(axisOptions = {}) {
  const scale = Number(axisOptions[PGFPLOTS_PICTURE_SCALE_OPTION]);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

export function pgfplotsRoleFontCommand(role, axisOptions = {}, explicit = "") {
  return libraryRoleFontCommand("pgfplots", role, {
    profile: libraryFontProfile("pgfplots", axisOptions),
    explicit,
    scale: pgfplotsPictureFontScale(axisOptions)
  });
}
