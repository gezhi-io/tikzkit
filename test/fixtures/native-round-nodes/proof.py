"""Equal-scale original captures; center-register only the labeled rim details."""

import argparse
import csv
from pathlib import Path

from measure import AUT, NET, SEP, DOUBLE, PPM, np, Image, read
from PIL import ImageDraw
from sheets import line, RULE, INK, MUTED, ACCENT

ap=argparse.ArgumentParser(description=__doc__)
ap.add_argument("parent",type=Path); ap.add_argument("candidate",type=Path,nargs="?")
ap.add_argument("--final-routes",action="store_true",help="Show all five final outputs side by side")
args=ap.parse_args(); old=args.parent; new=args.candidate or old
stages={p:read(p/"capture.json") for p in (old,new)}
assert len({m["dpi"] for m in stages.values()})==len({m["browser"] for m in stages.values()})==1
columns=[("Original pdfLaTeX",new,"pdf"),("Actual tikztosvg",new,"tikztosvg"),("Parent Chrome",old,"live")]
if args.candidate: columns.append(("Final Chrome",new,"live"))
if args.final_routes:
    if not args.candidate: ap.error("--final-routes requires a candidate")
    columns=[*columns[:2],("Loaded Chrome",new,"live"),("Downloaded SVG",new,"download"),("CLI export",new,"export")]
panels={p:{e["id"]:e["panels"] for e in m["rows"]} for p,m in stages.items()}
vals={}
for p in stages:
    with (p/"round-values.csv").open() as f:
        vals[p]={(r["case"],r["panel"],r["node"]):r for r in csv.DictReader(f)}
def shot(p,k,case):
    return Image.open(p/panels[p][case][k]["file"]).convert("RGB")

def rim(im,v,detail):
    radius=float(v["major"])/2
    center=np.array([float(v["cx"]),float(v["cy"])-(radius if detail else 0)])*PPM
    wh=np.rint(np.array([8,2.4] if detail else [12,12])*PPM).astype(int)
    offset=np.rint(wh/2-center).astype(int); out=Image.new("RGB",tuple(wh),"white"); out.paste(im,tuple(offset))
    return out

def diff(ref,actual):
    palette=np.array([[0,0,0],[255,255,255],[230,230,255]])
    nearest=lambda im: np.linalg.norm(np.asarray(im)[:,:,None,:]-palette,axis=3).argmin(axis=2)
    a,b=nearest(ref),nearest(actual)
    out=np.full((*a.shape,3),255,dtype="uint8"); out[(a==0)&(b==0)]=(61,78,91); out[(a==2)&(b==2)]=(225,232,236)
    out[(a!=b)&(a==0)]=(186,35,100); out[(a!=b)&(b==0)]=(0,137,94)
    out[(a!=b)&(a!=0)&(b!=0)]=(235,141,32)
    return Image.fromarray(out)

def picture(file,heading,specs):
    cw=316; width=36+cw*len(columns)
    canvas=Image.new("RGB",(width,1600),"#f6f8fa"); d=ImageDraw.Draw(canvas)
    line(d,(18,10),heading,25,bold=True)
    rev=" / ".join(dict.fromkeys(stages[p]["environment"]["rendererSha256"][:8] for _,p,k in columns if k=="live"))
    line(d,(18,45),"384 dpi; one scale per row. Full pages at top-left, not fitted to one another. Renderer: "+rev,15,MUTED)
    for j,(label,_,_) in enumerate(columns): line(d,(19+cw*j,74),label,16,ACCENT,True)
    y=102
    for case,kind,title,note,scale in specs:
        d.line((18,y,width-18,y),fill=RULE); line(d,(18,y+6),title,17,INK,True); line(d,(18,y+29),note,13,MUTED)
        top=y+52; ht=0
        for j,(_,p,k) in enumerate(columns):
            node={AUT:"q1",NET:"o1",SEP:"ew"}.get(case,case); v=vals[p][case,k,node]
            im=shot(p,k,case)
            if kind in ("state","rim","diff"): im=rim(im,v,kind!="state")
            if kind=="diff": im=diff(rim(shot(new,"pdf",case),vals[new][case,"pdf",node],True),im)
            tile=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.NEAREST if kind in ("rim","diff") else Image.Resampling.LANCZOS)
            assert tile.width<cw-4
            x=19+cw*j; canvas.paste(tile,(x,top)); d.rectangle((x-1,top-1,x+tile.width,top+tile.height),outline=RULE)
            ht=max(ht,tile.height)
            f=lambda key: float(v[key])
            if kind=="state": s="Path %.3f mm  |  ink diameter %.3f mm"%(f("major"),f("inkOD"))
            elif kind=="rim": s="Painted gap %.3f mm  |  %s"%(f("paintGap"),v["gapRGB"]) if v["paintGap"] else "No measurable gap"
            elif kind=="diff": s="PDF rim classes" if k=="pdf" else "Compared with original PDF rim"
            elif case==NET: s="11 circles  |  output diameter %.4f mm"%f("major")
            elif case==DOUBLE: s="Pens %.3f / %s mm  |  gap %s"%(f("outerPen"),v["innerPen"] or "absent",v["gapRGB"])
            elif case==SEP: s="Upper ellipse anchors %.2f x %.2f mm"%(f("anchorW"),f("anchorH"))
            else: s="Page %.3f x %.3f mm"%(f("pageW"),f("pageH"))
            line(d,(x,top+tile.height+3),s,13,MUTED)
        y=top+ht+29
    assert y<canvas.height
    canvas.crop((0,0,width,y)).save(new/(file.replace("-proof","-routes") if args.final_routes else file))

picture("gallery-proof.png","Round nodes in two unchanged gallery drawings",[
    (AUT,"full","Initial and accepting states","Original page and text are retained. The accepting-state border, not whole-image similarity, is the gate.",.30),
    (AUT,"state","The accepting state, q1","12 x 12 mm crop centered on the measured q1 path. Its entry arrow is on the right.",1.1),
    (AUT,"rim","The northern rim, enlarged","Same 8 x 2.4 mm window relative to the centerline; nearest-neighbor enlargement of actual capture samples.",2.4),
    (AUT,"diff","Rim comparison against PDF","Dark gray = common black; pink = PDF-only black; green = compared-only black; orange = pale fill vs white.",2.4),
    (NET,"full","Feed-forward perceptron","All eleven filled circles measured. Its many arrows and the diagram background are not an acceptance score.",.33)])
picture("probe-proof.png","Circle and ellipse controls",[
    (SEP,"full","Unequal outer x/y separation","Top: 4/1 mm. Bottom: 1/4 mm. Red = named cardinal anchors; green ray ends on the upper ellipse border.",.24),
    (DOUBLE,"full","Thick red circle with a blue center stripe","3 pt nominal red pen, 4 pt blue gap. The fill showing between two thin rings would not be a blue stripe.",.84),
    ("ellipse-30","full","30 degree ellipse, 1.5x transformed shape","36 x 15 mm principal diameters. Compare the page and the 6 pt pen separately from the rotated path.",.42),
    ("ellipse-45-fill","full","45 degree fill-only ellipse","24 x 10 mm principal diameters. No painted pen. Native page bounds are not a tight raster-ink rectangle.",.66)])
