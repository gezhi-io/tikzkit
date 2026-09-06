#!/usr/bin/env python3
"""Rebuild the browser font module using only the installed TeX distribution."""
import base64
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unicodedata
import sys

from fontTools import subset, t1Lib
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
TEX = Path(subprocess.check_output(["kpsewhich", "-var-value=TEXMFDIST"], text=True).strip())
OUT = ROOT / "web/fonts"
MODULE = ROOT / "src/fonts"
OUT.mkdir(parents=True, exist_ok=True)
MODULE.mkdir(parents=True, exist_ok=True)
spec = importlib.util.spec_from_file_location("optical", ROOT / "scripts/build-cm-optical-fonts.py")
sys.dont_write_bytecode = True
optical = importlib.util.module_from_spec(spec)
spec.loader.exec_module(optical)
manifest = []
data = {}
type1_cache = {}
METRICS_SOURCE = ROOT / "node_modules/katex/src/fontMetricsData.js"
metric_codepoints = {
    name: set(values) for name, values in json.loads(subprocess.check_output([
        "node", "--input-type=module", "-e",
        'import fs from "node:fs"; const {default: metrics} = await import('
        '"data:text/javascript;base64," + fs.readFileSync(process.argv[1]).toString("base64"));'
        'console.log(JSON.stringify(Object.fromEntries(Object.entries(metrics).map('
        '([name, values]) => [name, Object.keys(values).map(Number)]))));',
        str(METRICS_SOURCE)
    ], text=True)).items()
}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def renamed(font, family, style):
    names = {1: family, 2: style, 3: f"TikZKit:{family}:{style}",
             4: f"{family} {style}", 6: family.replace("_", "") + "-" + style.replace(" ", ""),
             16: family, 17: style}
    for record in font["name"].names:
        if record.nameID in names:
            record.string = names[record.nameID].encode(record.getEncoding(), errors="replace")
    font["head"].created = font["head"].modified = 3786912000


def emit(font, source, family, style="Regular", license="GUST-FONT-LICENSE.txt", aliases=None, coverage=None):
    renamed(font, family, style)
    font.recalcTimestamp = False
    font.flavor = "woff"
    file = family + "-" + style.replace(" ", "") + ".woff"
    path = OUT / file
    font.save(path, reorderTables=False)
    record = {"family": family, "style": "italic" if "Italic" in style else "normal",
              "weight": 700 if "Bold" in style else 400, "file": file, "format": "woff",
              "source": str(source.relative_to(TEX)), "sourceSha256": digest(source),
              "sha256": digest(path), "license": license}
    if aliases:
        record["aliases"] = aliases
    if coverage:
        record["coverage"] = coverage
    manifest.append(record)
    data[file] = "data:font/woff;base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def native_glyphs(font, mapping, basename, slots, aliases):
    source = TEX / f"fonts/type1/public/amsfonts/{basename}.pfb"
    if basename not in type1_cache:
        native = t1Lib.T1Font(str(source))
        native.parse()
        type1_cache[basename] = native
    native = type1_cache[basename]
    glyphs = native.getGlyphSet()
    cff = font["CFF "].cff
    top = cff.topDictIndex[0]
    assert font["head"].unitsPerEm == 1000
    for cp, slot in slots.items():
        code, y_shift = slot if isinstance(slot, tuple) else (slot, 0)
        source_name = native.font["Encoding"][code]
        assert source_name != ".notdef", (basename, code)
        glyph = glyphs[source_name]
        width, lsb = optical.type1_width_and_lsb(glyph)
        name = f"native-{basename.replace('/', '-')}-{code:02x}-{y_shift}"
        if name not in top.CharStrings.charStrings:
            # CFF widths are relative to the destination Private dictionary.
            pen = T2CharStringPen(width - top.Private.nominalWidthX, glyphs)
            glyph.draw(TransformPen(pen, (1, 0, 0, 1, 0, y_shift)))
            char_string = pen.getCharString(private=top.Private, globalSubrs=cff.GlobalSubrs)
            strings = top.CharStrings
            strings.charStrings[name] = len(strings.charStringsIndex)
            strings.charStringsIndex.append(char_string)
            top.charset.append(name)
            font["hmtx"].metrics[name] = (width, lsb)
        mapping[cp] = name
        aliases[f"U+{cp:04X}"] = {
            "source": str(source.relative_to(TEX)), "sourceSha256": digest(source),
            "sourceCode": code, "sourceGlyph": source_name, "yShift": y_shift,
            "license": "OFL-AMSFonts.txt"
        }
    font.setGlyphOrder(top.charset)


