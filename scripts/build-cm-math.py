"""Extract CM math boxes and optical outlines from the installed MacTeX files."""
import json
import struct
from fontTools import agl, t1Lib
from fontTools.tfmLib import TFM
from fontTools.ttLib import TTFont


def first_match_programs(tfm):
    """Keep TeX's first matching lig/kern instruction, not the last one.

    FontTools exposes a flattened map with later matches overwriting earlier
    ones. CMR's k/v program deliberately precedes a shared w program containing
    a second, different kern for 'a'. Decode only this ordered part of the
    already validated TFM; font dimensions still use the standard parser.
    """
    data = tfm._data
    _, lh, bc, ec, nw, nh, nd, ni, nl, _, _, _ = struct.unpack_from(">12H", data)
    chars = 6 + lh - bc
    lig_base = chars + ec + 1 + nw + nh + nd + ni
    kern_base = lig_base + nl
    ligatures, kerning = {}, {}
    for char in tfm.chars:
        _, _, tag, index = struct.unpack_from("4B", data, 4 * (chars + char))
        if tag % 4 != 1:
            continue
        skip, right, op, remainder = struct.unpack_from("4B", data, 4 * (lig_base + index))
        if skip > 128:
            index = 256 * op + remainder
        seen = set()
        while index < nl:
            skip, right, op, remainder = struct.unpack_from("4B", data, 4 * (lig_base + index))
            if skip <= 128 and right not in seen:
                seen.add(right)
                if op >= 128:
                    offset = kern_base + 256 * (op - 128) + remainder
                    kerning.setdefault(char, {})[right] = struct.unpack_from(">i", data, 4 * offset)[0] / 2**20
                else:
                    operation = op if op == 4 or (op > 7 and op != 11) else (
                        ("/" if op % 4 > 1 else "") + "LIG" + ("/" if op % 2 else "") + ">" * (op // 4))
                    ligatures.setdefault(char, {})[right] = (operation, remainder)
            if skip >= 128:
                break
            index += skip + 1
    tfm.ligatures, tfm.kerning = ligatures, kerning


def character_map(encoding, role):
    overrides = {1: "\u0394", 10: "\u03a9"} if role not in ("CMSY", "CMBSY") else {}
    if role in ("CMMI", "CMMIB"):
        overrides.update({15: "\u03f5", 22: "\u03bc", 30: "\u03d5", 36: "\u03d6",
                          37: "\u03f1", 39: "\u03c6"})
    if role in ("CMSY", "CMBSY"):
        # fontmath.ltx assigns prime, negation and Re/Im to these CMSY slots.
        # Adobe's generic glyph-name mapping does not identify the outlines.
        overrides.update({48: "\u2032", 54: "\u0338", 60: "\u211c", 61: "\u2111",
                          107: "\u2016"})
    result = {}
    for slot, name in enumerate(encoding):
        char = overrides.get(slot, {"ff":"\ufb00", "fi":"\ufb01", "fl":"\ufb02", "ffi":"\ufb03", "ffl":"\ufb04"}.get(name, agl.toUnicode(name)))
        if name != ".notdef" and len(char) == 1:
            result.setdefault(char, (slot, name))
    return result


def build(tex, root, temporary, optical, emit, digest, metrics_only=False):
    records = {}
    sources = []
    for size in (5, 6, 7, 8, 9, 10, 12, 17):
        for role, basename in (("CMR", "cmr"), ("CMMI", "cmmi"), ("CMSY", "cmsy"),
                               ("CMBX", "cmbx"), ("CMMIB", "cmmib"), ("CMBSY", "cmbsy"),
                               ("CMTT", "cmtt"), ("CMTI", "cmti"),
                               ("CMSS", "cmss"), ("CMSSBX", "cmssbx")):
            if role == "CMSS" and size not in (8, 9, 10, 12, 17):
                continue
            if role == "CMSSBX" and size != 10:
                continue
            if role == "CMTT" and size not in (8, 9, 10, 12):
                continue
            if role == "CMTI" and size != 10:
                continue
            if size == 12 and role not in ("CMR", "CMMI", "CMBX", "CMTT", "CMSS"):
                continue
            if size == 17 and role not in ("CMR", "CMSS"):
                continue
            extra = size < 10 and role in ("CMMIB", "CMBSY")
            source = tex / f"fonts/type1/public/amsfonts/{'cmextra' if extra else 'cm'}/{basename}{size}.pfb"
            tfm_path = tex / f"fonts/tfm/public/{'amsfonts/cmextra' if extra else 'cm'}/{basename}{size}.tfm"
            font = t1Lib.T1Font(str(source))
            font.parse()
            mapping = character_map(font.font["Encoding"], role)
            tfm = TFM(str(tfm_path))
            first_match_programs(tfm)
            family = f"TikZKit{role}{size}"
            italic = role in ("CMMI", "CMMIB", "CMTI")
            bold = role in ("CMBX", "CMMIB", "CMBSY", "CMSSBX")
            style = ("BoldItalic" if italic else "Bold") if bold else ("Italic" if italic else "Regular")
            if not metrics_only and role not in ("CMR", "CMBX"):
                converted = temporary / "math.otf"
                optical.convert_type1_to_otf(source, converted, family, style_name=style,
                    character_map={ord(char): name for char, (_, name) in mapping.items()})
                emit(TTFont(converted), source, family, style, "OFL-AMSFonts.txt")
            records[f"{role}{size}"] = {
                "family": family, "style": "italic" if italic else "normal", "weight": 700 if bold else 400,
                "parameters": tfm.fontdimens,
                "glyphs": {char: [tfm.chars[slot].get(key, 0) for key in ("width", "height", "depth", "italic")]
                           for char, (slot, _) in mapping.items() if slot in tfm.chars},
                "kern": {left: {right: tfm.kerning[slot][rslot]
                                for right, (rslot, _) in mapping.items() if rslot in tfm.kerning.get(slot, {})}
                         for left, (slot, _) in mapping.items() if slot in tfm.kerning},
                # NFSS OML/cmm uses skewchar 127, OMS/cmsy uses 48. The
                # former has no Unicode mapping, but its kern still positions
                # math accents (TeX make_math_accent, section 741).
                "skewKern": {char: tfm.kerning[slot][skew]
                             for char, (slot, _) in mapping.items()
                             for skew in ([127] if role in ("CMMI", "CMMIB")
                                          else [48] if role in ("CMSY", "CMBSY") else [])
                             if skew in tfm.kerning.get(slot, {})},
                "ligatures": {left: {right: result
                    for right, (rslot, _) in mapping.items()
                    for result, (outslot, _) in mapping.items()
                    if tfm.ligatures.get(slot, {}).get(rslot) == ("LIG", outslot)}
                    for left, (slot, _) in mapping.items() if slot in tfm.ligatures}
            }
            sources.append({"file": str(tfm_path.relative_to(tex)), "sha256": digest(tfm_path)})
    for size, directory in ((7, "amsfonts/cmextra"), (8, "amsfonts/cmextra"), (9, "amsfonts/cmextra"), (10, "cm")):
        tfm_path = tex / f"fonts/tfm/public/{directory}/cmex{size}.tfm"
        source = tex / f"fonts/type1/public/amsfonts/{'cmextra' if size < 10 else 'cm'}/cmex{size}.pfb"
        font = t1Lib.T1Font(str(source))
        font.parse()
        tfm = TFM(str(tfm_path))
        family = f"TikZKitCMEX{size}"
        # Extension pieces have no Unicode identity. Keep each original TeX
        # slot addressable without remapping or stretching its native outline.
        mapping = {0xE000 + slot: font.font["Encoding"][slot] for slot in tfm.chars}
        if not metrics_only:
            converted = temporary / "math-extension.otf"
            optical.convert_type1_to_otf(source, converted, family, character_map=mapping)
            emit(TTFont(converted), source, family, "Regular", "OFL-AMSFonts.txt")
        records[f"CMEX{size}"] = {"family": family, "style": "normal", "weight": 400,
                                  "parameters": tfm.fontdimens, "slots": tfm.chars}
        sources.append({"file": str(tfm_path.relative_to(tex)), "sha256": digest(tfm_path)})
    destination = root / "src/tex/cmMathMetrics.js"
    destination.write_text("// Generated by scripts/build-mactex-fonts.py from local MacTeX TFM files.\n"
                           + "export const cmMathSources = " + json.dumps(sources, indent=2) + ";\n"
                           + "export const cmMathMetrics = " + json.dumps(records, ensure_ascii=True, separators=(",", ":"))
                           + ";\n", encoding="utf8")


if __name__ == "__main__":
    import argparse
    import hashlib
    from pathlib import Path

    parser = argparse.ArgumentParser(description="Refresh native CM metrics without rebuilding fonts")
    parser.add_argument("--metrics-only", action="store_true", required=True)
    parser.add_argument("--tex-root", type=Path, default=Path("/usr/local/texlive/2025/texmf-dist"))
    args = parser.parse_args()
    build(args.tex_root, Path(__file__).resolve().parents[1], None, None, None,
          lambda file: hashlib.sha256(file.read_bytes()).hexdigest(), metrics_only=True)
