"""Lay out captured pages without refitting any panel. Run after both audits."""

import csv
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "native-positioning-targets"))
from audit import csv_out, read
from locate import PPM
from sheets import ACCENT, INK, MUTED, RULE, line

old, new, frozen, drivers, dst = map(Path, sys.argv[1:])
dst.mkdir(exist_ok=True, parents=True)
cols = [("Original PDF", new, "pdf"), ("Actual tikztosvg", new, "tikztosvg"),
        ("Parent Chrome", old, "live"), ("Candidate Chrome", new, "live"),
        ("Downloaded SVG", new, "download"), ("CLI SVG", new, "export")]
meta = {p: read(p/"capture.json") for p in [old,new,frozen,drivers]}
for a,b in [(old,frozen),(new,drivers)]:
    assert meta[a]["environment"] == meta[b]["environment"] and meta[a]["browser"] == meta[b]["browser"]
assert len({m["dpi"] for m in meta.values()}) == 1
caps = {p: {e["id"]: e["panels"] for e in m["rows"]} for p,m in meta.items()}
revs = "Parent %s   /   final %s   /   %s dpi" % (
    meta[old]["environment"]["rendererSha256"][:8],meta[new]["environment"]["rendererSha256"][:8],meta[new]["dpi"])
def shot(p, k, case):
    return Image.open(p/caps[p][case][k]["file"]).convert("RGB")

def data(p):
    with (p/"probe-values.csv").open() as f:
        return {(r["case"], r["panel"], r["row"]): r for r in csv.DictReader(f)}
tables = {p: data(p) for p in [old, new]}
def legend(p, k, case):
    get = lambda row: tables[p][case, k, row]
    if case == "outline-anchors":
        return "Zero path: %.3f x %.3f mm" % tuple(float(get("zero")[f]) for f in ("pathW","pathH"))
    if case.startswith("signed-"):
        return "Cubic reach: %.2f / %.2f mm" % tuple(float(get(row)["curveReach"]) for row in ("+5mm","-2mm"))
    row = get(case)
    if case.startswith("double-"):
        return "Blue / red: %.3f / %s mm" % (float(row["bluePen"]), "%.3f"%float(row["redPen"]) if row["redPen"] else "absent")
    if case == "scaled-page":
        return "Pen: %.4f mm" % float(row["bluePen"])
    return "Page: %.3f x %.3f mm" % (float(row["pageW"]), float(row["pageH"]))

def sheet(name, heading, intro, specs):
    cw = 229
    rows = []
    for case, title, desc, s in specs:
        tiles = []
        for _,p,k in cols:
            im = shot(p,k,case)
            tiles.append(im.resize((round(im.width*s),round(im.height*s)), Image.Resampling.LANCZOS))
        assert max(im.width for im in tiles) < cw-8
        rows.append((case,title,desc,tiles))
    out = Image.new("RGB", (40+cw*6, 109+sum(86+max(im.height for im in t) for _,_,_,t in rows)), "#f6f8fa")
    d = ImageDraw.Draw(out)
    line(d,(out.width-345,24),revs,13,MUTED)
    line(d,(20,12),heading,25,bold=True); line(d,(20,49),intro,15,MUTED)
    for j,(title,_,_) in enumerate(cols):
        line(d,(20+j*cw,77),title,16,ACCENT if j!=2 else "#9a451e",True)
    y=104
    for case,title,desc,tiles in rows:
        h=max(im.height for im in tiles)
        d.line((20,y,out.width-20,y),fill=RULE)
        line(d,(20,y+5),title,17,INK,True); line(d,(20,y+28),desc,14,MUTED)
        for j,((_,p,k),im) in enumerate(zip(cols,tiles)):
            x=21+j*cw; top=y+52
            d.rectangle((x-1,top-1,x+im.width,top+im.height),outline=RULE)
            out.paste(im,(x,top))
            line(d,(x,top+h+4),legend(p,k,case),13,MUTED)
        y+=86+h
    out.save(dst/name)

sheet("outline-proof.png","Rectangle outline, anchors and page",
      "Red dots are named west/east anchors. Each row uses one physical scale; pages share a top-left origin. Frames bound the captures.",[
    ("outline-anchors","8 pt pen, 22 x 10 mm box","Top to bottom: zero separation, default, 5 mm, then 5 mm fill-only. Read the dots against the blue ink.",.39),
    ("stroke-page","Same thick box, without anchor dots","The natural page is determined by the box and its drawn stroke. The 5 mm anchor separation adds no page margin.",.48)])
