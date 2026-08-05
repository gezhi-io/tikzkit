import { libraryFontProfile, libraryRoleFontCommand } from "../tex/fontPolicies.js";

export const PGFPLOTS_PICTURE_SCALE_OPTION = "tikzkit pgfplots picture scale";

export function pgfplotsPictureFontScale(axisOptions = {}) {
  const scale = Number(axisOptions[PGFPLOTS_PICTURE_SCALE_OPTION]);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

export function pgfplotsRoleFontCommand(role, axisOptions = {}, explicit = "") {
  // The axis-level TikZ `font` key is inherited by every PGFPlots role.
  // A role-specific style still wins, matching the normal TikZ option order.
  const inherited = String(axisOptions.font || "").trim();
  return libraryRoleFontCommand("pgfplots", role, {
    profile: libraryFontProfile("pgfplots", axisOptions),
    explicit: String(explicit || "").trim() || inherited,
    scale: pgfplotsPictureFontScale(axisOptions)
  });
}
