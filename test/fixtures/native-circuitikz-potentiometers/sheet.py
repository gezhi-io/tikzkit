"""Show full physical pages, fixed native contact windows and an unregistered raster difference."""
import argparse
import csv
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from measure import DPI, LONG, PPM, PROBE, TRIPLE, read, sha
from pot_paint import PAINT
from sheets import ACCENT, INK, MUTED, RULE, line

DETAILS={
    TRIPLE:("Manual 2293: named American A/B and European C","B / noncentral wiper and label",(14.2,12.7,29.0,20.4),1.10),
    LONG:("Manual 2342: a local longpot between two ordinary resistors","P / six zigs, arrow and label",(11.4,13.5,30.1,25.4),.90),
    PROBE:("Wired probe: horizontal H, mirrored M, mirrored + inverted I","M / red wire meets the shaft end",(15.9,31.6,25.5,40.5),1.65),
}

def overlay(reference,actual):
    wh=tuple(map(max,zip(reference.size,actual.size)))
    def ink(im):
        pad=Image.new("RGB",wh,"white"); pad.paste(im,(0,0))
        return 255-np.asarray(pad,dtype=np.int32).min(axis=2)
    a,b=map(ink,(reference,actual)); common=np.minimum(a,b)
    rgb=255-(common[:,:,None]*[209,197,185]+(a-common)[:,:,None]*[71,214,148]+(b-common)[:,:,None]*[248,118,155]+127)//255
    return Image.fromarray(rgb.astype("uint8"))

def rasters(root):
    with (root/"pages.csv").open() as f: records={(r["case"],r["panel"]):r for r in csv.DictReader(f)}
    cap=read(root/"capture.json"); result={}
    for e in cap["rows"]:
        case=e["id"]; ims={}
        for k in ("pdf","tikztosvg","rsvg","live","download","export"):
            f=root/f"capture/rsvg/{case}.png" if k=="rsvg" else root/e["panels"][k]["file"]
            assert sha(f)==records[case,k]["rasterSha"]; ims[k]=Image.open(f).convert("RGB")
        result[case]=ims
    return cap,result

def make(out,cap,imgs,columns,name,paint=False):
    cw=280; width=24+len(columns)*cw
    sheet=Image.new("RGB",(width,2100),"#f5f8f8"); d=ImageDraw.Draw(sheet)
    line(d,(14,10),"CircuitikZ  /  "+("Potentiometer paint" if paint else "Potentiometer contacts"),25,INK,True)
    line(d,(14,44),f"Source {cap['environment']['rendererSha256'][:12]}   |   {DPI} dpi samples   |   same scale and page origin across columns; no registration",14,MUTED)
    note="Top: bare path (no leads). Middle: red (red head). Bottom: draw=red (black head). Gray dots mark the page, not circuit terminals." if paint else "Difference: dark = shared ink, magenta = converter only, green = editor only. Wire colors are visible in the source columns."
    line(d,(14,65),note,14,MUTED)
    for j,(_,label) in enumerate(columns): line(d,(14+j*cw,93),label,16,ACCENT,True)
    y=123
    rows={PAINT:("One source, three paint modes","red / arrowhead",(17.5,18.6,24.5,24.55),2.23)} if paint else DETAILS
    for case,(title,detail,rect,zoom) in rows.items():
        d.line((14,y,width-14,y),fill=RULE); line(d,(14,y+5),title,17,INK,True); y+=32
        crops=[("",None,.37),(detail,rect,zoom)]
        if paint: crops.append(("draw=red / arrowhead",(17.5,34.6,24.5,40.55),2.23))
        for desc,box,scale in crops:
            if box: line(d,(14,y+1),desc+"  /  fixed page crop",13,MUTED,True); y+=22
            height=0
            for j,(key,_) in enumerate(columns):
                im=imgs[case][key]
                if box:
                    x0,y0,x1,y1=np.rint(np.array(box)*PPM).astype(int)
                    tile=Image.new("RGB",(x1-x0,y1-y0),"white"); tile.paste(im,(-x0,-y0)); im=tile
                tile=im.resize(tuple(round(v*scale) for v in im.size),Image.Resampling.LANCZOS if scale<1 else Image.Resampling.NEAREST)
                assert tile.width<=cw-10
                x=14+j*cw; sheet.paste(tile,(x,y)); d.rectangle((x-1,y-1,x+tile.width,y+tile.height),outline=RULE)
                height=max(height,tile.height)
            if not box:
                x=14+cw*len(columns)-100; w=10*PPM*scale
                d.line((x,y-15,x+w,y-15),fill=INK,width=2); line(d,(x+w+4,y-22),"10 mm",11,MUTED)
            y+=height+10
        y+=5
    assert y<=sheet.height
    sheet.crop((0,0,width,y)).save(out/name)

if __name__=="__main__":
    ap=argparse.ArgumentParser(description=__doc__); ap.add_argument("stage",type=Path); ap.add_argument("--before",type=Path); ap.add_argument("--paint-before",type=Path)
    args=ap.parse_args(); root=args.stage.resolve(); cap,imgs=rasters(root)
    old=rasters(args.before)[1] if args.before else None
    if args.paint_before:
        assert old and PAINT not in old
        old[PAINT]=rasters(args.paint_before)[1][PAINT]
    dest=root/"overlays"; dest.mkdir(exist_ok=True)
    for case,ims in imgs.items():
        if old: ims["before"]=old[case]["live"]
        for k in ("live","download"):
            diff=overlay(ims["rsvg"],ims[k]); diff.save(dest/f"{case}-{k}.png")
            if k=="live": ims["diff"]=diff
    cols=[("pdf","Original MacTeX PDF"),("rsvg","tikztosvg / librsvg")]
    if old: cols.append(("before","Parent / editor"))
    make(root,cap,imgs,cols+[("live","Candidate / editor" if old else "Parent / editor"),("diff","Editor vs converter")],"gallery.png")
    make(root,cap,imgs,[("pdf","Original MacTeX PDF"),("tikztosvg","tikztosvg / Chrome"),("rsvg","tikztosvg / librsvg"),("live","Loaded editor"),("download","Downloaded SVG"),("export","CLI export")],"all-routes.png")
    if PAINT in imgs:
        make(root,cap,imgs,cols+[("live","Loaded editor"),("download","Downloaded SVG"),("export","CLI export")],"paint.png",True)