sheet("corner-proof.png","Rounded rectangles beyond the half-height",
      "Same two 14 x 4 mm rectangles and 0.8 pt pen throughout. A has +5 mm corner inset; B has -2 mm. Identical physical scale in every tile.",[
    ("signed-insets","2 pt page border","Original tight PDF clips parts of both outlines. Do not infer the unpainted continuation from its page pixels.",.64),
    ("signed-room","9 pt page border","Only the standalone border changes. This page exposes both crossing side segments and the outward corner turns.",.64)])
sheet("control-proof.png","Independent stroke and transform controls",
      "Axis-aligned double pens, local 30 degree rotations and a 1.5x transformed shape. Page sizes are physical; no panel is fitted to its reference.",[
    ("double-page","Double distance = 2 pt","4 pt pen. Compare the outer blue pass and the red center pass.",.45),
    ("double-centers","Distance between line centers = 6 pt","2 pt pen. Both passes must follow the same rectangle.",.45),
    ("rotated-page","30 degrees, with text","Thin frame shows the raster page, not an inferred tight painted bounding box.",.45),
    ("rotated-empty","30 degrees, no text","An empty node is a separate rendering route; the original page has the same dimensions.",.45),
    ("scaled-page","1.5x scale with transform shape","Compare the blue pen thickness, not just the 33 x 15 mm centerline box.",.34)])

driver_cols=[("Original PDF",drivers,"pdf"),("Actual tikztosvg",drivers,"tikztosvg"),
             ("Parent Chrome",frozen,"live"),("Candidate Chrome",drivers,"live")]
gs = {p:read(p/"geometry.json")["cases"] for p in (drivers,frozen)}
canvas=Image.new("RGB",(1348,836),"#f6f8fa"); d=ImageDraw.Draw(canvas)
line(d,(18,12),"Two unchanged positioning drivers",25,bold=True)
line(d,(18,49),"Whole pages at 1:5. Insets are 6 x 4 mm, enlarged 2x from the 384 dpi captures at identical, unregistered page coordinates.",15,MUTED)
for j,(title,_,_) in enumerate(driver_cols): line(d,(19+330*j,82),title,17,ACCENT,True)
y=112
for case,node,title in [("diagonal-decision-flow","revise","Decision flow: lower-right Revise corner"),
                        ("on-grid-center-placement","a2","On-grid placement: lower-right gridded corner")]:
    ref=gs[drivers][case]["panels"]["pdf"]["vector"]["nodes"]
    corner=np.array(ref[node]["pageCenterMm"])+np.array(ref[node]["sizeMm"])/2
    l,t=np.rint((corner-[4,2.5])*PPM).astype(int); w,h=np.rint(np.array([6,4])*PPM).astype(int)
    line(d,(19,y),title,18,bold=True); y+=30
    ims=[shot(p,k,case) for _,p,k in driver_cols]; rowh=max(round(im.height/5) for im in ims)
    for j,((_,p,k),im) in enumerate(zip(driver_cols,ims)):
        x=20+330*j
        small=im.resize((round(im.width/5),round(im.height/5)),Image.Resampling.LANCZOS)
        canvas.paste(small,(x,y)); d.rectangle((x-1,y-1,x+small.width,y+small.height),outline=RULE)
        # Pad outside the capture with white; never auto-crop to a moving edge.
        crop=Image.new("RGB",(w,h),"white"); crop.paste(im,(-l,-t))
        top=y+rowh+9; canvas.paste(crop.resize((w*2,h*2),Image.Resampling.NEAREST),(x,top))
        d.rectangle((x-1,top-1,x+w*2,top+h*2),outline=RULE)
        nodes=gs[p][case]["panels"][k]["vector"]["nodes"]
        err=max(max(abs(np.array(v["sizeMm"])-ref[n]["sizeMm"])) for n,v in nodes.items() if n!="complete")
        line(d,(x,top+h*2+4),"Max rectangle size error: %.5f mm"%err,13,MUTED)
    y+=rowh+2*h+42
assert y <= canvas.height
canvas.crop((0,0,canvas.width,y)).save(dst/"driver-proof.png")

# Unregistered differences use top-left page coordinates, including the natural
# viewport shift. Probe masks exclude glyphs; driver windows keep all dark ink.
def diff_ink(im, is_driver):
    r,g,b=np.asarray(im,dtype=np.int16).transpose(2,0,1)
    if is_driver:
        return (np.maximum.reduce([r,g,b]) < 112).astype("uint8")
    return ((b>225)&(b-np.maximum(r,g)>35)).astype("uint8") + 2*((r>220)&(np.maximum(g,b)<35)).astype("uint8")

