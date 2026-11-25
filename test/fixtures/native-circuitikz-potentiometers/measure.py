"""Potentiometer bodies, wipers and wired contacts measured from physical paint."""
import argparse
import hashlib
import subprocess
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

import numpy as np
import pymupdf
from PIL import Image

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"native-positioning-targets"))
from audit import csv_out, read, sha
from locate import DPI, MM_PER_BP as MM, PPM
import pot_paint as paint

TRIPLE,LONG,PROBE="manual-wipers","manual-longpot","wired-probe"
JS=("live","download","export"); REFS=("pdf","tikztosvg","rsvg")
IDS={TRIPLE:("A","B","C"),LONG:("upper-R","longpot","lower-R"),PROBE:("H","M","I")}
BLACK=(0.,0.,0.)
def length(x): return np.linalg.norm(x,axis=-1)
def rounded(r): return {k:round(float(v),5) if isinstance(v,(float,np.floating)) else v for k,v in r.items()}

def manual_check(root):
    name=subprocess.check_output(["kpsewhich","-format=TeX system documentation","circuitikzmanual.tex"],text=True).strip()
    lines=Path(name).read_bytes().splitlines(keepends=True)
    for case,start,end in ((TRIPLE,2294,2302),(LONG,2348,2355)):
        src=(root.parent/(case+".tex")).read_bytes()
        assert src[src.index(b"\\begin{circuitikz}"):src.index(b"\\end{document}")]==b"".join(lines[start-1:end]),case

def vertices(op):
    # Expand SVG/PDF rectangles and curves to their physical boundary; do not use
    # a rotated bounding box or confuse cubic control points with an arrow tip.
    pts=[]
    for typ,*v in op["items"]:
        if typ=="l": pts+=v
        elif typ=="re": b=v[0]; pts += [b.tl,b.tr,b.br,b.bl,b.tl]
        elif typ=="qu": b=v[0]; pts += [b.ul,b.ur,b.lr,b.ll,b.ul]
        elif typ=="c":
            t=np.linspace(0,1,65); pts.extend(np.stack([(1-t)**3,3*t*(1-t)**2,3*t*t*(1-t),t**3],axis=1)@np.array(v))
        else: raise ValueError(typ)
    xy=np.array(pts,dtype=float)*MM
    return xy[np.r_[True,length(np.diff(xy,axis=0))>.00002]]

def leads(strokes,t,span,count,sort_axis):
    n=np.array([t[1],-t[0]]); groups=[]
    for op,_ in strokes:
        for kind,*v in op["items"]:
            if kind!="l": continue
            p=np.array(v)*MM; delta=p[1]-p[0]
            if length(delta)<6 or abs(delta@n)>.08: continue
            level=p.mean(0)@n; g=next((g for g in groups if abs(g[0]-level)<.08),None)
            if g is None: g=(level,[]); groups.append(g)
            g[1].extend(p)
    found=[]
    for level,pts in groups:
        a=np.array(pts)@t
        if abs(np.ptp(a)-span)<1:
            found.append((t*((a.min()+a.max())/2)+level*n,t,n,np.ptp(a)))
    assert len(found)==count,("cannot uniquely identify component leads",count,len(found))
    return sorted(found,key=lambda q:q[0][sort_axis])

def witness(rgb,points,channel=None):
    for x,y in np.floor(np.atleast_2d(points)*PPM).astype(int):
        patch=rgb[max(0,y-1):y+2,max(0,x-1):x+2]
        if not patch.size: return False
        if channel is None: hits=np.max(patch,axis=2)<130
        else:
            c=patch.astype(int); hits=(c[:,:,channel]-np.delete(c,channel,axis=2).max(axis=2))>55
        if not hits.any(): return False
    return True