def apply_cmap(font, mapping):
    for table in font["cmap"].tables:
        if table.isUnicode():
            table.cmap = mapping.copy()


def role_subset(font, family, style):
    metrics_name = f"{family}-{style}"
    if family in ("Caligraphic", "Fraktur"):
        metrics_name = f"{family}-Regular"
    required = metric_codepoints[metrics_name]
    cmap = font.getBestCmap()
    keep = set(required)
    # Text-bearing roles retain the existing Latin/Greek/combining repertoire,
    # including characters for which KaTeX estimates rather than stores metrics.
    if family in ("Main", "Math", "SansSerif", "Typewriter"):
        keep.update(cp for cp in cmap if cp < 0x2100)
    before = set(cmap) & keep
    options = subset.Options()
    options.recalc_timestamp = False
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14, 16, 17]
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=keep)
    subsetter.subset(font)
    after = set(font.getBestCmap())
    assert before <= after, (family, style, sorted(before - after))
    missing = sorted(required - after)
    allowed_missing = {
        "Main-Regular": {0x23B0, 0x23B1},  # Small moustaches have no single LM glyph.
        "AMS-Regular": {0x21E0, 0x21E2},  # Native dashed arrows are composed in TeX.
        "Fraktur-Bold": {0xE300, 0xE307},  # These regular Euler alternates have no bold slot.
    }.get(f"{family}-{style}", set())
    assert set(missing) == allowed_missing, (metrics_name, [f"U+{cp:04X}" for cp in missing])
    return {"metricsFont": metrics_name, "required": len(required),
            "covered": len(required) - len(missing), "missing": [f"U+{cp:04X}" for cp in missing],
            "metricsSha256": digest(METRICS_SOURCE)}


CMU = TEX / "fonts/opentype/public/cm-unicode"
for family, variants in {
    "TikZKitCMUSerif": [("cmunrm", "Regular"), ("cmunti", "Italic"), ("cmunbx", "Bold"), ("cmunbi", "BoldItalic")],
    "TikZKitCMUSans": [("cmunss", "Regular"), ("cmunsi", "Italic"), ("cmunsx", "Bold"), ("cmunso", "BoldItalic")],
    "TikZKitCMUMono": [("cmuntt", "Regular"), ("cmunit", "Italic"), ("cmuntb", "Bold"), ("cmuntx", "BoldItalic")],
}.items():
    for name, style in variants:
        source = CMU / (name + ".otf")
        emit(TTFont(source), source, family, style, "OFL-CM-Unicode.txt")

for name, style in [("regular", "Regular"), ("italic", "Italic"), ("bold", "Bold"), ("bolditalic", "BoldItalic")]:
    source = TEX / f"fonts/opentype/public/tex-gyre/texgyreheros-{name}.otf"
    emit(TTFont(source), source, "TikZKitHeros", style)

with tempfile.TemporaryDirectory() as temporary:
    for family, basename, style in [
        *[(f"TikZKitCMR{s}", f"cmr{s}", "Regular") for s in (5, 6, 7, 8, 9, 10, 12, 17)],
        *[(f"TikZKitCMBX{s}", f"cmbx{s}", "Bold") for s in (5, 6, 7, 8, 9, 10, 12)],
        ("TikZKitCMSC10", "cmcsc10", "Regular")
    ]:
        source = TEX / f"fonts/type1/public/amsfonts/cm/{basename}.pfb"
        converted = Path(temporary) / "font.otf"
        optical.convert_type1_to_otf(source, converted, family, style_name=style,
                                    weight_name=style, weight_class=700 if style == "Bold" else 400)
        emit(TTFont(converted), source, family, style, "OFL-AMSFonts.txt")

    # NFSS uses CMSY for \mathcal, MSBM for \mathbb, and Euler for \mathfrak.
    # Unicode LM Math alphabets have different outlines despite similar names.
    for family, basename, style in [
        ("AMSCaps", "symbols/msbm10", "Regular"),
        ("Caligraphic", "cm/cmsy10", "Regular"),
        ("Caligraphic", "cm/cmbsy10", "Bold"),
        ("Fraktur", "euler/eufm10", "Regular"),
        ("Fraktur", "euler/eufb10", "Bold"),
    ]:
        source = TEX / f"fonts/type1/public/amsfonts/{basename}.pfb"
        converted = Path(temporary) / "symbol.otf"
        optical.convert_type1_to_otf(source, converted, "TikZKitMath_" + family,
                                    style_name=style, weight_name=style,
                                    weight_class=700 if style == "Bold" else 400)
        font = TTFont(converted)
        aliases = {}
        mapping = font.getBestCmap().copy()
        if family == "Fraktur":
            slots = range(1, 7) if style == "Bold" else range(8)
            native_glyphs(font, mapping, basename, {0xE300 + i: i for i in slots}, aliases)
        if family != "AMSCaps":
            mapping[0xA0] = mapping[0x20]
        apply_cmap(font, mapping)
        if family == "AMSCaps":
            subsetter = subset.Subsetter()
            subsetter.populate(unicodes=range(ord("A"), ord("Z") + 1))
            subsetter.subset(font)
            coverage = None
        else:
            coverage = role_subset(font, family, style)
        emit(font, source, "TikZKitMath_" + family, style, "OFL-AMSFonts.txt", aliases, coverage)

