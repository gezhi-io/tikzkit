"""Draw fixed-scale panels from saved browser, Poppler and librsvg rasters."""
import argparse
import csv
from pathlib import Path

from PIL import Image, ImageDraw
from orient import MIX, PPM, np, read
from sheets import ACCENT, INK, MUTED, RULE, line

ap=argparse.ArgumentParser(description=__doc__); ap.add_argument("before",type=Path)
ap.add_argument("after",type=Path,nargs="?"); ap.add_argument("--routes",action="store_true"); a=ap.parse_args()
old=a.before; new=a.after or old
caps={s:read(s/"capture.json") for s in (old,new)}; pages={}; glyphs={}
for s in caps:
    for filename,store,keys in (("panels",pages,["case","panel"]),("glyphs",glyphs,["case","panel","label"])):
        with (s/(filename+".csv")).open() as f: store[s]={tuple(row[k] for k in keys):row for row in csv.DictReader(f)}
assert len({(c["dpi"],c["browser"]) for c in caps.values()})==1
cols=[(new,"pdf","Original pdfLaTeX"),(new,"rsvg","Actual tikztosvg + librsvg"),(old,"live","Parent Chrome")]
if a.after: cols.append((new,"live","Candidate Chrome"))
if a.routes: cols=[*cols[:2],(new,"tikztosvg","Native SVG in Chrome"),(new,"live","Loaded Chrome"),(new,"download","Downloaded SVG"),(new,"export","CLI export")]
cw=278; width=32+cw*len(cols)
out=Image.new("RGB",(width,2100),"#f6f8fa"); d=ImageDraw.Draw(out)
line(d,(16,8),"CircuitikZ: how passive labels turn",24,INK,True)
rev=" / ".join(dict.fromkeys(caps[s]["environment"]["rendererSha256"][:8] for s,k,_ in cols if k=="live"))
line(d,(16,42),"Original 384 dpi captures. One scale per row; full pages share their top-left origin. Renderer: "+rev,14,MUTED)
for i,(_,_,name) in enumerate(cols): line(d,(16+cw*i,68),name,15,ACCENT,True)
y=94
for case,title,note,scale,detail,key in [
    ("manual-straight","Manual / straight","All eight labels should be horizontal. Raw foreach list macro, exactly as printed.",.30,False,"90"),
    ("manual-rotate","Manual / rotate","The 90 and -90 labels are vertical; the diagonals turn with the component.",.30,False,"90"),
    ("manual-smart","Manual / smart","Cardinal labels stay horizontal; the four diagonal labels turn.",.30,False,"90"),
    ("literal-rotate","Diagnostic / literal rotate","Only the loop list is expanded. This distinguishes missing geometry from horizontal label fallback.",.30,False,"90"),
    ("literal-rotate","North spoke / glyph detail","Same 15 x 15 mm window relative to the actual center junction. The word is never registered.",1.06,True,"90"),
    (MIX,"Mixed / subscripts, reverse directions and stroke widths","Upper paths: rotate. Lower paths: smart, including a horizontal resistor. The red dot fixes the physical origin.",.25,False,"C4")
]:
    d.line((16,y,width-16,y),fill=RULE); line(d,(16,y+4),title,16,INK,True); line(d,(16,y+26),note,13,MUTED)
    top=y+47; ht=0
    for i,(s,k,_) in enumerate(cols):
        p=pages[s][case,k]; group=next(e for e in caps[s]["rows"] if e["id"]==case)
        path=Path("capture/rsvg")/(case+".png") if k=="rsvg" else Path(group["panels"][k]["file"])
        im=Image.open(s/path).convert("RGB"); q=glyphs[s][case,k,key]; blank=p["blank"]=="True"
        if detail and not blank:
            ox,oy=np.array([float(p["originX"]),float(p["originY"])])
            off=np.rint((np.array([ox,oy])+[-10.,-20.])*PPM).astype(int); size=round(15*PPM)
            part=Image.new("RGB",(size,size),"white"); part.paste(im,tuple(-off)); im=part
        tile=im.resize(tuple(round(v*scale) for v in im.size),Image.Resampling.LANCZOS); assert tile.width<cw-5
        x=16+i*cw; out.paste(tile,(x,top)); d.rectangle((x-1,top-1,x+tile.width,top+tile.height),outline=RULE)
        caption=("Blank / malformed foreach list" if blank else
                 ("%s baseline: %.2f deg"%(key,float(q["angle"])) if detail else
                  "%.3f x %.3f mm  |  %s: %.1f deg"%(float(p["pageW"]),float(p["pageH"]),key,float(q["angle"]))))
        line(d,(x,top+tile.height+3),caption,12,MUTED); ht=max(ht,tile.height)
    y=top+ht+25
assert y<out.height
out.crop((0,0,width,y)).save(new/("routes.png" if a.routes else "gallery.png"))