def glyphs(file,page,case,converter):
    result={}; ordinary=[]
    if converter:
        r=ET.parse(file).getroot(); box=np.fromstring(r.get("viewBox"),sep=" ")
        assert np.all(box[:2]==0) and all(abs(float(r.get(k).removesuffix("pt"))-v)<.001 for k,v in zip(("width","height"),box[2:]))
        us=r.findall("./{*}g/{*}use"); chars={TRIPLE:"ABC",LONG:"RPR",PROBE:""}[case]
        assert len(us)==len(chars) and all("transform" not in x.attrib for x in r.findall("./{*}g")+us)
        if case==LONG: assert us[0].get("{http://www.w3.org/1999/xlink}href")==us[2].get("{http://www.w3.org/1999/xlink}href")
        items=[(c,np.array([float(u.get("x")),float(u.get("y"))])*MM) for c,u in zip(chars,us)]
    else: items=[(chr(ch[0]),np.array(ch[2])*MM) for s in page.get_texttrace() for ch in s["chars"]]
    for char,point in items:
        if case==LONG and char=="R": ordinary.append(point)
        else:
            name="longpot" if case==LONG and char=="P" else char
            assert name in IDS[case] and name not in result,(case,char)
            result[name]=point
    if ordinary:
        assert len(ordinary)==2
        result["upper-R"],result["lower-R"]=sorted(ordinary,key=lambda q:q[1])
    return result

def body_and_wiper(row,mid,t,n,strokes,fills,rgb,ordinary):
    near=lambda p: length(p.mean(0)-mid)<12
    bodies=[(o,p) for o,p in strokes if near(p) and len(p)>=4 and np.ptp((p-mid)@n)>1 and np.ptp((p-mid)@t)>5]
    assert len(bodies)<=1,(row["case"],row["component"],"ambiguous body")
    row["body"]="missing"
    if not bodies: return
    op,body=bodies[0]; a=(body-mid)@t; b=(body-mid)@n
    closed=length(body[0]-body[-1])<.01 or bool(op["closePath"])
    if closed and length(body[0]-body[-1])>.01: body=np.vstack([body,body[0]])
    signs=np.sign(b[abs(b)>.05]); turns=1+np.count_nonzero(np.diff(signs)) if len(signs) else 0
    row.update(body="rectangle" if closed else "zigzag",zigs=0 if closed else turns/2,
               bodyLength=np.ptp(a),bodyHeight=np.ptp(b),bodyAlong=(a.max()+a.min())/2,bodyNormal=(b.max()+b.min())/2,
               bodyPen=op["width"]*MM,bodyPaint=witness(rgb,(body[:-1]+body[1:])/2))
    ends=[]
    for wire,_ in strokes:
        for kind,*v in wire["items"]:
            if kind!="l": continue
            q=np.array(v)*MM-mid; along=np.sort(q@t)
            if max(abs(q@n))<.04 and np.ptp(along)>6: ends.append(along)
    for key,s,edge in (("leadLeftGap",-1,a.min()),("leadRightGap",1,a.max())):
        tips=[max(p) if s<0 else min(p) for p in ends if (max(p) if s<0 else -min(p))<0]
        if len(tips)==1: row[key]=s*(tips[0]-edge)
    shafts=[(o,p) for o,p in strokes if len(p)==2 and near(p) and np.ptp((p-mid)@t)<.05 and .2<length(p[1]-p[0])<8
            and a.min()-.05<((p.mean(0)-mid)@t)<a.max()+.05 and min(abs((p-mid)@n))<max(abs(b))+3]
    assert len(shafts)<=1,(row["case"],row["component"],"ambiguous shaft")
    row["shaft"]=bool(shafts)
    if not shafts or ordinary: return
    op,p=shafts[0]; tail,inner=sorted(p,key=lambda pt:abs((pt-mid)@n),reverse=True)
    at=(tail-mid)@t; an=(tail-mid)@n; side=np.sign(an)
    row.update(tailX=tail[0],tailY=tail[1],tailAlong=at,tailNormal=an,shaftLength=length(inner-tail),shaftPen=op["width"]*MM,
               shaftPaint=witness(rgb,(inner+tail)/2))
    heads=[]
    for xy in fills:
        x=(xy-mid)@t; y=(xy-mid)@n*side
        if abs((x.min()+x.max())/2-at)<.18 and .25<np.ptp(x)<3 and .25<np.ptp(y)<4 and 0<y.min()<y.max()<abs(an)+.05:
            heads.append((xy,y))
    assert len(heads)<=1,(row["case"],row["component"],"ambiguous wiper tip")
    row["head"]=bool(heads)
    if not heads: return
    xy,y=heads[0]; tip=xy[y.argmin()]; u=body[:-1]; d=body[1:]-u
    projection=np.clip(((tip-u)*d).sum(axis=1)/(d*d).sum(axis=1),0,1)
    polygon=xy-xy[0]; x0,y0=polygon.T
    row.update(tipAlong=(tip-mid)@t,tipNormal=(tip-mid)@n,headWidth=np.ptp((xy-mid)@t),headDepth=np.ptp(y),
               headArea=abs(x0@np.roll(y0,-1)-y0@np.roll(x0,-1))/2,
               tipToBody=length(tip-u-d*projection[:,None]).min(),headPaint=witness(rgb,xy.mean(0)))