MATH = TEX / "fonts/opentype/public/lm-math/latinmodern-math.otf"

# TeX slots are declared in MacTeX fontmath.ltx and amssymb.sty. The PUA
# codepoints identify KaTeX's layout slots; every outline comes from MacTeX.
AMS_B_SLOTS = {
    0xE00C: 0x00, 0xE00D: 0x01, 0xE010: 0x0A, 0xE00F: 0x0B,
    0xE011: 0x14, 0xE00E: 0x15, 0xE01A: 0x20, 0xE01B: 0x21,
    0xE016: 0x22, 0xE018: 0x23, 0xE017: 0x26, 0xE019: 0x27,
    0xE006: 0x2E, 0xE007: 0x2F, 0xE008: 0x7A, 0xE009: 0x7B,
    0x0127: 0x7E, 0x03DD: 0x7A, 0x2132: 0x60, 0x2141: 0x61,
    0x2571: 0x1E, 0x2572: 0x1F, 0x2AB5: 0x16, 0x2AB6: 0x17,
    0x2AB7: 0x77, 0x2AB8: 0x76, 0x2AB9: 0x18, 0x2ABA: 0x19,
    0x2ACB: 0x24, 0x2ACC: 0x25,
}
AMS_A_SLOTS = {
    0x22D4: 0x74, 0x24C8: 0x73, 0x2605: 0x46, 0x29EB: 0x07,
    0x2A5E: 0x5B, 0x2AC5: 0x6A, 0x2AC6: 0x6B,
}


def alphabet_aliases(cmap, alphabet):
    result = {}
    for cp, name in list(cmap.items()):
        if cp > 0xffff:
            continue
        char_name = unicodedata.name(chr(cp), "")
        char_name = char_name.removeprefix("GREEK ").removeprefix("LATIN ")
        char_name = char_name.replace("CAPITAL LETTER ", "CAPITAL ").replace("SMALL LETTER ", "SMALL ")
        try:
            target = ord(unicodedata.lookup("MATHEMATICAL " + alphabet + " " + char_name))
        except KeyError:
            continue
        if target in cmap:
            result[cp] = cmap[target]
    # Unicode encodes these historical mathematical letters in Letterlike Symbols.
    holes = {
        "ITALIC": {"h": 0x210e},
        "SCRIPT": {"B": 0x212c, "E": 0x2130, "F": 0x2131, "H": 0x210b, "I": 0x2110, "L": 0x2112, "M": 0x2133, "R": 0x211b},
        "FRAKTUR": {"C": 0x212d, "H": 0x210c, "I": 0x2111, "R": 0x211c, "Z": 0x2128},
        "DOUBLE-STRUCK": {"C": 0x2102, "H": 0x210d, "N": 0x2115, "P": 0x2119, "Q": 0x211a, "R": 0x211d, "Z": 0x2124}
    }
    for char, cp in holes.get(alphabet, {}).items():
        if cp in cmap:
            result[ord(char)] = cmap[cp]
    return result


