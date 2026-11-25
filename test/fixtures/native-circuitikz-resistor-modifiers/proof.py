"""Annotated pages and fixed contact windows from the actual 384 dpi captures."""
import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from check import CONTROL, MANUAL, PPM, csv_out
from sheet import overlay, rasters
from sheets import ACCENT, INK, MUTED, RULE, line

def difference(ref,actual):
    im=overlay(ref,actual)
    def paint(src):
        pad=Image.new("RGB",im.size,"white"); pad.paste(src)
        channels=255-np.asarray(pad,dtype=np.int32); strength=channels.max(2)
        return strength,channels/np.maximum(1,strength)[:,:,None]
    a,x=paint(ref); b,y=paint(actual)
    hue=(np.minimum(a,b)>=85)&(np.abs(x-y).max(2)>.30)
    rgb=np.array(im); rgb[hue]=[240,139,0]
    return Image.fromarray(rgb),dict(sharedDark=int(((a>=128)&(b>=128)).sum()),nativeOnlyDark=int(((a>=128)&(b<128)).sum()),
                                    actualOnlyDark=int(((a<128)&(b>=128)).sum()),sharedHueDifference=int(hue.sum()))

def sheet(stage,parent,failed):
    cap,images=rasters(stage); previous=rasters(parent)[1] if parent else None
    if failed:
        assert parent
        old,earlier=rasters(failed)
        assert {e["id"]:e["sourceSha256"] for e in old["rows"]}=={e["id"]:e["sourceSha256"] for e in cap["rows"]}
    cols=[("pdf","Original pdfLaTeX"),("rsvg","tikztosvg / librsvg")]
    if previous: cols.append(("parent","Parent / editor"))
    cols += [("live","Candidate / editor" if previous else "Parent / editor"),("diff","Editor vs converter")]
    cw=277; out=Image.new("RGB",(32+cw*len(cols),1700),"#f5f8f8"); d=ImageDraw.Draw(out); w=out.width
    line(d,(16,9),"CircuitikZ  /  Two-terminal resistor modifiers",25,INK,True)
    line(d,(16,45),f"Renderer {cap['environment']['rendererSha256'][:12]}  |  384 dpi  |  fixed page origin and scale; no registration or page fitting",14,MUTED)
    line(d,(16,66),"Diff: dark = shared ink; magenta = converter only; green = editor only; amber = different hue in shared ink.",14,MUTED)
    for j,(_,title) in enumerate(cols): line(d,(16+j*cw,96),title,16,ACCENT,True)
    dest=stage/"overlays"; dest.mkdir(exist_ok=True); metrics=[]; head_counts=[]; y=127
    for case,title,note,crops in [
        (MANUAL,"Manual 2362: variable arrow (left) and sensor bar (right)",
         "Native body / modifier pens, top to bottom (mm): 0.281 / 0.281, 0.562 / 0.562, 0.562 / 0.281.",
         [("Second and third rows: the body stays thick; the arrow thins",(4,10.15,18.0,29.7),.94)]),
        (CONTROL,"Mirrored branches: European variable and sensor, then legacy European and American arrows",
         "Anchor rings: pink V.wiper, green S.tip, orange E.W, violet E.tip. The bottom ordinary R carries no modifier.",
         [("Legacy European: inspect the filled box, red shaft, and arrowhead separately",(8.8,25.9,17.8,35.4),1.72)])]:
        ims=images[case]
        if previous: ims["parent"]=previous[case]["live"]
        for k in ("live","download","export","tikztosvg"):
            diff,row=difference(ims["rsvg"],ims[k]); diff.save(dest/f"{case}-{k}.png")
            metrics.append(dict(case=case,panel=k,**row))
            if k=="live": ims["diff"]=diff
        d.line((16,y,w-16,y),fill=RULE); line(d,(16,y+5),title,17,INK,True)
        line(d,(16,y+29),note,13,MUTED); y+=53
        for caption,box,scale in [("",None,.335)]+crops:
            if caption: line(d,(16,y),caption+"  /  fixed page crop",14,INK,True); y+=24
            history=failed and box and case==CONTROL
            if history:
                for j,(key,label) in enumerate(cols):
                    line(d,(16+j*cw,y),("Earlier candidate / "+old["environment"]["rendererSha256"][:8]+" (failed)") if key=="parent" else label,13,ACCENT,True)
                y+=21
            height=0
            for j,(k,_) in enumerate(cols):
                im=earlier[case]["live"] if history and k=="parent" else ims[k]
                if box:
                    x0,y0,x1,y1=np.rint(np.array(box)*PPM).astype(int)
                    tile=Image.new("RGB",(x1-x0,y1-y0),"white"); tile.paste(im,(-x0,-y0)); im=tile
                tile=im.resize(tuple(round(v*scale) for v in im.size),Image.Resampling.NEAREST if scale>=1 else Image.Resampling.LANCZOS)
                assert tile.width<cw-8; x=16+j*cw; out.paste(tile,(x,y)); d.rectangle((x-1,y-1,x+tile.width,y+tile.height),outline=RULE)
                height=max(height,tile.height)
            y+=height+12
        y+=8
        if case==CONTROL:
            window=tuple(np.rint(np.array([12.65,26.65,14.1,28.36])*PPM).astype(int))
            for k in ("pdf","tikztosvg","rsvg","live","download","export"):
                px=np.asarray(ims[k].crop(window)).reshape(-1,3)
                head_counts.append(dict(panel=k,black=int((px==[0,0,0]).all(1).sum()),blueFill=int((px==[89,89,255]).all(1).sum())))
    assert y<=out.height
    out.crop((0,0,w,y)).save(stage/"gallery.png"); csv_out(stage/"overlay-pixels.csv",metrics)
    csv_out(stage/"head-crop.csv",head_counts)

if __name__=="__main__":
    ap=argparse.ArgumentParser(description=__doc__); ap.add_argument("stage",type=Path); ap.add_argument("--before",type=Path)
    ap.add_argument("--failed",type=Path,help="Show the saved failed candidate only in the last detail crop")
    a=ap.parse_args(); sheet(a.stage,a.before,a.failed)