def panel(stage,e,k):
    case=e["id"]; core="tikztosvg" if k=="rsvg" else k; m=e["panels"][core]
    ext="pdf" if k=="pdf" else "svg"; file=stage/m[ext+"File"]; png=stage/m["file"]
    assert sha(file)==m[ext+"Sha256"] and sha(png)==m["sha256"]
    if k=="rsvg":
        png=stage/"capture/rsvg"/(case+".png"); png.parent.mkdir(exist_ok=True)
        subprocess.run(["rsvg-convert","-b","white","-d",str(DPI),"-p",str(DPI),"-o",png,file],check=True)
    rgb=np.array(Image.open(png).convert("RGB"))
    with (pymupdf.open(file) if k=="pdf" else pymupdf.open(stream=subprocess.check_output(["rsvg-convert","-f","pdf",file]),filetype="pdf")) as doc:
        assert len(doc)==1; pg=doc[0]; size=np.array(pg.rect)[2:]*MM; paths=pg.get_drawings()
        text={} if case==paint.PAINT else glyphs(file,pg,case,k in ("tikztosvg","rsvg"))
    if k!="pdf":
        actual=np.array(m["intrinsicCssPx"])*25.4/96; assert max(abs(actual-size))<.002; size=actual
    info=dict(case=case,panel=k,pageW=size[0],pageH=size[1],rasterSha=sha(png))
    if case==paint.PAINT: return info,paint.rows(paths,rgb,k,vertices,PPM)
    strokes=[(op,vertices(op)) for op in paths if op["color"]==BLACK and op["width"]]
    fills=[vertices(op) for op in paths if op["fill"]==BLACK]
    if case==TRIPLE: frames=leads(strokes,np.array([0.,1.]),40,3,0)
    elif case==LONG: frames=leads(strokes,np.array([1.,0.]),40,3,1)
    else:
        v=np.array([40.,-16.]); frames=leads(strokes,np.array([1.,0.]),40,1,1)+leads(strokes,v/length(v),length(v),2,1)
    rows=[]
    for i,(name,(mid,t,n,span)) in enumerate(zip(IDS[case],frames)):
        row=dict(case=case,panel=k,component=name,midX=mid[0],midY=mid[1],leadSpan=span)
        ordinary=case==LONG and name!="longpot"
        body_and_wiper(row,mid,t,n,strokes,fills,rgb,ordinary)
        if case!=PROBE:
            row["label"]=name in text
            if name in text: row.update(labelX=text[name][0],labelY=text[name][1])
        else:
            channel=(2,0,1)[i]
            wires=[op for op in paths if op["color"] and np.argmax(op["color"])==channel and np.ptp(op["color"])>.4]
            row["wire"]=len(wires)==1
            if row["wire"]:
                start,end=vertices(wires[0])[[0,-1]]; delta=end-start
                color="".join("%02x"%int(c) for c in np.rint(np.array(wires[0]["color"])*255))
                row.update(wireColor=color,wireX=start[0],wireY=start[1],busX=end[0],busY=end[1],wirePaint=witness(rgb,start+.5*delta/length(delta),channel))
                if "tailX" in row: row["wireToWiper"]=length(start-[row["tailX"],row["tailY"]])
        rows.append(row)
    return info,rows

