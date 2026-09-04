#!/usr/bin/env python3
"""Build browser-loadable Computer Modern optical-size fonts from MacTeX."""

from __future__ import annotations

import argparse
from pathlib import Path

from fontTools import agl, t1Lib
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.t2CharStringPen import T2CharStringPen


DEFAULT_TEX_FONT_DIR = Path(
    "/usr/local/texlive/2025/texmf-dist/fonts/type1/public/amsfonts/cm"
)


def type1_width_and_lsb(char_string) -> tuple[int, int]:
    char_string.decompile()
    program = char_string.program
    stack: list[float] = []
    for token in program:
        if isinstance(token, (int, float)):
            stack.append(float(token))
        elif token == "div" and len(stack) >= 2:
            denominator = stack.pop()
            numerator = stack.pop()
            stack.append(numerator / denominator)
        elif token == "hsbw" and len(stack) >= 2:
            width = stack.pop()
            lsb = stack.pop()
            return round(width), round(lsb)
    raise ValueError("Type 1 glyph does not declare hsbw metrics")


def unicode_cmap(encoding: list[str], glyph_order: list[str]) -> dict[int, str]:
    available = set(glyph_order)
    cmap: dict[int, str] = {}
    for codepoint, glyph_name in enumerate(encoding):
        # TeX gets interword spacing from the TFM font dimensions.  Slot 32 in
        # Computer Modern's Type 1 encoding is the visible ``suppress`` glyph,
        # not a Unicode space.  Mapping it directly makes browser-rendered
        # words look like ``Tesla-Model-Y``.  A blank glyph with the native
        # spacing advance is added below and owns U+0020 instead.
        if codepoint == 32:
            continue
        if glyph_name in available and glyph_name != ".notdef" and 32 <= codepoint <= 126:
            cmap[codepoint] = glyph_name
    if "space" in available:
        cmap[0x20] = "space"
    for glyph_name in glyph_order:
        if glyph_name == ".notdef":
            continue
        characters = agl.toUnicode(glyph_name)
        if len(characters) == 1:
            cmap.setdefault(ord(characters), glyph_name)
    return cmap


def convert_type1_to_otf(
    source: Path,
    output: Path,
    family_name: str,
    *,
    style_name: str = "Regular",
    weight_name: str = "Regular",
    weight_class: int = 400,
) -> None:
    type1 = t1Lib.T1Font(str(source))
    type1.parse()
    glyph_set = type1.getGlyphSet()
    glyph_order = [".notdef", *sorted(name for name in glyph_set.keys() if name != ".notdef")]
    char_strings = {}
    metrics = {}

    for glyph_name in glyph_order:
        source_glyph = glyph_set[glyph_name]
        width, lsb = type1_width_and_lsb(source_glyph)
        pen = T2CharStringPen(width, glyph_set)
        source_glyph.draw(pen)
        char_strings[glyph_name] = pen.getCharString()
        metrics[glyph_name] = (width, lsb)

    if "space" not in char_strings:
        # Some Type 1 variants omit the unencoded blank glyph.  In Computer
        # Modern Roman the hyphen advance equals the TFM interword space for
        # each optical design size, so it is a reliable fallback width.
        space_width = metrics["hyphen"][0]
        space_pen = T2CharStringPen(space_width, glyph_set)
        char_strings["space"] = space_pen.getCharString()
        metrics["space"] = (space_width, 0)
        glyph_order.append("space")

    font_info = type1.font.get("FontInfo", {})
    bbox = tuple(int(value) for value in type1.font.get("FontBBox", (-50, -250, 1100, 750)))
    full_name = family_name if style_name == "Regular" else f"{family_name} {style_name}"
    postscript_name = family_name.replace(" ", "") + ("" if style_name == "Regular" else f"-{style_name}")
    builder = FontBuilder(1000, isTTF=False)
    builder.setupGlyphOrder(glyph_order)
    builder.setupCharacterMap(unicode_cmap(type1.font.get("Encoding", []), glyph_order))
    builder.setupCFF(
        postscript_name,
        {
            "FullName": full_name,
            "FamilyName": family_name,
            "Weight": weight_name,
            "version": str(font_info.get("version", "1.0")),
        },
        char_strings,
        {},
    )
    builder.setupHorizontalMetrics(metrics)
    builder.setupHorizontalHeader(ascent=bbox[3], descent=bbox[1])
    builder.setupNameTable(
        {
            "familyName": family_name,
            "styleName": style_name,
            "uniqueFontIdentifier": f"TikZKit:{family_name}:{style_name}",
            "fullName": full_name,
            "psName": postscript_name,
            "version": "Version 1.0",
        }
    )
    builder.setupOS2(
        sTypoAscender=bbox[3],
        sTypoDescender=bbox[1],
        usWinAscent=max(0, bbox[3]),
        usWinDescent=max(0, -bbox[1]),
        usWeightClass=weight_class,
    )
    builder.setupPost(keepGlyphNames=True)
    builder.setupMaxp()
    output.parent.mkdir(parents=True, exist_ok=True)
    builder.save(str(output))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tex-font-dir", type=Path, default=DEFAULT_TEX_FONT_DIR)
    parser.add_argument("--output-dir", type=Path, default=Path("web/fonts"))
    args = parser.parse_args()
    # These are the Computer Modern Roman design sizes shipped by MacTeX.
    # LaTeX selects among them instead of scaling one 10pt outline for every
    # command from \tiny through \Huge.
    for size in (5, 6, 7, 8, 9, 10, 12, 17):
        convert_type1_to_otf(
            args.tex_font_dir / f"cmr{size}.pfb",
            args.output_dir / f"TikZKitCMR{size}-Regular.otf",
            f"TikZKit CMR{size}",
        )
    # OT1 Computer Modern Roman maps every requested small-caps size to the
    # cmcsc10 design face. Lowercase slots hold true small-cap outlines while
    # uppercase slots remain full height.
    convert_type1_to_otf(
        args.tex_font_dir / "cmcsc10.pfb",
        args.output_dir / "TikZKitCMSC10-Regular.otf",
        "TikZKit CMSC10",
    )
    # LaTeX's bold Computer Modern Roman uses the CMBX optical family.  There
    # is no cmbx17 outline; larger bold text scales cmbx12, as NFSS does.
    for size in (5, 6, 7, 8, 9, 10, 12):
        convert_type1_to_otf(
            args.tex_font_dir / f"cmbx{size}.pfb",
            args.output_dir / f"TikZKitCMBX{size}-Bold.otf",
            f"TikZKit CMBX{size}",
            style_name="Bold",
            weight_name="Bold",
            weight_class=700,
        )


if __name__ == "__main__":
    main()
