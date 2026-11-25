"""Classify actual Cartesian stems/caps by incidence with the painted data markers."""
import argparse
import hashlib
import subprocess
import sys
import tarfile
from pathlib import Path
from xml.etree import ElementTree as ET

import numpy as np
import pymupdf
from PIL import Image

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parent/"native-circuitikz-resistor-modifiers"))
from check import DPI, JS, MM, PPM, REFS, color, csv_out, ink, length, read, rounded, sha

SYM,ASY,FIX,AUTO,TABLE="manual-symmetric","manual-asymmetric","fixed-scatter","auto-extents","grouped-table"
DIR=("x+","x-","y+","y-")
ACTIVE={SYM:[("y+",)]*5,ASY:[DIR,("x-","y-"),(),DIR],FIX:[DIR,("x-","y+"),("y-",)],AUTO:[DIR,(),DIR],TABLE:[("y+","y-")]*4}
# Parent renders each error tuple as another ordinary marker. Retain and count
# them; the true data records are identifiable by their literal source order.
OLD={SYM:(10,[0,2,4,6,8]),ASY:(8,[0,3,5,6]),FIX:(5,[0,3,4]),AUTO:(7,[0,3,4]),TABLE:(-1,[])}
NEAR=.04; LIMIT=.02

def load_panel(stage,e,k):
    p=e["panels"]["tikztosvg" if k=="rsvg" else k]; ext="pdf" if k=="pdf" else "svg"
    f,png=stage/p[ext+"File"],stage/p["file"]
    assert sha(f)==p[ext+"Sha256"] and sha(png)==p["sha256"]
    if k=="rsvg":
        png=stage/"capture/rsvg"/(e["id"]+".png"); png.parent.mkdir(exist_ok=True)
        subprocess.run(["rsvg-convert","-b","white","-d",str(DPI),"-p",str(DPI),"-o",png,f],check=True)
    with (pymupdf.open(f) if k=="pdf" else pymupdf.open(stream=subprocess.check_output(["rsvg-convert","-f","pdf",f]),filetype="pdf")) as doc:
        assert len(doc)==1; g=doc[0]; size=np.array(g.rect)[2:]*MM; paths=g.get_drawings(); labels=g.get_text().split()
    if k!="pdf":
        intrinsic=np.array(p["intrinsicCssPx"])*25.4/96; assert max(abs(intrinsic-size))<.002; size=intrinsic
    return paths,size,np.array(Image.open(png).convert("RGB")),sha(png),labels

def screen_ink(rgb,points,hue):
    # Caps coincident with the black axis are antialiased over black, not white.
    c=np.frombuffer(bytes.fromhex(hue),np.uint8).astype(float); chroma=c-c.mean()
    if np.max(abs(chroma))<1: return ink(rgb,points,hue)
    for x,y in np.floor(np.atleast_2d(points)*PPM).astype(int):
        patch=rgb[max(0,y-1):y+2,max(0,x-1):x+2].astype(float)
        cc=patch-patch.mean(2,keepdims=True); coverage=(cc@chroma)/(chroma@chroma)
        if not ((coverage>.30)&(coverage<1.07)&(np.max(abs(cc-coverage[:,:,None]*chroma),axis=2)<20)).any(): return False
    return True

def axis_ticks(paths,frame):
    l,t,r,b=frame; ticks={s:[] for s in ("bottom","top","left","right")}
    for o in paths:
        c=o["color"]
        if c is None or np.ptp(c)>.015 or not .2<max(c)<.8: continue
        for item in o["items"]:
            if item[0]!="l": continue
            ends=np.array(item[1:])*MM; step=np.ptp(ends,axis=0); axis=int(step.argmax())
            if step[axis]>4 or step[1-axis]>.015: continue
            candidates=(("top",t),("bottom",b)) if axis else (("left",l),("right",r))
            dist,side,idx=min((abs(q[axis]-edge),side,idx) for side,edge in candidates for idx,q in enumerate(ends))
            assert dist<.05,("unattached tick",side,ends)
            x,y=ends[idx]; ticks[side].append(dict(plotAt=x-l if axis else b-y,tickPageX=x,tickPageY=y,tickLength=step[axis],tickPen=o["width"]*MM))
    return {f"tick-{side}-{i+1}":q for side,group in ticks.items() for i,q in enumerate(sorted(group,key=lambda q:q["plotAt"]))}

