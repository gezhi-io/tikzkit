#!/usr/bin/env python3
from pathlib import Path

from fontTools.ttLib import TTFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "node_modules" / "katex" / "dist" / "fonts"
OUTPUT = ROOT / "web" / "fonts"

FONT_VARIANTS = (
    ("KaTeX_Main-Regular.ttf", "TikZKitMath_Main-Regular.ttf", "TikZKitMath_Main", "Regular"),
    ("KaTeX_Main-Bold.ttf", "TikZKitMath_Main-Bold.ttf", "TikZKitMath_Main", "Bold"),
    ("KaTeX_Math-Italic.ttf", "TikZKitMath_Math-Italic.ttf", "TikZKitMath_Math", "Italic"),
    ("KaTeX_Math-BoldItalic.ttf", "TikZKitMath_Math-BoldItalic.ttf", "TikZKitMath_Math", "Bold Italic"),
    (
        "KaTeX_Caligraphic-Regular.ttf",
        "TikZKitMath_Caligraphic-Regular.ttf",
        "TikZKitMath_Caligraphic",
        "Regular",
    ),
    (
        "KaTeX_Caligraphic-Bold.ttf",
        "TikZKitMath_Caligraphic-Bold.ttf",
        "TikZKitMath_Caligraphic",
        "Bold",
    ),
)


def postscript_name(family: str, style: str) -> str:
    suffix = style.replace(" ", "")
    return f"{family.replace('_', '')}-{suffix}"


def rewrite_name_table(font: TTFont, family: str, style: str) -> None:
    full_name = f"{family.replace('_', ' ')} {style}"
    unique_name = f"TikZKit;{family};{style}"
    values = {
        1: family,
        2: style,
        3: unique_name,
        4: full_name,
        6: postscript_name(family, style),
        16: family,
        17: style,
    }
    name_table = font["name"]
    for record in name_table.names:
        value = values.get(record.nameID)
        if value is None:
            continue
        encoding = record.getEncoding()
        record.string = value.encode(encoding, errors="replace")


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for source_name, output_name, family, style in FONT_VARIANTS:
        font = TTFont(SOURCE / source_name)
        rewrite_name_table(font, family, style)
        font.save(OUTPUT / output_name, reorderTables=False)
        font.close()


if __name__ == "__main__":
    main()
