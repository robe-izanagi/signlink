"""SIGNLINK v5 sample: smooth SDF-sculpted AR smart glasses (Connect-style), assembled + exploded GLB.
Units: metres. Front of glasses faces -Z, temples extend +Z, +Y up, Left parts are at -X (same as v2)."""
import numpy as np, json, struct, os, sys
from skimage import measure
from scipy import ndimage as ndi
F=np.float32
OUT=sys.argv[1] if len(sys.argv)>1 else 'out'
# ---------- SDF helpers ----------
def smin(a,b,k):
    h=np.clip(.5+.5*(b-a)/k,0,1); return b*(1-h)+a*h-k*h*(1-h)
def smax(a,b,k): return -smin(-a,-b,k)
def rext(d2,z,hz,r):           # rounded extrusion of a 2D sdf
    a=d2+r; b=np.abs(z)-hz+r
    return np.hypot(np.maximum(a,0),np.maximum(b,0))+np.minimum(np.maximum(a,b),0)-r
def rbox(x,y,z,c,hx,hy,hz,r):
    qx=np.abs(x-c[0])-hx+r;qy=np.abs(y-c[1])-hy+r;qz=np.abs(z-c[2])-hz+r
    return np.sqrt(np.maximum(qx,0)**2+np.maximum(qy,0)**2+np.maximum(qz,0)**2)+np.minimum(np.maximum(qx,np.maximum(qy,qz)),0)-r
def rbox2(x,y,c,hx,hy,r):
    qx=np.abs(x-c[0])-hx+r;qy=np.abs(y-c[1])-hy+r
    return np.hypot(np.maximum(qx,0),np.maximum(qy,0))+np.minimum(np.maximum(qx,qy),0)-r
def cyl(x,y,z,c,ax,r,hh,rd=0.):
    p=[x-c[0],y-c[1],z-c[2]];i='xyz'.index(ax);u=p[i];o=[p[j] for j in range(3) if j!=i]
    a=np.hypot(*o)-r+rd;b=np.abs(u)-hh+rd
    return np.hypot(np.maximum(a,0),np.maximum(b,0))+np.minimum(np.maximum(a,b),0)-rd
def ell(x,y,z,c,rx,ry,rz):
    return (np.sqrt(((x-c[0])/rx)**2+((y-c[1])/ry)**2+((z-c[2])/rz)**2)-1)*min(rx,ry,rz)
def tube(x,y,z,pts,r):
    d=None
    for p,q in zip(pts[:-1],pts[1:]):
        p=np.array(p,F);q=np.array(q,F);ba=q-p
        pa=np.stack(np.broadcast_arrays(x-p[0],y-p[1],z-p[2]),-1)
        t=np.clip((pa@ba)/(ba@ba),0,1);dd=np.linalg.norm(pa-t[...,None]*ba,axis=-1)-r
        d=dd if d is None else np.minimum(d,dd)
    return d
def spring(x,y,z,c,y0,L,R,wr,turns):
    px=x-c[0];pz=z-c[2];rho=np.hypot(px,pz);th=np.arctan2(pz,px)/(2*np.pi);pitch=L/turns
    n=np.round((y-y0)/pitch-th);yt=y0+pitch*(th+n)
    return np.maximum(np.hypot(rho-R,y-yt)-wr,np.maximum(y0-y,y-(y0+L)))
# ---------- mesher ----------
def build(f,lo,hi,h):
    lo=np.array(lo,F)-3*h;hi=np.array(hi,F)+3*h
    xs=np.arange(lo[0],hi[0],h,dtype=F);ys=np.arange(lo[1],hi[1],h,dtype=F);zs=np.arange(lo[2],hi[2],h,dtype=F)
    vol=np.broadcast_to(f(xs[:,None,None],ys[None,:,None],zs[None,None,:]),(len(xs),len(ys),len(zs))).astype(F)
    v,fc,_,_=measure.marching_cubes(vol,0.0,spacing=(h,h,h));v=v.astype(F)
    g=np.gradient(vol,h);idx=(v/h).T
    n=np.stack([ndi.map_coordinates(a,idx,order=1) for a in g],1);n/=np.linalg.norm(n,axis=1,keepdims=True)+1e-12
    p=v[fc];fn=np.cross(p[:,1]-p[:,0],p[:,2]-p[:,0])
    if (fn*n[fc].mean(1)).sum()<0: fc=fc[:,::-1]
    return v+lo,n.astype(F),np.ascontiguousarray(fc).astype(np.uint32)
