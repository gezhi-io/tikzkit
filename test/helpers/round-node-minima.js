// Measured by the MINRADIUS probes in fixtures/round-node-outlines.tex.
// PGF halves a TeX dimension register (integer sp), not an ideal cm value.
export const radiusSpByMinimum = { "0.2cm": 186465, "0.4cm": 372930, "0.6cm": 559409, "0.65cm": 606015,
  "1cm": 932339, "8cm": 7458719, "8mm": 745871 };
export const measuredMinRadiusCm = length => radiusSpByMinimum[typeof length === "number" ? length + "cm" : length] * (2.54 / 72.27 / 65536);
