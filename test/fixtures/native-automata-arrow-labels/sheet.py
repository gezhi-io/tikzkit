"""Equal-scale arrow-label captures; register only the explicitly labeled details."""
import argparse
import csv
from pathlib import Path

from PIL import Image, ImageDraw
from labels import GALLERY, PPM, np, read
from sheets import ACCENT, INK, MUTED, RULE, line

ap=argparse.ArgumentParser(description=__doc__); ap.add_argument("parent",type=Path)
ap.add_argument("candidate",type=Path,nargs="?"); ap.add_argument("--routes",action="store_true")
a=ap.parse_args(); old=a.parent; stage=a.candidate or old
caps={s:read(s/"capture.json") for s in (stage,old)}
assert len({(c["browser"],c["dpi"]) for c in caps.values()})==1
vals={}; panels={}
for s,c in caps.items():
    with (s/"labels.csv").open() as f: vals[s]={(v["case"],v["panel"],v["state"]):v for v in csv.DictReader(f)}
    panels[s]={e["id"]:e["panels"] for e in c["rows"]}
cols=[(stage,"pdf","Original pdfLaTeX"),(stage,"tikztosvg","Actual tikztosvg"),(old,"live","Parent Chrome")]
if a.candidate: cols.append((stage,"live","Candidate Chrome"))
if a.routes: cols=[*cols[:2],(stage,"live","Loaded Chrome"),(stage,"download","Downloaded SVG"),(stage,"export","CLI SVG")]

def image(s,k,case,state,box):
    im=Image.open(s/panels[s][case][k]["file"]).convert("RGB"); r=vals[s][case,k,state]
    if box:
        center=np.array([float(r["cx"]),float(r["cy"])])
        off=np.rint((center+box[:2])*PPM).astype(int)
        size=np.rint((np.array(box[2:])-box[:2])*PPM).astype(int)
        part=Image.new("RGB",tuple(size),"white"); part.paste(im,tuple(-off)); im=part
    return im,r

def difference(pdf,im):
    p=np.asarray(pdf).max(2)<145; q=np.asarray(im).max(2)<145
    out=np.full((*p.shape,3),255,np.uint8)
    out[p&q]=(53,67,76); out[p&~q]=(183,43,108); out[q&~p]=(7,137,97)
    return Image.fromarray(out)

cw=340; width=32+cw*len(cols); out=Image.new("RGB",(width,2000),"#f6f8fa"); d=ImageDraw.Draw(out)
line(d,(16,9),"Where the automata arrow labels land",25,INK,True)
rev=" / ".join(dict.fromkeys(caps[s]["environment"]["rendererSha256"][:8] for s,k,_ in cols if k=="live"))
line(d,(16,44),"384 dpi. Same physical scale within each row; full pages share their top-left origin. Renderer: "+rev,15,MUTED)
for j,(_,_,title) in enumerate(cols): line(d,(16+j*cw,73),title,16,ACCENT,True)
y=105
for case,state,box,scale,title,note,kind in [
    (GALLERY,"q1",None,.32,"Original gallery: four initial arrows","No source edits. The page and the labels around all four circles are measured.","page"),
    (GALLERY,"q1",[-5.2,-5.3,19.8,5.3],.84,"Right-hand incoming arrow: entry","State-centered detail. Clearance below is from the outside of the painted state rim to the nearest word ink.","gap"),
    (GALLERY,"q1",[-5.2,-5.3,19.8,5.3],.84,"Same detail, compared with the original PDF","Dark = common dark ink; magenta = PDF only; green = compared image only. Only the state's center is aligned.","diff"),
    ("accepting-cardinals","A",None,.258,"Outgoing arrows: four cardinal directions","All labels inherit a larger font. Explicit accepting where=left is exercised on A; B, C and D use the shorthand keys.","page"),
    ("accepting-cardinals","A",[-21.0,-6.7,20.0,6.7],.51,"Explicit left: which side of A?","State-centered detail. The signed x below is the first glyph's baseline origin relative to A; left is negative.","x"),
    ("direct-cardinals","A",None,.258,"Control: ordinary labels at four fixed anchors","Same font, circles and words. No automata after-node path or arrow is used.","page")]:
    d.line((16,y,width-16,y),fill=RULE); line(d,(16,y+5),title,17,INK,True); line(d,(16,y+28),note,13,MUTED)
    top=y+51; ht=0
    for j,(s,k,_) in enumerate(cols):
        im,v=image(s,k,case,state,box); x=16+j*cw
        if kind=="diff": im=difference(image(stage,"pdf",case,state,box)[0],im)
        tile=im.resize(tuple(round(i*scale) for i in im.size),Image.Resampling.LANCZOS); assert tile.width<cw-4
        out.paste(tile,(x,top)); d.rectangle((x-1,top-1,x+tile.width,top+tile.height),outline=RULE)
        value=lambda field:float(v[field])
        label=("Page %.3f x %.3f mm"%(value("pageW"),value("pageH")) if kind=="page" else
               "Visible clearance %.3f mm"%value("inkFromRim") if kind=="gap" else
               "First glyph x = %+.3f mm"%value("dx") if kind=="x" else "Common state center; no word registration")
        line(d,(x,top+tile.height+3),label,13,MUTED); ht=max(ht,tile.height)
    y=top+ht+28
assert y<out.height
out.crop((0,0,width,y)).save(stage/("routes.png" if a.routes else "gallery.png"))
