import { fontStyleSheet } from "../../fonts/index.js";

export function renderDefaultFontStyleDef(options = {}) {
  const css = fontStyleSheet(options);
  return css ? `<style class="tikzkit-default-font-style"><![CDATA[${css}]]></style>` : "";
}