for family, style, alphabet, size in [
    ("Main", "Regular", None, 0), ("Main", "Bold", "BOLD", 0),
    ("Main", "Italic", "ITALIC", 0), ("Main", "BoldItalic", "BOLD ITALIC", 0),
    ("Math", "Italic", "ITALIC", 0), ("Math", "BoldItalic", "BOLD ITALIC", 0),
    ("AMS", "Regular", "DOUBLE-STRUCK", 0),
    ("Script", "Regular", "SCRIPT", 0),
    ("SansSerif", "Regular", "SANS-SERIF", 0), ("SansSerif", "Italic", "SANS-SERIF ITALIC", 0),
    ("SansSerif", "Bold", "SANS-SERIF BOLD", 0), ("Typewriter", "Regular", "MONOSPACE", 0),
    *[(f"Size{s}", "Regular", None, s) for s in (1, 2, 3, 4)]
]:
    font = TTFont(MATH)
    original = font.getBestCmap()
    mapping = {cp: glyph for cp, glyph in original.items() if cp <= 0xffff}
    aliases = {}
    if alphabet:
        mapping.update(alphabet_aliases(original, alphabet))
    if size:
        variants = font["MATH"].table.MathVariants
        constructions = dict(zip(variants.VertGlyphCoverage.glyphs, variants.VertGlyphConstruction))
        for cp, glyph in list(mapping.items()):
            construction = constructions.get(glyph)
            if not construction or not construction.MathGlyphVariantRecord:
                continue
            choices = construction.MathGlyphVariantRecord
            if cp in (0x2211, 0x220f, 0x222b, 0x222e, 0x2210, 0x22c0, 0x22c1, 0x22c2, 0x22c3, 0x2a00, 0x2a01, 0x2a02, 0x2a04, 0x2a06):
                selected = choices[min(size - 1, len(choices) - 1)]
            else:
                target = {1: 1200, 2: 1800, 3: 2400, 4: 3000}[size]
                selected = min(choices, key=lambda choice: abs(choice.AdvanceMeasurement - target))
            mapping[cp] = selected.VariantGlyph
    for cp, equivalent in {0x02C9: 0x00AF, 0x02CA: 0x00B4, 0x02CB: 0x0060}.items():
        if cp in metric_codepoints[f"{family}-{style}"] and cp not in mapping:
            mapping[cp] = original[equivalent]
    if family == "Math":
        native_glyphs(font, mapping, "cm/cmmib10" if "Bold" in style else "cm/cmmi10",
                      {0xE131: 0x7B, 0xE237: 0x7C}, aliases)
    if family == "Main" and style in ("Regular", "Bold"):
        native_glyphs(font, mapping, "cm/cmbsy10" if style == "Bold" else "cm/cmsy10",
                      {0xE020: 0x36}, aliases)
        native_glyphs(font, mapping, "cm/cmmib10" if style == "Bold" else "cm/cmmi10",
                      {0x25B9: 0x2E, 0x25C3: 0x2F}, aliases)
    if family == "AMS":
        native_glyphs(font, mapping, "symbols/msbm10", AMS_B_SLOTS, aliases)
        native_glyphs(font, mapping, "symbols/msam10", AMS_A_SLOTS, aliases)
    if family == "Typewriter":
        native_glyphs(font, mapping, "cm/cmtt10", {0x7F: 0x7F}, aliases)
    if family == "Size4":
        native_glyphs(font, mapping, "cm/cmex10", {
            0xE000: (0x75, 605), 0xE001: (0x76, 565),
            0xE150: 0x7A, 0xE151: 0x7B, 0xE152: 0x7C, 0xE153: 0x7D
        }, aliases)
    apply_cmap(font, mapping)
    # The HTML math layout selects the style and delimiter variant explicitly.
    for table in ("MATH", "GSUB", "GPOS", "FFTM"):
        if table in font:
            del font[table]
    coverage = role_subset(font, family, style)
    emit(font, MATH, "TikZKitMath_" + family, style, aliases=aliases, coverage=coverage)

for source, target in [
    ("doc/fonts/amsfonts/OFL.txt", "OFL-AMSFonts.txt"),
    ("doc/fonts/cm-unicode/OFL.txt", "OFL-CM-Unicode.txt"),
    ("doc/fonts/lm-math/GUST-FONT-LICENSE.txt", "GUST-FONT-LICENSE.txt"),
    ("doc/latex/base/lppl.txt", "LPPL.txt"),
    ("doc/fonts/lm-math/README-Latin-Modern-Math.txt", "README-Latin-Modern-Math.txt"),
    ("doc/fonts/lm-math/MANIFEST-Latin-Modern-Math.txt", "MANIFEST-Latin-Modern-Math.txt"),
    ("doc/fonts/tex-gyre/README-TeX-Gyre-Heros.txt", "README-TeX-Gyre-Heros.txt"),
    ("doc/fonts/tex-gyre/MANIFEST-TeX-Gyre-Heros.txt", "MANIFEST-TeX-Gyre-Heros.txt")
]:
    shutil.copyfile(TEX / source, OUT / target)
manifest_text = json.dumps(manifest, indent=2) + "\n"
(OUT / "manifest.json").write_text(manifest_text)
(MODULE / "manifest.js").write_text("// Generated by scripts/build-mactex-fonts.py.\nexport const fontManifest = " + manifest_text.rstrip() + ";\n")
(MODULE / "data.js").write_text("// Generated exclusively from the MacTeX sources listed in manifest.js.\nexport const fontData = " + json.dumps(data, separators=(",", ":")) + ";\n")
print(f"Built {len(manifest)} MacTeX font faces")