# ---------- geometry constants ----------
CX,A,BT,BB,N=.0405,.0245,.0185,.0165,2.7
H2=.0004
def se(x,y,cx,cy,a,bt,bb,n=N,taper=.07,h=H2):
    xs=x-cx;ys=y-cy;b=np.where(ys>0,bt,bb);ae=a*(1-taper*np.clip(-ys/bb,0,1))
    q=((np.abs(xs)/ae)**n+(np.abs(ys)/b)**n+1e-12)**(1/n)
    gx=np.gradient(q,h,axis=0);gy=np.gradient(q,h,axis=1);g=np.maximum(np.hypot(gx,gy),.25/max(a,bt))
    return np.maximum((q-1)/g,-.02)
def seg2(x,y,p,q,r):
    p=np.array(p,F);q=np.array(q,F);ba=q-p;t=np.clip(((x-p[0])*ba[0]+(y-p[1])*ba[1])/(ba@ba),0,1)
    return np.hypot(x-p[0]-t*ba[0],y-p[1]-t*ba[1])-r
def frame_f(x,y,z):
    Lo=se(x,y,-CX,0,A+.0052,BT+.0046,BB+.0043);Ro=se(x,y,CX,0,A+.0052,BT+.0046,BB+.0043)
    d=smin(Lo,Ro,.003);d=smin(d,seg2(x,y,(-.011,.0145),(.011,.0145),.0055),.004)
    d=smin(d,rbox2(x,y,(0,.0225),.0685,.0035,.003),.003)
    d=np.maximum(d,-np.minimum(se(x,y,-CX,0,A,BT,BB),se(x,y,CX,0,A,BT,BB)))
    d=rext(d,z,.0045,.0018)
    for s in(-1,1): d=smin(d,rbox(x,y,z,(s*.0695,.0135,.0062),.003,.0092,.0074,.002),.0025)
    return d
def lens_f(s):
    cx=s*CX
    def f(x,y,z):
        zc=.0012+2.5*((x-cx)**2+y**2)
        return rext(se(x,y,cx,0,A+.0014,BT+.0014,BB+.0014),z-zc,.0009,.0007)
    return f
def wg_f(s):
    def f(x,y,z): return rext(rbox2(x,y,(s*.0445,.004),.0105,.0068,.0015),z-.0031,.00035,.0002)
    return f
# temple
def tprof(x,y,z,s):
    xc=s*.07;w=np.interp(z,[0,.10,.152],[.0058,.0058,.0040]);hh=np.interp(z,[0,.04,.11,.152],[.015,.015,.0105,.0085])
    yc=.0135-10*np.maximum(z-.108,0)**2;r=np.minimum(.0025,w/2*.95)
    qx=np.abs(x-xc)-w/2+r;qy=np.abs(y-yc)-hh/2+r
    return np.hypot(np.maximum(qx,0),np.maximum(qy,0))+np.minimum(np.maximum(qx,qy),0)-r
def arm_f(s):
    xo=s*.0729
    def f(x,y,z):
        d=smax(tprof(x,y,z,s),z-.112,.0006);d=smax(d,.0145-z,.001)
        d=np.maximum(d,-rbox(x,y,z,(xo,.0135,.065),.0007+.001,.00425,.0200,.0005).clip(-1,1) if False else -rbox(x,y,z,(xo+.0005,.0135,.065),.0012,.00425,.0200,.0005))
        d=np.maximum(d,-cyl(x,y,z,(xo,.0135,.065),'x',.0044,.0031+.0005))
        if s>0:
            yb=.0135-np.interp(.098,[0,.04,.11],[.015,.015,.0105])/2
            d=np.maximum(d,-rbox(x,y,z,(s*.07,yb,.098),.0022,.0012,.0052,.0004))
        return d
    return f
def tip_f(s):
    def f(x,y,z): return smax(smax(tprof(x,y,z,s),.112-z,.0004),z-.152,.0015)
    return f
YB=.0135-.0105/2*(1)  # approx underside at z=.098 (see arm_f)
def grille_f(s):
    xo=s*.0729
    def f(x,y,z):
        base=rext(rbox2(z,y,(.065,.0135),.0200,.00425,.0015),x-(xo-.0004),.0003,.0001)
        pitch=.0017;pv=pitch*.866;u=z-.065;v=y-.0135;row=np.round(v/pv);vv=v-row*pv
        uu=u+(row%2)*pitch/2;uu=((uu+pitch/2)%pitch)-pitch/2
        hole=np.hypot(uu,vv)-.00042
        return np.maximum(base,-np.where(np.abs(u)<.0185,hole,1))
    return f
