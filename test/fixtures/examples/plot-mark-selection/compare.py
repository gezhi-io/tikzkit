"""python3 compare.py <strict-output> <comparison.png> (requires Pillow, Poppler and librsvg)."""
import json
import math
import subprocess
import sys
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFont

stage, destination = map(Path, sys.argv[1:])
summary = json.loads((stage / "summary.json").read_text())
cases = json.loads((Path(summary["fixtureRoot"]) / "manifest.json").read_text())["cases"]
measured = {r["id"]: r["centers"] for r in json.loads((stage/"after/browser.json").read_text())["results"]}
expected = {"manual-sine-repeat":{"cross":7}, "manual-sine-phase":{"cross":5},
            "manual-sine-indices":{"cross":11}, "axis-marker-streams":{"red":5,"blue":3}}
native = stage / "reference-288dpi"
native.mkdir(exist_ok=True)
titles = ["Every third observation", "Start at the sixth observation", "Explicit list of eleven", "Clipped series and legend"]
columns = ["Before (browser)", "After (browser)", "Download reopened", "MacTeX PDF", "tikztosvg", "After / PDF difference"]
cell, inset, w = 325, 12, 6 * 325
paper = Image.new("RGB", (w, 84 + len(cases) * 720), "white")
draw = ImageDraw.Draw(paper)
def font(pt):
    try:
        return ImageFont.truetype("Arial.ttf", pt)
    except OSError:
        return ImageFont.load_default(size=pt)

draw.text((inset, 8), "Plot mark selection", fill="#17212b", font=font(26))
for i, col in enumerate(columns):
    draw.text((cell*i+inset, 48), col, fill="#34495b", font=font(19))
y = 84
def load(p):
    im = Image.open(p).convert("RGBA")
    white = Image.new("RGBA", im.size, "white")
    return Image.alpha_composite(white, im).convert("RGB")

for case, title in zip(cases, titles, strict=True):
    name = case["id"]
    for kind, number in expected[name].items():
        pts = measured[name]
        for reference in ["download", "tikztosvg"]:
            candidates = list(pts[reference][kind])
            assert len(candidates) == len(pts["live"][kind]) == number
            # Match bijectively; equal counts alone would miss shifted or duplicated marks.
            for point in pts["live"][kind]:
                i = min(range(len(candidates)), key=lambda i: math.dist(point, candidates[i]))
                assert math.dist(point, candidates.pop(i)) < 0.01, (name, kind, reference, point)
    reference = next(c for c in summary["cases"] if c["id"] == name)
    pdf = stage / ".mactex-work" / name / "reference.pdf"
    subprocess.run(["pdftocairo", "-r", "288", "-png", "-singlefile", str(pdf), str(native / name)], check=True)
    svgpng = native / (name + "-svg.png")
    subprocess.run(["rsvg-convert", "--dpi-x", "288", "--dpi-y", "288", "-o", str(svgpng), str(stage / reference["tikztosvgSvg"])], check=True)
    panels = [load(stage / "before" / (name + ".png")), load(stage / "after" / (name + ".png")),
              load(stage / "after" / (name + "-download.png")), load(native / (name + ".png")), load(svgpng)]
    size = tuple(max(p.size[i] for p in panels) for i in (0, 1))
    def page(im):
        out = Image.new("RGB", size, "white")
        out.paste(im, (0,0))
        return out
    diff = ImageChops.difference(page(panels[1]), page(panels[3])).convert("L")
    panels.append(Image.merge("RGB", (Image.new("L", size, 255), ImageChops.invert(diff), ImageChops.invert(diff))))
    draw.rectangle((0,y,w,y+29), fill="#eef3f5")
    draw.text((inset,y+3), title, fill="#243645", font=font(19))
    y += 37
    for i, im in enumerate(panels):
        # One pixel scale and a common top-left paper origin for every panel.
        im = im.resize(tuple(max(1, round(v*.257)) for v in im.size), Image.Resampling.LANCZOS)
        paper.paste(im, (cell*i+inset, y))
    y += round(size[1]*.257) + 14
paper.crop((0,0,w,y)).save(destination, optimize=True)