def overlay(ref, actual, driver):
    size=(max(ref.width,actual.width),max(ref.height,actual.height))
    masks=[]
    for im in [ref,actual]:
        pad=Image.new("RGB",size,"white"); pad.paste(im); masks.append(diff_ink(pad,driver))
    a,b=masks; same=(a!=0)&(a==b); union=(a|b)!=0
    rgb=np.full((*union.shape,3),255,dtype="uint8")
    rgb[same]=(88,104,114); rgb[(a!=0)&(b==0)]=(188,34,102); rgb[(a==0)&(b!=0)]=(0,134,94)
    rgb[(a!=0)&(b!=0)&(a!=b)]=(207,108,17)
    return Image.fromarray(rgb),int(same.sum()),int(union.sum())

diff_rows=[]; cw=221
out=Image.new("RGB",(40+6*cw,1370),"#f6f8fa"); d=ImageDraw.Draw(out)
line(d,(19,11),"Rectangle outlines: before, after and paint difference",25,bold=True)
line(d,(out.width-337,20),revs,13,MUTED)
line(d,(19,51),"No registration or rescaling before differencing. Probe masks use blue/red ink; driver crops use dark ink. Percent = same ink / union at 384 dpi.",15,MUTED)
for j,(label,c) in enumerate([("Shared ink","#586872"),("Reference only","#bc2266"),("Compared image only","#00865e"),("Changed ink color","#cf6c11")]):
    x=20+180*j; d.rectangle((x,82,x+12,94),fill=c); line(d,(x+20,79),label,13,MUTED)
for j,title in enumerate(["Original PDF","Parent Chrome","Parent vs PDF","Final Chrome","Final vs PDF","Final vs parent"]):
    line(d,(20+j*cw,109),title,16,ACCENT,True)
y=137
for case,title,s,node in [
    ("outline-anchors","8 pt outline and anchors",.33,None),
    ("signed-room","Signed corner insets: +5 mm and -2 mm, with room to paint",.39,None),
    ("scaled-page","1.5x transformed shape: unscaled 8 pt pen",.34,None),
    ("diagonal-decision-flow","Decision flow: lower-right Revise corner at the native page coordinates",2,"revise"),
    ("on-grid-center-placement","On-grid placement: lower-right gridded corner at the native page coordinates",2,"a2")]:
    ref,prev,now=[shot(p,k,case) for p,k in [(drivers if node else new,"pdf"),(frozen if node else old,"live"),(drivers if node else new,"live")]]
    if node:
        nn=gs[drivers][case]["panels"]["pdf"]["vector"]["nodes"][node]
        l,t=np.rint((np.array(nn["pageCenterMm"])+np.array(nn["sizeMm"])/2-[4,2.5])*PPM).astype(int)
        def window(im):
            img=Image.new("RGB",tuple(np.rint(np.array([6,4])*PPM).astype(int)),"white")
            img.paste(im,(-l,-t)); return img
        ref,prev,now=map(window,(ref,prev,now))
    old_diff,new_diff,change=[overlay(a,b,bool(node)) for a,b in [(ref,prev),(ref,now),(prev,now)]]
    for name,(_,same,union) in zip(("parent/pdf","final/pdf","final/parent"),(old_diff,new_diff,change)):
        diff_rows.append(dict(case=case,pair=name,sameInkPixels=same,unionPixels=union,overlap=same/union))
    d.line((19,y,out.width-19,y),fill=RULE); line(d,(19,y+4),title,16,INK,True)
    ims=[ref,prev,old_diff[0],now,new_diff[0],change[0]]; h=max(round(im.height*s) for im in ims); top=y+29
    for j,im in enumerate(ims):
        tile=im.resize((round(im.width*s),round(im.height*s)),Image.Resampling.NEAREST if node else Image.Resampling.LANCZOS)
        assert tile.width < cw-5
        x=20+cw*j; d.rectangle((x-1,top-1,x+tile.width,top+tile.height),outline=RULE); out.paste(tile,(x,top))
    for j,(_,same,union) in zip((2,4,5),(old_diff,new_diff,change)):
        line(d,(20+cw*j,top+h+3),"Overlap %.2f%%"%(100*same/union),13,MUTED)
    y+=h+57
assert y<=out.height
out.crop((0,0,out.width,y)).save(dst/"visual-proof.png")
csv_out(dst/"paint-diff.csv",diff_rows)