CAM=(0,.0112,-.0062)
parts=[]  # name, role, mat, desc, offset(m), f, lo, hi, h
def P(name,role,mat,desc,off,f,lo,hi,h): parts.append((name,role,mat,desc,off,f,lo,hi,h))
P("Front Frame","frame","gloss_black","Single-piece front frame with rounded wayfarer geometry, thicker brow and integrated hinge end pieces.",(0,0,0),frame_f,(-.0735,-.0235,-.0065),(.0735,.0285,.015),.0005)
for s,n in((-1,"Left"),(1,"Right")):
    P(f"{n} Optical Lens","lens","glass",f"Slightly curved transparent lens held behind the {n.lower()} frame opening; prescription and optical specs are not defined in this concept.",(s*.012,0,.03),lens_f(s),(s*CX-.027,-.0215,-.001),(s*CX+.027,.022,.0055),.0005)
for s,n in((-1,"Left"),(1,"Right")):
    P(f"{n} AR Waveguide","waveguide","waveguide",f"Thin transparent combiner layer intended to guide display imagery into the {n.lower()} eye (illustrative concept).",(s*.014,.004,.058),wg_f(s),(s*.0445-.012,-.004,.0025),(s*.0445+.012,.0115,.0038),.0003)
P("AR Projector Housing","projector","dark_metal","Enclosure for the miniature AR display/projector assembly behind the left brow.",(-.012,.036,.03),lambda x,y,z:rbox(x,y,z,(-.0585,.0175,.0085),.0085,.0025,.004,.0012),(-.068,.014,.004),(-.049,.021,.013),.0003)
P("AR Projector Optical Window","projector","cam_glass","Optical output window of the microdisplay assembly.",(.01,.036,.03),lambda x,y,z:cyl(x,y,z,(-.0493,.0175,.0085),'x',.0017,.0005,.0003),(-.0502,.0155,.0065),(-.0484,.0195,.0105),.0001)
for s,n in((-1,"Left"),(1,"Right")):
    P(f"{n} Silicone Nose Pad","nose_pad","rubber",f"Soft silicone nose-contact pad ({n.lower()}).",(s*.014,-.03,.02),lambda x,y,z,s=s:ell(x,y,z,(s*.0108,-.0075,.0085),.0017,.005,.0035),(s*.0108-.004,-.0135,.004),(s*.0108+.004,-.0015,.0125),.0002)
    P(f"{n} Nose Pad Support","nose_support","metal","Thin metal arm connecting the nose pad to the frame.",(s*.008,-.018,.01),lambda x,y,z,s=s:tube(x,y,z,[(s*.0128,.0,.0032),(s*.0120,-.004,.0072),(s*.0109,-.0065,.0084)],.0006),(s*.0108-.003,-.0075,.003),(s*.0108+.003,0,.009),.0002)
for s,n in((-1,"Left"),(1,"Right")):
    P(f"{n} Temple Arm","temple","gloss_black",f"Tapered {n.lower()} temple housing the battery, control board and speaker.",(s*.034,0,0),arm_f(s),(min(s*.0655,s*.0745),-.0205,.0135),(max(s*.0655,s*.0745),.0235,.1135),.0005)
    P(f"{n} Temple Tip","tip","rubber",f"Soft-touch rear tip that curves behind the {n.lower()} ear.",(s*.034,0,.04),tip_f(s),(min(s*.0655,s*.0745),-.02,.1115),(max(s*.0655,s*.0745),.0145,.1545),.0005)
    P(f"{n} Hinge Barrel","hinge","metal",f"Metal hinge barrel joining the front frame to the {n.lower()} temple.",(s*.022,.036,-.004),lambda x,y,z,s=s:cyl(x,y,z,(s*.07,.0135,.0141),'y',.0019,.0085,.0004),(s*.07-.003,.004,.011),(s*.07+.003,.023,.017),.0002)
    P(f"{n} Hinge Screw","screw","dark_metal","Small retaining screw for the hinge.",(s*.022,.056,-.004),lambda x,y,z,s=s:cyl(x,y,z,(s*.07,.0229,.0141),'y',.0014,.0006,.0003),(s*.07-.002,.021,.012),(s*.07+.002,.0245,.016),.0001)
    P(f"{n} Hinge Return Spring","spring","metal","Coil spring that gives the hinge a soft closing action.",(s*.022,-.034,-.004),lambda x,y,z,s=s:spring(x,y,z,(s*.07,0,.0141),.0075,.008,.001,.0003,5),(s*.07-.0016,.0073,.0125),(s*.07+.0016,.0158,.0157),.0001)
    P(f"{n} Rechargeable Battery Cell","battery","battery",f"Internal rechargeable cell inside the {n.lower()} temple.",(s*.034,-.034,0),lambda x,y,z,s=s:rbox(x,y,z,(s*.0686,.0135,.053),.0012,.0042,.0220,.0008),(min(s*.0674,s*.0698),.0093,.031),(max(s*.0674,s*.0698),.0177,.075),.0005)
    P(f"{n} Speaker Driver","speaker","dark_metal","Illustrative open-ear acoustic driver behind the grille.",(s*.048,0,0),lambda x,y,z,s=s:cyl(x,y,z,(s*.0710,.0135,.065),'x',.0042,.0010,.0003),(min(s*.0698,s*.0722),.0088,.0605),(max(s*.0698,s*.0722),.0182,.0695),.0003)
    P(f"{n} Speaker Grille","grille","dark_metal","Perforated acoustic grille set flush into the outer face of the temple.",(s*.062,0,0),grille_f(s),(min(s*.0722,s*.0732),.0085,.044),(max(s*.0722,s*.0732),.0185,.086),.0002)