def physical(case,paths,size,rgb):
    frames=[np.array(o["rect"])*MM for o in paths if color(o["color"])=="000000" and min(o["rect"].width,o["rect"].height)*MM>20]
    assert len(frames)==1,(case,"axis frame",frames)
    l,t,r,b=frames[0]; marks=[]; bars=[]; segments=[]; joining=[]; links=0
    for o in paths:
        boundary=np.array(o["rect"])*MM
        if o["fill"] and np.ptp(o["fill"])>.45 and any(v[0]=="c" for v in o["items"]):
            marks.append(((boundary[:2]+boundary[2:])/2,color(o["fill"])))
        if case==TABLE and o["fill"] and o["color"] and np.ptp(o["color"])>.45:
            for v in o["items"]:
                if v[0]!="re": continue
                x0,y0,x1,y1=np.array(v[1])*MM
                marks.append((np.array([(x0+x1)/2,y0]),color(o["color"])))
                bars.append(dict(barWidth=x1-x0,barHeight=y1-y0,barFill=color(o["fill"]),barPen=o["width"]*MM))
        short_black=case==TABLE and color(o["color"])=="000000" and max(o["rect"].width,o["rect"].height)*MM<4
        if not o["color"] or (np.ptp(o["color"])<.45 and not short_black): continue
        compound=any(v[0]=="l" and min(abs(np.diff(np.array(v[1:]),axis=0)[0]))*MM>.02 for v in o["items"])
        for item in o["items"]:
            if item[0]!="l": continue
            ends=np.array(item[1:])*MM; step=np.abs(ends[1]-ends[0])
            if step.max()>.012: joining.append((ends,color(o["color"]),o["width"]*MM,int(step.argmax()),compound,o))
    for ends,c,pen,axis,compound,op in joining:
        if compound and all(any(length(pt-q)<NEAR for pt,_ in marks) for q in ends):
            links+=1
        elif min(abs(ends[1]-ends[0]))<.009: segments.append((ends,c,pen,axis,op))
    count=len(ACTIVE[case]); legacy_count,legacy_indices=OLD[case]
    ids=legacy_indices if len(marks)==legacy_count else range(min(count,len(marks)))
    data=[marks[i] for i in ids]; rows=axis_ticks(paths,frames[0]); used=set(); n_stem=n_cap=0
    def location(pt):
        return dict(pageX=pt[0],pageY=pt[1],plotX=pt[0]-l,plotY=b-pt[1])
    def stroke(prefix,op):
        ends=tuple(op["lineCap"]); names=("butt","round","square")
        return {prefix+"Ending":"/".join(names[i] for i in dict.fromkeys(ends)),
                prefix+"Dash":op["dashes"].replace(" ",""),prefix+"Opacity":op["stroke_opacity"]}
    for i,(point,hue) in enumerate(data):
        rows[f"p{i+1}"]=dict(hue=hue,ink=screen_ink(rgb,point,hue),**location(point))
        if bars: rows[f"p{i+1}"].update(**bars[i],barShift=point[0]-l-(r-l)*(1,3,1,3)[i]/4)
    stems={}
    for j,(ends,hue,pen,axis,op) in enumerate(segments):
        hits=[(i,h) for i,(pt,_) in enumerate(data) for h in (0,1) if length(ends[h]-pt)<NEAR]
        if len(hits)!=1: continue
        i,h=hits[0]; pt=data[i][0]; end=ends[1-h]; delta=end[axis]-pt[axis]
        direction=("x+" if delta>0 else "x-") if axis==0 else ("y-" if delta>0 else "y+")
        key=(i,direction)
        if key in stems: continue  # a duplicate remains an explicitly unassigned segment
        stems[key]=(end,pen,hue,length(ends[h]-pt),op); used.add(j); n_stem+=1
    for i,directions in enumerate(ACTIVE[case]):
        for direction in dict.fromkeys([*directions,*(d for j,d in stems if j==i)]):
            key=(i,direction); zero=(case==ASY and key==(1,"y-")); axis=int(direction[0]=="y")
            rec={"stem":key in stems,"cap":False}; rows[f"p{i+1}:{direction}"]=rec
            if i>=len(data): continue
            point,hue=data[i]
            if key in stems:
                end,pen,line_hue,gap,op=stems[key]
                rec.update(baseGap=gap,stemPen=pen,stemColor=line_hue,stemInk=screen_ink(rgb,.37*point+.63*end,line_hue),**stroke("stem",op))
            elif zero: end=point
            else: continue
            rec.update(span=(end[axis]-point[axis])*(1 if axis==0 else -1),**location(end))
            if case==AUTO and (i,direction) in ((0,"x-"),(0,"y-"),(2,"x+"),(2,"y+")):
                rec["edgeGap"]={"x-":end[0]-l,"x+":r-end[0],"y-":b-end[1],"y+":end[1]-t}[direction]
            candidates=[(length(v.mean(0)-end),j) for j,(v,_,__,a,op) in enumerate(segments) if j not in used and (a!=axis or zero)]
            if candidates:
                distance,j=min(candidates)
                if distance<.65:
                    v,c,pen,orientation,op=segments[j]; center=v.mean(0); used.add(j); n_cap+=1
                    rec.update(cap=True,capAxis="vertical" if orientation else "horizontal",capLength=length(v[1]-v[0]),capPen=pen,capColor=c,
                               capPageX=center[0],capPageY=center[1],capOffsetX=center[0]-end[0],capOffsetY=center[1]-end[1],**stroke("cap",op))
                    # The zero-error cap is underneath an opaque, equally wide mark.
                    # Its vector is observable in both references; its pixels are not.
                    if not zero: rec["capInk"]=screen_ink(rgb,np.array([.2*v[0]+.8*v[1],.8*v[0]+.2*v[1]]),c)
    rows["frame"]=dict(pageW=size[0],pageH=size[1],left=l,top=t,right=r,bottom=b,plotW=r-l,plotH=b-t)
    rows["inventory"]=dict(markers=len(marks)-len(bars),bars=len(bars),ticks=sum(n.startswith("tick-") for n in rows),
                           dataLinks=links,stems=n_stem,caps=n_cap,unassigned=len(segments)-len(used))
    return rows

