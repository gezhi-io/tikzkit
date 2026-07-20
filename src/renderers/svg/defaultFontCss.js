const DEFAULT_FONT_URL_PREFIX = "/fonts/";

export function renderDefaultFontStyleDef(options = {}) {
  const prefix = normalizedFontUrlPrefix(options.fontUrlPrefix);
  return `<style class="tikzkit-default-font-style"><![CDATA[
@font-face{font-family:TikZKitCMUSerif;font-style:normal;font-weight:400;src:url('${prefix}TikZKitCMUSerif-Roman.otf') format('opentype')}
@font-face{font-family:TikZKitCMUSerif;font-style:italic;font-weight:400;src:url('${prefix}TikZKitCMUSerif-Italic.otf') format('opentype')}
@font-face{font-family:TikZKitCMUSerif;font-style:normal;font-weight:700;src:url('${prefix}TikZKitCMUSerif-Bold.otf') format('opentype')}
@font-face{font-family:TikZKitCMUSerif;font-style:italic;font-weight:700;src:url('${prefix}TikZKitCMUSerif-BoldItalic.otf') format('opentype')}
@font-face{font-family:TikZKitCMR5;font-style:normal;font-weight:400;src:url('${prefix}TikZKitCMR5-Regular.otf') format('opentype')}
@font-face{font-family:TikZKitCMR6;font-style:normal;font-weight:400;src:url('${prefix}TikZKitCMR6-Regular.otf') format('opentype')}
@font-face{font-family:TikZKitCMR7;font-style:normal;font-weight:400;src:url('${prefix}TikZKitCMR7-Regular.otf') format('opentype')}
@font-face{font-family:TikZKitCMR8;font-style:normal;font-weight:400;src:url('${prefix}TikZKitCMR8-Regular.otf') format('opentype')}
@font-face{font-family:TikZKitCMR9;font-style:normal;font-weight:400;src:url('${prefix}TikZKitCMR9-Regular.otf') format('opentype')}
@font-face{font-family:TikZKitCMR10;font-style:normal;font-weight:400;src:url('${prefix}TikZKitCMR10-Regular.otf') format('opentype')}
@font-face{font-family:TikZKitCMR12;font-style:normal;font-weight:400;src:url('${prefix}TikZKitCMR12-Regular.otf') format('opentype')}
@font-face{font-family:TikZKitCMR17;font-style:normal;font-weight:400;src:url('${prefix}TikZKitCMR17-Regular.otf') format('opentype')}
@font-face{font-family:TikZKitCMBX5;font-style:normal;font-weight:700;src:url('${prefix}TikZKitCMBX5-Bold.otf') format('opentype')}
@font-face{font-family:TikZKitCMBX6;font-style:normal;font-weight:700;src:url('${prefix}TikZKitCMBX6-Bold.otf') format('opentype')}
@font-face{font-family:TikZKitCMBX7;font-style:normal;font-weight:700;src:url('${prefix}TikZKitCMBX7-Bold.otf') format('opentype')}
@font-face{font-family:TikZKitCMBX8;font-style:normal;font-weight:700;src:url('${prefix}TikZKitCMBX8-Bold.otf') format('opentype')}
@font-face{font-family:TikZKitCMBX9;font-style:normal;font-weight:700;src:url('${prefix}TikZKitCMBX9-Bold.otf') format('opentype')}
@font-face{font-family:TikZKitCMBX10;font-style:normal;font-weight:700;src:url('${prefix}TikZKitCMBX10-Bold.otf') format('opentype')}
@font-face{font-family:TikZKitCMBX12;font-style:normal;font-weight:700;src:url('${prefix}TikZKitCMBX12-Bold.otf') format('opentype')}
@font-face{font-family:TikZKitCMUSans;font-style:normal;font-weight:400;src:url('${prefix}TikZKitCMUSans-Regular.otf') format('opentype')}
@font-face{font-family:TikZKitCMUSans;font-style:italic;font-weight:400;src:url('${prefix}TikZKitCMUSans-Italic.otf') format('opentype')}
@font-face{font-family:TikZKitCMUSans;font-style:normal;font-weight:700;src:url('${prefix}TikZKitCMUSans-Bold.otf') format('opentype')}
@font-face{font-family:TikZKitCMUSans;font-style:italic;font-weight:700;src:url('${prefix}TikZKitCMUSans-BoldItalic.otf') format('opentype')}
@font-face{font-family:TikZKitMath_Main;font-style:normal;font-weight:400;src:url('${prefix}TikZKitMath_Main-Regular.ttf') format('truetype')}
@font-face{font-family:TikZKitMath_Main;font-style:normal;font-weight:700;src:url('${prefix}TikZKitMath_Main-Bold.ttf') format('truetype')}
@font-face{font-family:TikZKitMath_Math;font-style:italic;font-weight:400;src:url('${prefix}TikZKitMath_Math-Italic.ttf') format('truetype')}
@font-face{font-family:TikZKitMath_Math;font-style:italic;font-weight:700;src:url('${prefix}TikZKitMath_Math-BoldItalic.ttf') format('truetype')}
@font-face{font-family:TikZKitMath_Caligraphic;font-style:normal;font-weight:400;src:url('${prefix}TikZKitMath_Caligraphic-Regular.ttf') format('truetype')}
@font-face{font-family:TikZKitMath_Caligraphic;font-style:normal;font-weight:700;src:url('${prefix}TikZKitMath_Caligraphic-Bold.ttf') format('truetype')}
]]></style>`;
}

function normalizedFontUrlPrefix(value) {
  const prefix = String(value || DEFAULT_FONT_URL_PREFIX);
  return prefix.endsWith("/") ? prefix : `${prefix}/`;
}