P("Left Control PCB","pcb","pcb","Miniature control and power-management board in the left temple.",(-.034,.034,.01),lambda x,y,z:rbox(x,y,z,(-.0686,.0135,.093),.0004,.0035,.014,.0002),(-.0692,.0095,.078),(-.068,.0175,.108),.0003)
P("Left Main Control IC","ic","ic_black","Illustrative controller package mounted on the PCB.",(-.022,.034,.01),lambda x,y,z:rbox(x,y,z,(-.0677,.0135,.093),.0005,.002,.0035,.0002),(-.0684,.0112,.0893),(-.067,.0158,.0967),.00015)
P("Power Button","button","accent","Tactile power / mode button on the top of the left temple.",(-.034,.03,0),lambda x,y,z:rbox(x,y,z,(-.07,.0212,.048),.0016,.001,.0035,.0006),(-.0735,.0192,.043),(-.0665,.0232,.053),.0002)
P("USB-C Port Surround","usb","metal","Metal surround for the USB-C charging port on the underside of the right temple.",(.034,-.03,.01),lambda x,y,z:np.maximum(rbox(x,y,z,(.07,.0135-.0105/2+.0005,.098),.0021,.0006,.0050,.0003),-rbox(x,y,z,(.07,.0135-.0105/2+.0005,.098),.0013,.002,.0036,.0006)),(.0675,.0075,.0925),(.0725,.0095,.1035),.00018)
P("Front Camera Housing","camera","dark_metal","Camera module enclosure for forward-facing sign recognition.",(0,.036,0),lambda x,y,z:np.maximum(rbox(x,y,z,CAM,.005,.0034,.003,.0012),-cyl(x,y,z,(0,CAM[1],-.0087),'z',.0019,.0009)),(-.0055,.0073,-.0098),(.0055,.015,-.0028),.0002)
P("Front Camera Bezel","camera","metal","Metal retaining ring around the camera optics.",(0,.036,-.04),lambda x,y,z:np.maximum(cyl(x,y,z,(0,CAM[1],-.0097),'z',.0026,.0004,.0002),-cyl(x,y,z,(0,CAM[1],-.0097),'z',.0019,.002)),(-.0029,.0083,-.0103),(.0029,.0141,-.0091),.0001)
P("Front Camera Lens Glass","camera","cam_glass","Front optical cover with a dark coated lens element.",(0,.036,-.026),lambda x,y,z:cyl(x,y,z,(0,CAM[1],-.0092),'z',.0019,.0004,.0003),(-.0023,.0089,-.0099),(.0023,.0135,-.0085),.0001)
P("Front Camera Optical Core","camera","core","Illustrative inner optical element of the camera module.",(0,.036,-.012),lambda x,y,z:cyl(x,y,z,(0,CAM[1],-.0082),'z',.0013,.0004,.0002),(-.0017,.0095,-.0089),(.0017,.0129,-.0075),.0001)
# ---------- materials ----------
MAT={"gloss_black":dict(c=(.018,.019,.024,1),m=0,r=.3,cc=(1,.05)),"rubber":dict(c=(.04,.042,.048,1),m=0,r=.85),
"metal":dict(c=(.78,.8,.83,1),m=1,r=.3),"dark_metal":dict(c=(.16,.17,.2,1),m=1,r=.38),
"glass":dict(c=(.45,.68,.92,.16),m=0,r=.03,blend=1),"waveguide":dict(c=(.45,.55,1,.24),m=0,r=.05,blend=1,e=(.03,.05,.14)),
"cam_glass":dict(c=(.01,.014,.03,1),m=.3,r=.05,cc=(1,.03)),"core":dict(c=(.04,.07,.16,1),m=.6,r=.15,e=(.0,.04,.1)),
"pcb":dict(c=(.02,.2,.1,1),m=.1,r=.5),"ic_black":dict(c=(.03,.03,.035,1),m=0,r=.45),
"battery":dict(c=(.62,.64,.68,1),m=.85,r=.45),"accent":dict(c=(.1,.75,.9,1),m=0,r=.35,e=(.0,.15,.2))}
# ---------- GLB writer ----------
def write_glb(path,items,state):
    mats=list(MAT);bin_=bytearray();bv=[];ac=[];meshes=[];nodes=[{"name":"world","children":list(range(1,len(items)+1))}]
    def add(arr,target,**kw):
        while len(bin_)%4:bin_.append(0)
        o=len(bin_);bin_.extend(arr.tobytes());bv.append({"buffer":0,"byteOffset":o,"byteLength":arr.nbytes,"target":target});return len(bv)-1
    for i,(nm,mat,v,n,fc) in enumerate(items):
        a=add(v,34962);b=add(n,34962);c=add(fc.reshape(-1),34963)
        ac+= [{"bufferView":a,"componentType":5126,"count":len(v),"type":"VEC3","min":v.min(0).tolist(),"max":v.max(0).tolist()},
              {"bufferView":b,"componentType":5126,"count":len(n),"type":"VEC3"},
              {"bufferView":c,"componentType":5125,"count":fc.size,"type":"SCALAR"}]
        k=len(ac)-3;meshes.append({"name":nm,"primitives":[{"attributes":{"POSITION":k,"NORMAL":k+1},"indices":k+2,"material":mats.index(mat)}]})
        nodes.append({"name":nm,"mesh":i})
    gm=[]
    for m in mats:
        d=MAT[m];x={"name":m,"pbrMetallicRoughness":{"baseColorFactor":list(d["c"]),"metallicFactor":d["m"],"roughnessFactor":d["r"]},"doubleSided":bool(d.get("blend"))}
        if d.get("blend"): x["alphaMode"]="BLEND"
        if "e" in d: x["emissiveFactor"]=list(d["e"])
        if "cc" in d: x["extensions"]={"KHR_materials_clearcoat":{"clearcoatFactor":d["cc"][0],"clearcoatRoughnessFactor":d["cc"][1]}}
        gm.append(x)
    j={"asset":{"version":"2.0","generator":"SIGNLINK v5 sample SDF builder"},"extensionsUsed":["KHR_materials_clearcoat"],"scene":0,
       "scenes":[{"nodes":[0],"extras":{"units":"meters","state":state}}],"nodes":nodes,"meshes":meshes,"materials":gm,"accessors":ac,"bufferViews":bv,"buffers":[{"byteLength":len(bin_)}]}
    js=json.dumps(j,separators=(',',':')).encode();js+=b' '*(-len(js)%4);bin_.extend(b'\0'*(-len(bin_)%4))
    with open(path,'wb') as f:
        f.write(struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(bin_)));f.write(struct.pack('<II',len(js),0x4E4F534A));f.write(js);f.write(struct.pack('<II',len(bin_),0x004E4942));f.write(bin_)
if __name__=="__main__":
    os.makedirs(OUT+'/models',exist_ok=True);os.makedirs(OUT+'/reference',exist_ok=True)
    built=[]
    for i,(nm,role,mat,desc,off,f,lo,hi,h) in enumerate(parts,1):
        v,n,fc=build(f,lo,hi,h);built.append((f"{i:02d} | {nm}",mat,v,n,fc));print(i,nm,len(v),'verts',flush=True)
    write_glb(OUT+'/models/SIGNLINK_Connect_v5_Sample_Assembled.glb',built,'assembled')
    ex=[(nm,mat,(v+np.array(parts[i][4],F)).astype(F),n,fc) for i,(nm,mat,v,n,fc) in enumerate(built)]
    write_glb(OUT+'/models/SIGNLINK_Connect_v5_Sample_Exploded.glb',ex,'exploded')
    man={"units":"meters","authoring_units":"meters","products":{"Connect":{p[0]:{"componentId":f"{i:02d}","role":p[1],"material":p[2],"explodedOffsetMeters":list(p[4]),"description":p[3]} for i,p in enumerate(parts,1)}}}
    json.dump(man,open(OUT+'/reference/threejs_explode_manifest.json','w'),indent=1)
    print('done',len(parts),'parts')