def domain(key):
    if key in ("pageW","pageH","left","right","top","bottom","pageX","pageY","capPageX","capPageY","tickPageX","tickPageY"): return "absolute"
    if key in ("plotW","plotH","plotX","plotY","edgeGap","plotAt","barShift"): return "plot"
    return "local"

def audit(stage,before,strict):
    cap=read(stage/"capture.json"); assert cap["dpi"]==DPI and not cap["errors"] and not cap["badRequests"]
    assert sha(stage/"summary.json")==cap["summarySha256"] and read(stage/"summary.json")["gate"]["accepted"]
    cases={e["id"] for e in cap["rows"]}; assert cases==set(ACTIVE) or (not strict and cases==set(ACTIVE)-{TABLE})
    archive=subprocess.check_output(["kpsewhich","-format=TeX system documentation","pgfplots.doc.src.tar.bz2"],text=True).strip()
    with tarfile.open(archive) as tar: manual=tar.extractfile("pgfplots.reference.errorbars.tex").readlines()
    old={e["id"]:e for e in read(before/"capture.json")["rows"]} if before else {}
    records=[]; pages=[]; diffs=[]; locks=[]; diag=[]; label_rows=[]; label_fail=[]
    for e in cap["rows"]:
        case=e["id"]; src=Path(cap["fixtureRoot"])/e["source"]
        assert e["editorRenderClicked"] and e["previousSvgDetached"] and e["originalPdfInputMatchesSource"] and sha(src)==e["sourceSha256"]
        tex=src.read_bytes(); picture=tex[tex.index(b"\\begin{tikzpicture}"):tex.index(b"\\end{document}")]
        if case in (SYM,ASY):
            first,last=(54,67) if case==SYM else (313,326)
            assert picture==b"".join(manual[first-1:last]) and b"\\pgfplotsset{width=7cm,compat=1.18}" in tex
        assert (stage/"tikztosvg-input"/(case+".tex")).read_bytes().lstrip(b"\n").startswith(picture.split(b"\\end{tikzpicture}")[0]+b"\\tikzset{execute at end picture=")
        def xml(k): return [(n.tag,sorted(n.attrib.items()),(n.text or "").strip()) for n in ET.parse(stage/e["panels"][k]["svgFile"]).iter()]
        assert xml("live")==xml("download")
        if e["diagnostics"] or e["exportDiagnostics"]: diag.append(case)
        panels={}; texts={}
        for k in (*JS,*REFS):
            paths,size,rgb,h,words=load_panel(stage,e,k); panel=panels[k]=physical(case,paths,size,rgb)
            if k in (*JS,"pdf"):
                num_x=sum(s.startswith("tick-bottom-") for s in panel); texts[k]=(words[:num_x],words[num_x:])
            pages.append(dict(case=case,panel=k,rasterSha=h,**rounded(panel["frame"])))
            records.extend(dict(case=case,panel=k,feature=name,**rounded(obj)) for name,obj in panel.items())
        for k,(x,y) in texts.items():
            okay=(x,y)==texts["pdf"]; label_rows.append(dict(case=case,panel=k,x=" ".join(x),y=" ".join(y),matchesPDF=okay))
            if not okay: label_fail.append((case,k))
        for k,panel in panels.items():
            for ref in ("pdf","tikztosvg"):
                if k==ref: continue
                target=panels[ref]; inv=target["inventory"]
                assert inv["markers"]+inv["bars"]==len(ACTIVE[case]) and inv["unassigned"]==0,(case,ref,inv)
                for name in sorted(set(target)|set(panel)):
                    a=panel.get(name,{}); b=target.get(name,{}); bad={"local":[],"plot":[],"absolute":[]}; delta={}
                    if ":" in name and b:
                        assert b["stem"]==(case!=ASY or name!="p2:y-") and b["cap"]==(case!=FIX or name!="p3:y-"),(case,ref,name,b)
                    for key in sorted(set(a)|set(b)):
                        v=a.get(key); w=b.get(key)
                        if b and (key.endswith("Ink") or key=="ink"): assert w is True,(case,ref,name,key)
                        if v is None or w is None: diff="missing" if v is None else "extra"; fail=True
                        elif isinstance(w,(str,bool)): fail=v!=w; diff=f"{v} vs {w}" if fail else "same"
                        else: diff=v-w; fail=abs(diff)>LIMIT
                        delta[key]=diff
                        if fail: bad[domain(key)].append(key)
                    fields={g+"Fail":" ".join(keys) for g,keys in bad.items()}
                    diffs.append(dict(case=case,panel=k,reference=ref,feature=name,fail=" ".join(filter(None,fields.values())),**fields,**rounded(delta)))
                    if k in REFS: assert not any(bad.values()),(case,k,ref,name,bad,delta)
        if before:
            assert old[case]["sourceSha256"]==e["sourceSha256"]
            for route,field in (("pdf","pageStream"),("pdf","sha256"),("tikztosvg","svgSha256"),("tikztosvg","sha256"),("rsvg","sha256")):
                if route=="rsvg":
                    rel=Path("capture/rsvg")/(case+".png"); a,b=sha(before/rel),sha(stage/rel)
                elif field=="pageStream":
                    def stream(folder,entry):
                        with pymupdf.open(folder/entry["panels"]["pdf"]["pdfFile"]) as doc: return hashlib.sha256(doc[0].read_contents()).hexdigest()
                    a,b=stream(before,old[case]),stream(stage,e)
                else: a,b=(row["panels"][route][field] for row in (old[case],e))
                lock=dict(case=case,route=route,field=field,original=a,current=b,match=a==b)
                if a!=b and route=="tikztosvg" and field=="sha256":
                    pair=[np.array(Image.open(folder/row["panels"][route]["file"]).convert("RGB"),dtype=int) for folder,row in ((before,old[case]),(stage,e))]
                    if pair[0].shape==pair[1].shape:
                        err=abs(pair[0]-pair[1]); lock.update(changedPixels=int((err.max(2)>0).sum()),maxChannel=int(err.max()))
                locks.append(lock)
    summaries=[]
    for case in ACTIVE:
        for ref in ("pdf","tikztosvg"):
            group=[r for r in diffs if r["case"]==case and r["reference"]==ref and r["panel"]=="live"]
            if not group: continue
            def maximum(keys,items):
                values=[abs(r[k]) for r in items for k in keys if isinstance(r.get(k),(int,float,np.floating))]
                return max(values) if values else ""
            ends=[r for r in group if ":" in r["feature"]]
            summaries.append(dict(case=case,reference=ref,passed=sum(not r["fail"] for r in group),total=len(group),
                stemDelta=maximum(["span"],ends),plotEnd=maximum(["plotX","plotY"],ends),pageEnd=maximum(["pageX","pageY"],ends),
                capLength=maximum(["capLength"],ends),stemPen=maximum(["stemPen"],ends),capPen=maximum(["capPen"],ends),
                edgeGap=maximum(["edgeGap"],ends),tickAt=maximum(["plotAt"],group),plotSize=maximum(["plotW","plotH"],group),
                pageSize=maximum(["pageW","pageH"],group),barShift=maximum(["barShift"],group)))
    for f,data in (("pages",pages),("features",records),("residuals",diffs),("reference-locks",locks),("tick-labels",label_rows),("case-summary",summaries)):
        if data: csv_out(stage/(f+".csv"),data)
    failures=sum(bool(r["fail"]) for r in diffs); unlocked=[(r["case"],r["route"],r["field"]) for r in locks if not r["match"]]
    print(cap["revision"],f"{len(diffs)-failures}/{len(diffs)} comparisons; tick label failures: {label_fail}; diagnostics: {diag}; reference changes: {unlocked}")
    if strict and (failures or unlocked or label_fail or diag or not before): raise SystemExit(1)

if __name__=="__main__":
    ap=argparse.ArgumentParser(description=__doc__); ap.add_argument("stage",type=Path); ap.add_argument("--before",type=Path); ap.add_argument("--require-all",action="store_true")
    args=ap.parse_args(); audit(args.stage,args.before,args.require_all)
