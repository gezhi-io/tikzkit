"""Fixed-scale overview and sloped-word detail, made from the five actual captures."""

import csv
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from locate import CENTER_TOL, PPM, PROBES, RGB, extent


PANELS = [("pdf", "Original PDF"), ("tikztosvg", "tikztosvg"), ("live", "Chrome workbench"),
          ("download", "Downloaded SVG"), ("export", "CLI SVG-text")]
TITLES = {"targets": "On-grid target identity", "diagonals": "Default, scalar and paired diagonals",
          "option-order": "Node distance: scope and local key order", "skew": "Skew basis and mixed units",
          "diagonal-decision-flow": "Decision flow", "on-grid-center-placement": "On-grid center placement",
          "standalone-precedence": "No-of grammar and at precedence"}
INK, MUTED, RULE = "#192c34", "#405662", "#bccbd0"
ACCENT, ERROR = "#056b52", "#b52f14"


def font(size, bold=False):
    file = "Arial Bold.ttf" if bold else "Arial.ttf"
    for name in ["/System/Library/Fonts/Supplemental/"+file, "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"]:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default(size=size)


def line(d, xy, text, size=15, color=INK, bold=False):
    d.text(xy, text, fill=color, font=font(size, bold))


def physical_tile(image, dims, origin, node_geometry, ref, page_mm, scale=4):
    w, h, ox, oy = dims
    tile = Image.new("RGB", (w*scale, h*scale), "white")
    dx, dy = np.rint(np.array([ox, oy])-origin).astype(int)
    tile.paste(image, (dx, dy))
    # All panels are padded first. There is exactly one 384 -> 96 dpi reduction,
    # independent of page size, bounding box, or the direction of a displacement.
    tile = tile.resize((w, h), Image.Resampling.LANCZOS)
    d = ImageDraw.Draw(tile)
    pw, ph = np.array(page_mm)*PPM
    d.rectangle((dx/scale, dy/scale, (dx+pw)/scale, (dy+ph)/scale), outline=RULE)
    missing = []
    for k, nn in ref["nodes"].items():
        expected = np.array(nn["relativeMm"])
        actual = node_geometry["nodes"].get(k)
        if actual:
            observed = np.array(actual["relativeMm"])
            if extent(observed-expected) <= CENTER_TOL:
                continue
        else:
            missing.append(k)
        point = lambda xy: (np.array([ox,oy])+xy*np.array([1,-1])*PPM)/scale
        x, y = point(expected)
        if actual:
            d.line([tuple(point(observed)), (x,y)], fill=ERROR, width=1)
        for a, b in [((x-4,y),(x+4,y)), ((x,y-4),(x,y+4))]:
            d.line([a,b], fill="white", width=3)
            d.line([a,b], fill=ERROR, width=1)
    return tile, missing