def audit(stage,before,paint_before,strict):
    cap=read(stage/"capture.json"); assert cap["dpi"]==DPI and not cap["errors"] and not cap["badRequests"]
    assert sha(stage/"summary.json")==cap["summarySha256"] and read(stage/"summary.json")["gate"]["accepted"]
    root=Path(cap["fixtureRoot"]); manual_check(root)
    old={e["id"]:(before,e) for e in read(before/"capture.json")["rows"]} if before else {}
    if paint_before:
        assert before and paint.PAINT not in old, "Only supplement a baseline that predates the paint probe"
        old[paint.PAINT]=(paint_before,next(e for e in read(paint_before/"capture.json")["rows"] if e["id"]==paint.PAINT))
    if strict: assert set(e["id"] for e in cap["rows"])==set(IDS)|{paint.PAINT} and old
    pages=[]; components=[]; residuals=[]; page_diffs=[]; paints=[]; paint_diffs=[]; diag=[]; locks=[]; lock_rows=[]
    for e in cap["rows"]:
        case=e["id"]; assert e["editorRenderClicked"] and e["previousSvgDetached"]
        assert e["originalPdfInputMatchesSource"] and sha(root/e["source"])==e["sourceSha256"]
        src=(root/e["source"]).read_bytes()
        drawing=src[src.index(b"\\begin{circuitikz}"):src.index(b"\\end{circuitikz}")].replace(b"\\begin{circuitikz}",b"\\begin{tikzpicture}")
        assert (stage/"tikztosvg-input"/(case+".tex")).read_bytes().lstrip(b"\n").startswith(drawing+b"\\tikzset{execute at end picture=")
        def xml(route):
            return [(node.tag,sorted(node.attrib.items()),(node.text or "").strip()) for node in ET.parse(stage/e["panels"][route]["svgFile"]).iter()]
        live,download,cli=map(xml,JS)
        assert live==download,(case,"editor vs downloaded markup")
        # CLI font-face URLs refer to bundled files; all drawing elements must match.
        without_css=lambda tree:[(tag,attrs,"" if tag.endswith("}style") else text) for tag,attrs,text in tree]
        assert without_css(download)==without_css(cli),(case,"download vs CLI drawing")
        if e["diagnostics"] or e["exportDiagnostics"]: diag.append(case)
        sets={}; pg={}
        for k in (*JS,*REFS):
            pg[k],sets[k]=panel(stage,e,k); pages.append(rounded(pg[k]))
            (paints if case==paint.PAINT else components).extend(map(rounded,sets[k]))
        if before:
            base,entry=old[case]; assert e["sourceSha256"]==entry["sourceSha256"]
            def fingerprints(folder,item):
                p=item["panels"]; f=p["pdf"]
                with pymupdf.open(folder/f["pdfFile"]) as doc: stream=hashlib.sha256(doc[0].read_contents()).hexdigest()
                return {"PDF-page-stream":stream,"PDF-Poppler":f["sha256"],"converter-SVG":p["tikztosvg"]["svgSha256"],
                        "converter-Chrome":p["tikztosvg"]["sha256"],"converter-librsvg":sha(folder/"capture/rsvg"/(case+".png"))}
            a=fingerprints(base,entry); b=fingerprints(stage,e)
            for kind in a:
                lock_rows.append(dict(case=case,artifact=kind,baseline=base.name,original=a[kind],current=b[kind],match=a[kind]==b[kind]))
                if a[kind]!=b[kind]: locks.append((case,kind))
        for k in (*JS,*REFS):
            for ref in ("pdf","tikztosvg"):
                if k==ref: continue
                pd={j:pg[k][j]-pg[ref][j] for j in ("pageW","pageH")}
                pbad=[j for j,v in pd.items() if abs(v)>.02]
                page_diffs.append(dict(case=case,panel=k,reference=ref,fail=" ".join(pbad),**rounded(pd)))
                if k in REFS: assert not pbad,(case,k,ref,pd)
                for r,oracle in zip(sets[k],sets[ref]):
                    name=oracle["component"]; assert r["component"]==name
                    if case==paint.PAINT:
                        bad=[]
                        for j,expected in zip(paint.FEATURES,paint.EXPECTED[name]):
                            for key in (j,j+"Pixels"):
                                assert oracle[key]==expected,(ref,name,key,oracle[key],expected)
                                if r[key]!=oracle[key]: bad.append(key)
                        paint_diffs.append(dict(case=case,panel=k,reference=ref,component=name,fail=" ".join(bad)))
                        if k in REFS: assert not bad,(case,k,ref,name,bad)
                        continue
                    assert oracle["body"]!="missing" and oracle["bodyPaint"] and all(j in oracle for j in ("leadLeftGap","leadRightGap"))
                    if not (case==LONG and name!="longpot"):
                        assert all(oracle.get(j) for j in ("head","shaft","headPaint","shaftPaint"))
                    if case==PROBE: assert oracle["wirePaint"] and oracle["wireToWiper"]<.02
                    else: assert oracle["label"]
                    delta={}; bad=[]
                    for j in sorted((set(oracle)|set(r))-{"case","panel","component"}):
                        v=r.get(j); w=oracle.get(j)
                        if w is None or v is None: delta[j]="missing" if v is None else "extra"; bad.append(j)
                        elif isinstance(w,(bool,str)): delta[j]="same" if v==w else str(v)+" vs "+str(w); bad+=[] if v==w else [j]
                        else:
                            delta[j]=v-w
                            if abs(delta[j])>(.035 if j=="headArea" else 0 if j=="zigs" else .02): bad.append(j)
                    residuals.append(dict(case=case,panel=k,reference=ref,component=name,fail=" ".join(bad),**rounded(delta)))
                    if k in REFS: assert not bad,(case,k,ref,name,bad,delta)
    for file,data in (("pages",pages),("components",components),("component-residuals",residuals),("page-residuals",page_diffs)): csv_out(stage/(file+".csv"),data)
    if paints: csv_out(stage/"paint.csv",paints); csv_out(stage/"paint-residuals.csv",paint_diffs)
    if lock_rows: csv_out(stage/"reference-locks.csv",lock_rows)
    f,p,q=(sum(bool(r["fail"]) for r in data) for data in (residuals,page_diffs,paint_diffs))
    print(cap["revision"],"components:",len(residuals)-f,"/",len(residuals),"; pages:",len(page_diffs)-p,"/",len(page_diffs),"; paint:",len(paint_diffs)-q,"/",len(paint_diffs),"; diagnostics:",diag,"; native hash differences:",locks)
    if strict and (f or p or q or diag or locks): raise SystemExit(1)

if __name__=="__main__":
    ap=argparse.ArgumentParser(description=__doc__); ap.add_argument("stage",type=Path)
    ap.add_argument("--before",type=Path); ap.add_argument("--paint-before",type=Path,help="First capture of the later-added fourth fixture")
    ap.add_argument("--require-all",action="store_true")
    a=ap.parse_args(); audit(a.stage.resolve(),a.before,a.paint_before,a.require_all)
