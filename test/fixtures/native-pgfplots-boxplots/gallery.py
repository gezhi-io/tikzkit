"""One fixed-scale sheet of actual captures. Run evidence.py on each stage first."""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROWS = [
    ("boxplot-manual-prepared", "Prepared  /  Three manual rows",
     "Table: 40, 34, 56. Empty middle row. Coordinate outliers: 35 and 55."),
    ("boxplot-manual-samples", "Raw  /  Twelve manual observations",
     "The original PDF has Q1 = 3.5 and median = 7.5. The frozen converter silently used 2 and 7."),
    ("vertical-mixed", "Vertical  /  Sparse positions and an ordinary line",
     "Lanes 1, 2, 5. No middle median. The orange observations at lane 5 come from the raw sample."),
    ("compat-111", "Compatibility  /  1.11, legacy",
     "Both tails are whisker tips: -3 and 11.75. No outliers."),
    ("compat-112", "Compatibility  /  1.12, R7",
     "Same eight observations. Tips are now 2 and 7; -3 and 11.75 become outliers."),
    ("ordinals-width", "Survey  /  Two counters, one data tick, variable widths",
     "Blue prepared lanes: 1, 2, 5. Red raw lanes: 1, 2. Only y = 1 is a tick. Native body spans: 2 to 8 mm."),
]

def font(n,bold=False):
    for name in (("DejaVuSans-Bold.ttf","Arial Bold.ttf") if bold else ("DejaVuSans.ttf","Arial.ttf")):
        try: return ImageFont.truetype(name,n)
        except OSError: pass
    return ImageFont.load_default(size=n)

def load(stages):
    rows = {}; fingerprints = set()
    for stage in stages:
        data = json.loads((stage/"geometry.json").read_text())["results"]
        cap = json.loads((stage/"capture.json").read_text())
        fingerprints.add(cap["environment"]["rendererSha256"][:12])
        assert not rows.keys() & data.keys()
        rows.update({k:(stage,record) for k,record in data.items()})
    assert len(fingerprints)==1
    return rows,fingerprints.pop()

def gallery(stages, before, output):
    rows,fp = load(stages); old,ofp = load(before) if before else ({},None)
    columns = [("pdf","Original PDF","MacTeX / Poppler")]
    if before:
        columns += [("old-rsvg","Converter before","tikztosvg / librsvg"),
                    ("old-live","Workbench before","Chrome / Render")]
    columns += [("rsvg","Converter","tikztosvg / librsvg"),("live","Workbench","Chrome / Render"),
                ("download","Download SVG","Reopened in Chrome"),("cli","Packaged CLI","Strict SVG / librsvg")]
    active = []; widest = 0
    for id,title,caption in ROWS:
        if id not in rows: continue
        stage,data = rows[id]; tiles = []
        if before: assert old[id][1]["sourceSha256"]==data["sourceSha256"]
        for key,_,_ in columns:
            s,e = old[id] if key.startswith("old-") else (stage,data)
            with Image.open(s/e["panels"][key.removeprefix("old-")]["png"]) as im:
                tile = im.convert("RGB").resize(tuple(round(z/4) for z in im.size),Image.Resampling.LANCZOS)
            tiles.append(tile); widest = max(widest,tile.width)
        counts = data["panels"]["pdf"]["counts"]
        detail = "Original PDF   |   bodies: {body}   caps: {cap}   medians: {median}   outliers: {outlier}".format(**counts)
        active.append((title,caption,detail,tiles))
    col,pad = max(264,widest+12),18; w = len(columns)*col+2*pad
    h = 182 + sum(83+max(i.height for i in tiles) for *_,tiles in active)
    sheet = Image.new("RGB",(w,h),"#f3f6f7"); d = ImageDraw.Draw(sheet)
    def label(x,y,s,n=14,b=False,color="#263942"): d.text((x,y),s,font=font(n,b),fill=color)
    label(pad,9,"PGFPlots  /  Boxplots",27,True)
    label(pad,47,(f"Frozen 2325922a ({ofp})   /   {stages[0].name}: {fp}" if before else f"Frozen 2325922a   /   {fp}")+
          "     |     Same page origin. All 384 dpi captures reduced 4:1; no fitting.",15)
    for j,(k,title,sub) in enumerate(columns):
        x = pad+j*col
        label(x,76,title,17,True,"#955128" if k.startswith("old-") else "#176967")
        label(x,97,sub,13)
    y = 122
    for i,(title,caption,detail,tiles) in enumerate(active,1):
        d.line((pad,y-3,w-pad,y-3),fill="#b9c9ca",width=1)
        label(pad,y+1,f"{i:02}    {title}",18,True)
        label(pad,y+28,caption,14)
        label(w-pad-d.textlength(detail,font=font(14)),y+28,detail,14,color="#365e5f")
        y += 55
        for j,tile in enumerate(tiles):
            x = pad+j*col; sheet.paste(tile,(x,y))
            d.rectangle((x-1,y-1,x+tile.width,y+tile.height),outline="#aebfbf")
        y += max(i.height for i in tiles)+28
    d.line((pad,y-5,w-pad,y-5),fill="#b9c9ca",width=1)
    matches = sum(e["cliMatchesDownload"] for _,e in rows.values())
    label(pad,y+1,f"Download and CLI SVGs identical: {matches}/{len(rows)}. The final column is the actual CLI file rasterized with librsvg; fonts can differ.",14,True)
    if "vertical-mixed" in rows:
        panels = rows["vertical-mixed"][1]["panels"]
        fills = [panels[k]["features"]["body"] for k in ("pdf","live")]
        if all(f and f[0].get("sampledFill") for f in fills):
            label(pad,y+23,"Vertical body, sampled interior pixel: original PDF #"+fills[0][0]["sampledFill"]+"; editor #"+fills[1][0]["sampledFill"]+".",14)
    assert y+42 <= h
    sheet.save(output,optimize=True,dpi=(96,96))

if __name__=="__main__":
    ap=argparse.ArgumentParser(description=__doc__); ap.add_argument("stages",nargs="+",type=Path)
    ap.add_argument("--before",nargs="+",type=Path,default=[]); ap.add_argument("-o",required=True,type=Path)
    args=ap.parse_args(); gallery(args.stages,args.before,args.o)
