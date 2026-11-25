"""Compare the actual 384 dpi page rasters, never registering or rescaling inputs."""
import argparse
import csv
from pathlib import Path

from PIL import Image, ImageDraw
from orient import DPI, MIX, PPM, csv_out, np, read, sha
from sheets import ACCENT, INK, MUTED, RULE, line

ap=argparse.ArgumentParser(description=__doc__); ap.add_argument("stage",type=Path); stage=ap.parse_args().stage
cap=read(stage/"capture.json"); assert cap["dpi"]==DPI
with (stage/"panels.csv").open() as f: panels={(r["case"],r["panel"]):r for r in csv.DictReader(f)}
dst=stage/"overlays"; dst.mkdir(exist_ok=True)
cols=("Converter / librsvg","Loaded workbench","Overlay / workbench","Overlay / download","Control / converter in Chrome")
cw=254; sheet=Image.new("RGB",(32+cw*len(cols),2300),"#f6f8fa"); draw=ImageDraw.Draw(sheet)
line(draw,(16,8),"CircuitikZ: actual raster differences",24,INK,True)
line(draw,(16,42),"384 dpi, top-left page origins, white padding only. Renderer: "+cap["environment"]["rendererSha256"][:8],14,MUTED)
line(draw,(16,64),"Charcoal = shared ink. Magenta = excess converter ink. Green = excess compared ink. Antialiasing retained.",14,MUTED)
for i,c in enumerate(cols): line(draw,(16+i*cw,92),c,14,ACCENT,True)
y=121; metrics=[]
for e in cap["rows"]:
    case=e["id"]; actual={}
    for k in ("rsvg","live","download","export","tikztosvg"):
        f=stage/("capture/rsvg/"+case+".png" if k=="rsvg" else e["panels"][k]["file"])
        assert sha(f)==panels[case,k]["rasterSha"]; actual[k]=Image.open(f).convert("RGB")
    wh=tuple(map(max,zip(*(im.size for im in actual.values()))))
    def pad(im):
        image=Image.new("RGB",wh,"white"); image.paste(im,(0,0)); return image
    imgs={k:pad(im) for k,im in actual.items()}; ov={}
    ref=np.array(imgs["rsvg"]); a=255-np.array(imgs["rsvg"].convert("L"),np.int32)
    for k in ("live","download","export","tikztosvg"):
        b=255-np.array(imgs[k].convert("L"),np.int32); common=np.minimum(a,b)
        rgb=255-(common[:,:,None]*[209,197,185]+(a-common)[:,:,None]*[71,214,148]+(b-common)[:,:,None]*[248,118,155]+127)//255
        ov[k]=Image.fromarray(rgb.astype(np.uint8)); ov[k].save(dst/(case+"-"+k+".png"))
        ar,br=a>=128,b>=128
        metrics.append(dict(case=case,panel=k,reference="tikztosvg-rsvg",commonDark=int((ar&br).sum()),
                            refOnlyDark=int((ar&~br).sum()),comparedOnlyDark=int((br&~ar).sum()),
                            differentRGBPixels=int(np.any(ref!=np.asarray(imgs[k]),axis=2).sum()),
                            absoluteInkPixelEquivalents=round(float(np.abs(a-b).sum())/255,2)))
    # Crops below are fixed page coordinates in mm, identical for every column.
    sections=[(case,None,.24 if case==MIX else .275)]
    if case=="literal-rotate": sections+= [("North label and adjacent wire",(16,6,31,21),1.0),("East open terminal",(47,24,53,29),2.2)]
    if case==MIX: sections.append(("C2 and its subscript",(49,4,62,14),1.15))
    for title,rect,scale in sections:
        draw.line((16,y,sheet.width-16,y),fill=RULE); line(draw,(16,y+3),title,15,INK,True)
        top=y+27
        for j,im in enumerate((imgs["rsvg"],imgs["live"],ov["live"],ov["download"],ov["tikztosvg"])):
            if rect:
                x0,y0,x1,y1=np.rint(np.array(rect)*PPM).astype(int); tile=Image.new("RGB",(x1-x0,y1-y0),"white")
                tile.paste(im,(-x0,-y0)); im=tile
            tile=im.resize(tuple(round(n*scale) for n in im.size),Image.Resampling.NEAREST if scale>=1 else Image.Resampling.LANCZOS)
            assert tile.width<cw-3
            x=16+j*cw; sheet.paste(tile,(x,top)); draw.rectangle((x-1,top-1,x+tile.width,top+tile.height),outline=RULE)
        y=top+tile.height+12
assert y<sheet.height
sheet.crop((0,0,sheet.width,y)).save(stage/"overlay.png"); csv_out(stage/"overlay-pixels.csv",metrics)