def make_sheets(root, capture, records, base_paths, text_rows):
    cells = []
    for entry in capture["rows"]:
        case, panels = entry["id"], records[entry["id"]]["panels"]
        ims = {k: Image.open(root/p["file"]).convert("RGB") for k,p in entry["panels"].items()}
        origins = {k: PPM*np.array(p["raster"]["originPageMm"]) for k,p in panels.items()}
        left, top = np.ceil(np.max(list(origins.values()),axis=0)).astype(int) + 20
        right, bottom = np.ceil(np.max([np.array(im.size)-origins[k] for k,im in ims.items()],axis=0)).astype(int) + 20
        w, h = math.ceil((left+right)/4), math.ceil((top+bottom)/4)
        row = []
        for k, _ in PANELS:
            tile, missing = physical_tile(ims[k], (w,h,left,top), origins[k], panels[k]["raster"], panels["pdf"]["raster"], panels[k]["pageMm"])
            center = max((extent(np.array(n["relativeMm"])-panels["pdf"]["vector"]["nodes"][key]["relativeMm"])
                          for key,n in panels[k]["vector"]["nodes"].items()), default=0)
            row.append((tile, missing, center))
        cells.append((case, row, w, h))
    cw = max(322, max(w for _, _, w, _ in cells) + 22)
    width = cw*len(PANELS) + 48
    height = 136 + sum(h+100 for _, _, _, h in cells) + 24
    sheet = Image.new("RGB",(width,height),"#f7faf9")
    d = ImageDraw.Draw(sheet)
    line(d,(24,16),"TikZ positioning  /  " + ("Archived HEAD" if capture["revision"].isalnum() else "Working copy"),29,bold=True)
    line(d,(24,55),"Identical physical scale throughout. Aligned on one landmark; thin frame = declared page. Cross = native center when displaced or missing.",17)
    line(d,(24,81),f"Chrome {capture['browser']}  |  384 dpi captures at 1:4  |  numbers are maximum vector center errors vs original PDF, in mm.",15,MUTED)
    xbar = width-150
    d.line((xbar,31,xbar+PPM*10/4,31),fill=INK,width=3)
    for x in [xbar,xbar+PPM*10/4]:
        d.line((x,26,x,36),fill=INK,width=2)
    line(d,(xbar+50,20),"10 mm",16)
    for j, (_, title) in enumerate(PANELS):
        line(d,(24+j*cw,110),title,17,ACCENT,True)
    y = 137
    for i, (case,row,_,h) in enumerate(cells,1):
        d.line((24,y,width-24,y),fill=RULE,width=1)
        line(d,(24,y+7),f"{i:02d}   {TITLES[case]}",18,bold=True)
        x = 25
        for key, (desc, _, _) in PROBES.get(case, {}).items():
            d.rectangle((x,y+37,x+10,y+47),fill=RGB[key],outline="#636b6f")
            line(d,(x+16,y+32),desc,13,MUTED)
            x += 32 + math.ceil(d.textlength(desc,font=font(13)))
        if case not in PROBES:
            line(d,(25,y+33),"Unmarked original source. Registered on the first node; all closed outlines located separately.",13,MUTED)
        for j,(im,missing,err) in enumerate(row):
            px = 24+j*cw
            sheet.paste(im,(px,y+55))
            label = "Original-source reference" if j==0 else f"Center: {err:.4f} mm"
            if missing:
                label += "  |  Missing ink: " + ", ".join(missing)
            line(d,(px,y+61+h),label,13,ERROR if err>.02 or missing else MUTED)
        y += h+100
    sheet.save(root/"visual-sheet.png",dpi=(96,96))
    if "diagonal-decision-flow" in records:
        label_sheet(root, capture, records, base_paths, text_rows)


def label_sheet(root, capture, records, base_paths, text_rows):
    case = "diagonal-decision-flow"
    e = next(row for row in capture["rows"] if row["id"]==case)
    data = [(title,k,root,e,records[case],text_rows) for k,title in PANELS]
    if case in base_paths:
        base = Path(base_paths[case])
        old = next(r for r in json.loads((base/"capture.json").read_text())["rows"] if r["id"]==case)
        old_rec = json.loads((base/"geometry.json").read_text())["cases"][case]
        with (base/"text-residuals.csv").open() as f:
            old_text = list(csv.DictReader(f))
        data.insert(2,("HEAD workbench","live",base,old,old_rec,old_text))
    w,h = round(16*PPM),round(11*PPM)
    cw = w+25
    sheet = Image.new("RGB",(32+cw*len(data),105+2*(h+59)+14),"#f7faf9")
    d = ImageDraw.Draw(sheet)
    line(d,(16,12),"Decision flow / sloped label ink",25,bold=True)
    line(d,(16,49),"Same 16 x 11 mm window at each connector midpoint. One image pixel per 384-dpi capture sample; no glyph matching.",15,MUTED)
    for j,(title,k,stage,entry,rec,rows) in enumerate(data):
        x = 16+j*cw
        line(d,(x,80),title,16,ACCENT,True)
        im = Image.open(stage/entry["panels"][k]["file"]).convert("RGB")
        for i,(word,dest) in enumerate([("yes","approve"),("no","revise")]):
            nodes = rec["panels"][k]["raster"]["nodes"]
            center = (np.array(nodes["complete"]["pageCenterMm"])+nodes[dest]["pageCenterMm"])*PPM/2
            l,t = np.rint(center-[w/2,h/2]).astype(int)
            y = 106+i*(h+59)
            sheet.paste(im.crop((l,t,l+w,t+h)),(x,y))
            d.rectangle((x,y,x+w,y+h),outline=RULE)
            metric = next((r for r in rows if r["case"]==case and r["text"]==word and r["actual"]==k and r["reference"]=="pdf"),None)
            line(d,(x,y+h+4),f"{word}   T {float(metric['dTmm']):+.3f}, N {float(metric['dNmm']):+.3f} mm" if metric else word+"   Native reference",13)
    sheet.save(root/"decision-flow-labels.png",dpi=(384,384))
