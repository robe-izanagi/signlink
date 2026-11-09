"""SIGNLINK v5 - redesigned (smooth SDF-sculpted, modern wayfarer AI/AR glasses) using the EXACT v4 component catalog.
Every v4 component (id, name, role, category, material, description) is kept; only geometry is redesigned.
Units: metres. Front faces -Z, temples +Z, +Y up, Left = -X.   Usage: python3 build_signlink_v5.py <v4_reference_dir> <out_dir>"""
import numpy as np, json, os, sys, struct, re
from build_sample import smin,smax,rext,rbox,rbox2,cyl,ell,tube,seg2,build
F=np.float32
V4=sys.argv[1];OUT=sys.argv[2]
CX,A,BT,BB,N=.0405,.0245,.0185,.0165,2.7
def se(x,y,cx,cy,a,bt,bb,h,n=N,taper=.07):
    xs=x-cx;ys=y-cy;b=np.where(ys>0,bt,bb);ae=a*(1-taper*np.clip(-ys/bb,0,1))
    q=((np.abs(xs)/ae)**n+(np.abs(ys)/b)**n+1e-12)**(1/n)
    g=np.maximum(np.hypot(np.gradient(q,h,axis=0),np.gradient(q,h,axis=1)),.25/max(a,bt))
    return np.maximum((q-1)/g,-.02)
def Fframe(h):
    def f(x,y,z):
        o=lambda c:se(x,y,c,0,A+.0052,BT+.0046,BB+.0043,h)
        d=smin(o(-CX),o(CX),.003);d=smin(d,seg2(x,y,(-.011,.0145),(.011,.0145),.0055),.004)
        d=smin(d,rbox2(x,y,(0,.0225),.0685,.0035,.003),.003)
        d=np.maximum(d,-np.minimum(se(x,y,-CX,0,A,BT,BB,h),se(x,y,CX,0,A,BT,BB,h)))
        d=rext(d,z,.0045,.0018)
        for s in(-1,1): d=smin(d,rbox(x,y,z,(s*.0695,.0135,.0062),.003,.0092,.0074,.002),.0025)
        return d
    return f
def top(z): return float(.0135+np.interp(z,[0,.04,.11,.152],[.015,.015,.0105,.0085])/2)
def bot(z): return float(.0135-np.interp(z,[0,.04,.11,.152],[.015,.015,.0105,.0085])/2)
def xo(s,u=0): return s*(.0729+u)
def tprof(x,y,z,s):
    xc=s*.07;w=np.interp(z,[0,.10,.152],[.0058,.0058,.0040]);hh=np.interp(z,[0,.04,.11,.152],[.015,.015,.0105,.0085])
    yc=.0135-10*np.maximum(z-.108,0)**2;r=np.minimum(.0025,w/2*.95)
    qx=np.abs(x-xc)-w/2+r;qy=np.abs(y-yc)-hh/2+r
    return np.hypot(np.maximum(qx,0),np.maximum(qy,0))+np.minimum(np.maximum(qx,qy),0)-r
MICZ=[.020,.028,.036]
def shell_f(s,cut=False):
    def f(x,y,z):
        d=smax(tprof(x,y,z,s),z-.112,.0006);d=smax(d,.0145-z,.001)
        d=np.maximum(d,-rbox(x,y,z,(xo(s,-.0003),.0135,.065),.0013,.00425,.0200,.0005))       # speaker recess (outer)
        for zz in MICZ: d=np.maximum(d,-cyl(x,y,z,(xo(s,.0001),.0135,zz),'x',.0007,.0009))      # mic holes
        d=np.maximum(d,-rbox(x,y,z,(s*.0673,.0135,.069),.0006,.0042,.0390,.0004))              # service-cover recess (inner)
        if s>0: d=np.maximum(d,-rbox(x,y,z,(s*.07,bot(.098)+.001,.098),.0022,.0021,.0052,.0004)) # USB-C pocket
        if cut: d=np.maximum(d,-rbox(x,y,z,(s*.07,.0230,.0885),.006,.0090,.0230,.0003))         # cutaway window
        return d
    return f
def tip_f(s): return lambda x,y,z:smax(smax(tprof(x,y,z,s),.112-z,.0004),z-.152,.0015)
def lens_f(s,h):
    cx=s*CX
    def f(x,y,z):
        zc=.0012+2.5*((x-cx)**2+y**2);return rext(se(x,y,cx,0,A+.0014,BT+.0014,BB+.0014,h),z-zc,.0009,.0007)
    return f
def bezel_f(s,h):
    cx=s*CX
    def f(x,y,z):
        d=np.maximum(se(x,y,cx,0,A+.0022,BT+.0022,BB+.0022,h),-se(x,y,cx,0,A-.0004,BT-.0004,BB-.0004,h));return rext(d,z-.0050,.00035,.0002)
    return f
def grille_f(s):
    def f(x,y,z):
        base=rext(rbox2(z,y,(.065,.0135),.0200,.00425,.0015),x-xo(s,-.00028),.00033,.0001)
        pitch=.0017;pv=pitch*.866;u=z-.065;v=y-.0135;row=np.round(v/pv);vv=v-row*pv
        uu=u+(row%2)*pitch/2;uu=((uu+pitch/2)%pitch)-pitch/2
        return np.maximum(base,-np.where(np.abs(u)<.0185,np.hypot(uu,vv)-.00042,1))
    return f
# ---- spec helpers: (f,lo,hi,h) ----
def cuboid(c,hs):
    c=np.array(c,F);hs=np.array(hs,F);V=[];Nn=[];Fc=[]
    for ax in range(3):
        for sg in(-1,1):
            u,w=[k for k in range(3) if k!=ax];base=len(V)
            for a,b in((-1,-1),(1,-1),(1,1),(-1,1)):
                p=c.copy();p[ax]+=sg*hs[ax];p[u]+=a*hs[u];p[w]+=b*hs[w];V.append(p);nn=np.zeros(3,F);nn[ax]=sg;Nn.append(nn)
            Fc+=([[base,base+1,base+2],[base,base+2,base+3]] if sg>0 else [[base,base+2,base+1],[base,base+3,base+2]])
    v=np.array(V,F);fc=np.array(Fc,np.uint32)
    t=v[fc];fn=np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]);nm=np.array(Nn,F)[fc].mean(1)
    flip=(fn*nm).sum(1)<0;fc[flip]=fc[flip][:,::-1];return v,np.array(Nn,F),fc
def box(c,hs,r=None,h=None):
    if min(hs)<.0007: return ('mesh',)+cuboid(c,hs)
    r=min(hs)*.4 if r is None else r;hh=h or float(np.clip(min(hs)*2/5,.00006,.0006))
    return (lambda x,y,z:rbox(x,y,z,c,hs[0],hs[1],hs[2],r)),[c[i]-hs[i] for i in range(3)],[c[i]+hs[i] for i in range(3)],hh
def cy(c,ax,r,hh,rd=None,h=None):
    rd=min(r,hh)*.4 if rd is None else rd;res=h or float(np.clip(min(r,hh)*2/5,.00006,.0006));i='xyz'.index(ax)
    lo=[c[k]-r for k in range(3)];hi=[c[k]+r for k in range(3)];lo[i]=c[i]-hh;hi[i]=c[i]+hh
    return (lambda x,y,z:cyl(x,y,z,c,ax,r,hh,rd)),lo,hi,res
def ring(c,ax,ro,ri,hh,rd=.00015,h=.00012):
    i='xyz'.index(ax);lo=[c[k]-ro for k in range(3)];hi=[c[k]+ro for k in range(3)];lo[i]=c[i]-hh;hi[i]=c[i]+hh
    return (lambda x,y,z:np.maximum(cyl(x,y,z,c,ax,ro,hh,rd),-cyl(x,y,z,c,ax,ri,hh*4))),lo,hi,h
def slot_box(c,hs,hole,r,h):  # rounded box minus a rounded-box hole through y
    f=lambda x,y,z:np.maximum(rbox(x,y,z,c,hs[0],hs[1],hs[2],r),-rbox(x,y,z,c,hole[0],hole[1]+.01,hole[2],.0005))
    return f,[c[i]-hs[i] for i in range(3)],[c[i]+hs[i] for i in range(3)],h
PODY=.0158;F0=-.0092
CAMX={'RGB':(-.0085,1.0),'Spatial':(.0085,.85),'Left Stereo':(-.0100,.95),'Right Stereo':(.0100,.95)}
def camkey(name):
    for k in CAMX:
        if k in name: return k
def pod_f(prod):
    def f(x,y,z):
        d=rbox(x,y,z,(0,PODY,-.0062),.0145,.0050,.0030,.0020)
        for cx,k in ([CAMX['RGB'],CAMX['Spatial']] if prod!='Vision' else [CAMX['Left Stereo'],CAMX['Right Stereo']]):
            d=np.maximum(d,-cyl(x,y,z,(cx,PODY,-.0085),'z',.0021*k,.0010))
        return d
    return f
def spec(prod,p,cut=False):
    n=p['name'];r=p['role'];s=p['side'];m=re.search(r'(\d+)$',n);i=int(m.group(1)) if m else 0;key=None
    yc=.0135;xc=s*.07
    if r=='front_rim':
        h=.0006;Fr=Fframe(h);g=(lambda x,y,z:smax(Fr(x,y,z),(x if s<0 else -x)+.0080,.0004))
        return g,(-.0735 if s<0 else .0075,-.0235,-.0065),(-.0075 if s<0 else .0735,.0285,.0150),h,'rim%d'%s
    if r=='bridge':
        h=.0006;Fr=Fframe(h);return (lambda x,y,z:smax(Fr(x,y,z),np.abs(x)-.0076,.0004)),(-.0085,-.0235,-.0065),(.0085,.0285,.0150),h,'bridge'
    if r=='lens': return lens_f(s,.0006),(s*CX-.027,-.0215,-.001),(s*CX+.027,.022,.0055),.0006,'lens%d'%s
    if r=='lens_bezel': return bezel_f(s,.0004),(s*CX-.0285,-.0215,.0040),(s*CX+.0285,.0225,.0060),.0004,'bez%d'%s
    if r=='nose_pad': return (lambda x,y,z:ell(x,y,z,(s*.0108,-.0075,.0085),.0017,.005,.0035)),(s*.0108-.004,-.0135,.004),(s*.0108+.004,-.0015,.0125),.0002,'pad%d'%s
    if r=='nose_arm': return (lambda x,y,z:tube(x,y,z,[(s*.0128,0,.0032),(s*.012,-.004,.0072),(s*.0109,-.0065,.0084)],.0006)),(s*.0109-.003,-.0075,.003),(s*.0128+.003,.0008,.009),.0002,'arm%d'%s
    if r=='camera_pod': return pod_f(prod),(-.016,.0095,-.0105),(.016,.0222,-.0020),.0004,'pod'+prod
    if r=='camera_mount': return box((0,.0108,-.0040),(.008,.0018,.0012))+(None,)
    if r=='trim': return box((0,.0239,-.0045),(.0585,.0004,.0003),r=.0002,h=.00015)+(None,)
    if r in('camera_bezel','camera_cover','camera_lens','camera_iris'):
        cx,k=CAMX[camkey(n)]
        if r=='camera_bezel': return ring((cx,PODY,F0-.0004),'z',.0029*k,.0021*k,.0004)+(None,)
        if r=='camera_cover': return cy((cx,PODY,F0+.0001),'z',.0020*k,.0003,h=.00012)+(None,)
        if r=='camera_lens': return cy((cx,PODY,F0+.0007),'z',.0016*k,.00025,h=.0001)+(None,)
        return cy((cx,PODY,F0+.0010),'z',.0008*k,.0002,h=.00008)+(None,)
    if r=='stereo_bezel':
        cx,k=CAMX[camkey(n)];return ring((cx,PODY,F0-.0004),'z',.0029*k,.0021*k,.0004)+(None,)
    if r=='stereo_lens':
        cx,k=CAMX[camkey(n)];return cy((cx,PODY,F0+.0003),'z',.0019*k,.0006,h=.00012)+(None,)
    if r=='tof_housing': return box((0,PODY,-.0090),(.0030,.0024,.0012),r=.0008)+(None,)
    if r=='tof_window': return box((0,PODY,-.0104),(.0026,.0020,.0002),r=.0001,h=.0001)+(None,)
    if r=='status_led':
        if 'Front' in n: return cy((.0235,.0224,-.0046),'z',.0007,.0002,h=.00008)+(None,)
        z=.032;return cy((xc,top(z)+.0001,z),'y',.0007,.0004,h=.00009)+(None,)
    if r in('aux_sensor','ambient_sensor'): return box((-.0235,.0224,-.0046),(.0025,.0012,.0002),r=.0002,h=.0001)+(None,)
    if r=='microphone':
        if 'Front' in n: return cy((s*.0385,.0224,-.0046),'z',.0007,.0002,h=.00008)+(None,)
        return cy((xo(s,.0001-.0002),yc,MICZ[i-1]),'x',.0006,.00025,h=.00008)+(None,)
    if r=='brand_detail': return box((s*.0505,.0224,-.0046),(.0040,.0010,.0002),r=.0002,h=.0001)+(None,)
    if r=='brand_mark': return box((xo(1,-.0001),.0120,.100),(.0003,.0010,.0040),r=.0002,h=.0001)+(None,)
    if r=='hinge_plate': return box((xo(s,-.0002),yc,.0140),(.0005,.0065,.0050),r=.0003,h=.00018)+(None,)
    if r=='hinge_barrel': return cy((xc,yc,.0141),'y',.0019,.0085,rd=.0004,h=.0002)+(None,)
    if r=='screw':
        if 'Hinge' in n: return cy((xo(s,.0007),yc,[.0110,.0170][i-1]),'x',.0010,.0003,h=.0001)+(None,)
        z=[.0215,.082][i-1];return cy((xc,bot(z)-.0001,z),'y',.0009,.0004,h=.0001)+(None,)
    if r=='temple_shell': return shell_f(s,cut),(min(s*.0655,s*.0745),-.0205,.0135),(max(s*.0655,s*.0745),.0235,.1135),.0006,('shell%d%d'%(s,cut))
    if r=='ear_tip': return tip_f(s),(min(s*.0655,s*.0745),-.02,.1115),(max(s*.0655,s*.0745),.0145,.1545),.0005,'tip%d'%s
    if r=='chassis': return box((xc,.0120,.070),(.0006,.0006,.036),r=.0003,h=.00018)+(None,)
    if r=='service_cover': return box((s*.0675,yc,.069),(.0004,.0041,.0385),r=.0004,h=.00014)+(None,)
    if r=='pcb': return box((s*.0686,yc,.0975),(.0004,.0035,.0125),r=.0002,h=.00012)+(None,)
    if r=='pcb_contact': z=.0865+(i-1)*.0045;return box((s*.0690,.0100,z),(.0003,.0004,.0012),r=.0002,h=.0001)+(None,)
    if r=='processor': return box((s*.0679,.0138,.0900),(.0003,.0020,.0028),r=.00025,h=.0001)+(None,)
    if r=='pmic': return box((s*.0679,.0150,.0955),(.0003,.0012,.0012),r=.00025,h=.0001)+(None,)
    if r=='rf_module': return box((s*.0679,.0132,.1035),(.0003,.0020,.0030),r=.00025,h=.0001)+(None,)
    if r=='rf_shield': return box((s*.0675,.0132,.1035),(.0004,.0021,.0031),r=.0003,h=.0001)+(None,)
    if r=='battery': return box((s*.0686,yc,.0530),(.0012,.0042,.0220),r=.0008,h=.0004)+(None,)
    if r=='battery_tab': return box((s*.0686,yc,.0757),(.0005,.0020,.0006),r=.0002,h=.0001)+(None,)
    if r=='flex_cable': return box((s*.0680,.0142,.0806),(.00015,.0030,.0044),r=.0001,h=.00008)+(None,)
    if r=='speaker': return cy((xo(s,-.0009),yc,.065),'x',.0042,.0005,rd=.0002,h=.0002)+(None,)
    if r=='speaker_grille': return grille_f(s),(min(xo(s,-.0008),xo(s,.0002)),.0085,.044),(max(xo(s,-.0008),xo(s,.0002)),.0185,.086),.0003,'grille%d'%s
    if r=='button':
        z=[.046,.060][i-1];return box((xc,top(z)+.0002,z),(.0016,.0009,.0030),r=.0006,h=.0002)+(None,)
    if r=='usb_bezel': return slot_box((.07,bot(.098)+.0003,.098),(.0021,.0006,.0050),(.0015,.0006,.0038),.0003,.00012)+(None,)
    if r=='usb_inner_shell': return slot_box((.07,bot(.098)+.0013,.098),(.0014,.0008,.0036),(.0011,.0008,.0028),.0003,.0001)+(None,)
    if r=='usb_receptacle': return box((.07,bot(.098)+.0021,.098),(.0011,.0007,.0028),r=.0003,h=.0001)+(None,)
    if r=='usb_tongue': return box((.07,bot(.098)+.0012,.098),(.0007,.0002,.0022),r=.0001,h=.00008)+(None,)
    if r=='waveguide': return (lambda x,y,z:rext(rbox2(x,y,(s*.0445,.004),.0105,.0068,.0015),z-.0031,.00035,.0002)),(s*.0445-.012,-.004,.0025),(s*.0445+.012,.0115,.0038),.0003,'wg%d'%s
    if r=='optical_engine': return box((s*.0585,.0175,.0085),(.0085,.0025,.004),r=.0012,h=.0003)+(None,)
    if r=='microdisplay': return box((s*.0496,.0175,.0085),(.0006,.0014,.0020),r=.0003,h=.0001)+(None,)
    if r=='optical_coupler': return box((s*.0535,.0100,.0031),(.0014,.0012,.0007),r=.0004,h=.0001)+(None,)
    if r=='hand_camera': return (lambda x,y,z:np.maximum(rbox(x,y,z,(0,.0068,-.0008),.0036,.0024,.0032,.0012),-cyl(x,y,z,(0,.0051,-.0008),'y',.0019,.0007))),(-.0040,.004,-.0042),(.0040,.0096,.0026),.0002,'hand'
    if r=='hand_camera_bezel': return ring((0,.0040,-.0008),'y',.0026,.0019,.0004)+(None,)
    if r=='hand_camera_lens': return cy((0,.0045,-.0008),'y',.0019,.0003,h=.00012)+(None,)
    if r=='haptic_motor': return cy((s*.0710,yc,.1005),'z',.0016,.0045,rd=.0006,h=.0002)+(None,)
    if r=='imu': return box((s*.0679,yc,.0230),(.0003,.0014,.0014),r=.0002,h=.0001)+(None,)
    raise KeyError((prod,n,r))
def off(p):
    n=p['name'];r=p['role'];s=p['side'];m=re.search(r'(\d+)$',n);i=int(m.group(1)) if m else 0
    cam=camkey(n);cx=(CAMX[cam][0]*1.6) if cam else 0
    T={'front_rim':(s*.016,0,-.004),'lens_bezel':(s*.016,0,.014),'lens':(s*.016,0,.034),'waveguide':(s*.016,.004,.056),'optical_coupler':(s*.030,.012,.056),
    'optical_engine':(s*.014,.036,.030),'microdisplay':(0,.036,.030),'bridge':(0,-.006,0),'nose_arm':(s*.014,-.016,.012),'nose_pad':(s*.016,-.030,.022),
    'camera_pod':(0,.034,-.010),'camera_mount':(0,.020,-.004),'trim':(0,.046,-.006),
    'camera_bezel':(cx,.034,-.046),'camera_cover':(cx,.034,-.034),'camera_lens':(cx,.034,-.022),'camera_iris':(cx,.034,-.014),
    'stereo_bezel':(cx,.034,-.046),'stereo_lens':(cx,.034,-.026),'tof_housing':(0,.052,-.012),'tof_window':(0,.052,-.030),
    'hand_camera':(0,-.030,0),'hand_camera_lens':(0,-.040,0),'hand_camera_bezel':(0,-.052,0),
    'aux_sensor':(0,.046,-.020),'ambient_sensor':(0,.046,-.020),'brand_detail':(s*.006,.052,-.014),'brand_mark':(.092,0,0),
    'hinge_plate':(s*.046,0,0),'hinge_barrel':(s*.022,.036,-.004),'temple_shell':(s*.034,0,0),'chassis':(s*.034,-.046,0),'service_cover':(s*.014,0,0),
    'ear_tip':(s*.034,0,.040),'pcb':(s*.034,.034,.010),'pcb_contact':(s*.034,.046,.010),'processor':(s*.022,.046,.010),'pmic':(s*.022,.040,.010),
    'rf_module':(s*.022,.052,.010),'rf_shield':(s*.012,.060,.010),'battery':(s*.034,-.034,0),'battery_tab':(s*.034,-.034,.014),'flex_cable':(s*.034,-.046,.008),
    'speaker':(s*.058,0,0),'speaker_grille':(s*.072,0,0),'button':(s*.034,.030,0),'usb_bezel':(.034,-.044,.010),'usb_inner_shell':(.034,-.056,.010),
    'usb_receptacle':(.034,-.068,.010),'usb_tongue':(.034,-.080,.010),'haptic_motor':(-.034,-.034,0),'imu':(-.022,-.046,-.012)}
    if r=='status_led': return (0,.046,-.020) if 'Front' in n else (s*.034,.042,0)
    if r=='microphone': return (0,.040,-.024) if 'Front' in n else (s*.050,0,-.010)
    if r=='screw': return (s*.062,0,0) if 'Hinge' in n else (.034,-.050,0)
    return T[r]
# ---- materials ----
def M(c,m=0,r=.5,e=None,blend=0,cc=None): return dict(c=c,m=m,r=r,e=e,blend=blend,cc=cc)
MAT={'piano_black':M((.012,.012,.016,1),0,.22,cc=(1,.03)),'black_acetate':M((.02,.02,.025,1),0,.3,cc=(1,.08)),'satin_black':M((.03,.03,.035,1),0,.5,cc=(.3,.2)),
'gunmetal':M((.18,.19,.22,1),1,.35),'steel_dark':M((.1,.105,.12,1),1,.4),'titanium':M((.6,.6,.62,1),1,.3),'silver':M((.8,.82,.85,1),1,.25),
'soft_touch':M((.04,.04,.045,1),0,.85),'rubber':M((.04,.04,.045,1),0,.85),'clear_lens':M((.45,.68,.92,.16),0,.03,blend=1),'optical_glass':M((.45,.68,.92,.16),0,.03,blend=1),
'waveguide':M((.45,.55,1,.24),0,.05,e=(.03,.05,.14),blend=1),'camera_glass':M((.01,.014,.03,1),.3,.05,cc=(1,.03)),'camera_coating':M((.03,.015,.06,1),.5,.1,cc=(1,.05)),
'camera_blue':M((.05,.1,.3,1),.4,.1,e=(0,.03,.08)),'chip':M((.03,.03,.035,1),0,.4),'pcb':M((.02,.2,.1,1),.1,.5),'pcb_gold':M((.9,.7,.25,1),1,.3),
'battery':M((.6,.62,.66,1),.85,.45),'battery_foil':M((.7,.72,.75,1),.9,.3),'amber_accent':M((1,.6,.12,1),0,.35,e=(.3,.15,0)),'blue_accent':M((.2,.45,1,1),0,.35,e=(.05,.1,.3)),
'teal_accent':M((.08,.85,.8,1),0,.35,e=(0,.15,.15)),'led_amber':M((1,.6,.1,1),0,.3,e=(1,.55,.05)),'led_blue':M((.2,.5,1,1),0,.3,e=(.2,.5,1)),'led_teal':M((.1,.9,.85,1),0,.3,e=(.1,.9,.85)),
'white_mark':M((.92,.93,.95,1),0,.4)}
def write_glb(path,items,state):
    mats=sorted({it[1] for it in items});bin_=bytearray();bv=[];ac=[];meshes=[];nodes=[{"name":"world","children":list(range(1,len(items)+1))}]
    def add(arr,tg):
        while len(bin_)%4:bin_.append(0)
        o=len(bin_);bin_.extend(arr.tobytes());bv.append({"buffer":0,"byteOffset":o,"byteLength":arr.nbytes,"target":tg});return len(bv)-1
    for i,(nm,mat,v,n,fc) in enumerate(items):
        a=add(v,34962);b=add(n,34962);c=add(fc.reshape(-1),34963)
        ac+=[{"bufferView":a,"componentType":5126,"count":len(v),"type":"VEC3","min":v.min(0).tolist(),"max":v.max(0).tolist()},{"bufferView":b,"componentType":5126,"count":len(n),"type":"VEC3"},{"bufferView":c,"componentType":5125,"count":int(fc.size),"type":"SCALAR"}]
        k=len(ac)-3;meshes.append({"name":nm,"primitives":[{"attributes":{"POSITION":k,"NORMAL":k+1},"indices":k+2,"material":mats.index(mat)}]});nodes.append({"name":nm,"mesh":i})
    gm=[]
    for m in mats:
        d=MAT[m];x={"name":m,"pbrMetallicRoughness":{"baseColorFactor":list(d['c']),"metallicFactor":d['m'],"roughnessFactor":d['r']},"doubleSided":bool(d['blend'])}
        if d['blend']:x["alphaMode"]="BLEND"
        if d['e']:x["emissiveFactor"]=list(d['e'])
        if d['cc']:x["extensions"]={"KHR_materials_clearcoat":{"clearcoatFactor":d['cc'][0],"clearcoatRoughnessFactor":d['cc'][1]}}
        gm.append(x)
    j={"asset":{"version":"2.0","generator":"SIGNLINK v5 SDF builder"},"extensionsUsed":["KHR_materials_clearcoat"],"scene":0,"scenes":[{"nodes":[0],"extras":{"units":"meters","state":state}}],"nodes":nodes,"meshes":meshes,"materials":gm,"accessors":ac,"bufferViews":bv,"buffers":[{"byteLength":len(bin_)}]}
    js=json.dumps(j,separators=(',',':')).encode();js+=b' '*(-len(js)%4);bin_.extend(b'\0'*(-len(bin_)%4))
    with open(path,'wb') as f:
        f.write(struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(bin_)));f.write(struct.pack('<II',len(js),0x4E4F534A));f.write(js);f.write(struct.pack('<II',len(bin_),0x004E4942));f.write(bin_)
def slug(s): return re.sub(r'[^a-z0-9]+','_',s.lower()).strip('_')
def location(p,c):
    s={-1:'left',1:'right',0:''}[p['side']] if c[0]*0==0 else ''
    side='left' if c[0]<-.0095 else 'right' if c[0]>.0095 else 'centre'
    if c[2]>.0140: return f"{side.capitalize()} temple (side arm)"
    if c[1]<.008 and abs(c[0])<.02: return "Underside of the nose bridge"
    return "Front frame, "+("centre / nose bridge" if side=='centre' else side+" side")
cache={};LOG=open(OUT+'/build.log','a')
def mesh_for(prod,p,cut=False):
    sp=spec(prod,p,cut)
    if sp[0]=='mesh': return sp[1:4]
    key=sp[4] if len(sp)==5 else None
    if key and key in cache:return cache[key]
    f,lo,hi,h=sp[:4];r=build(f,lo,hi,h)
    if key:cache[key]=r
    return r
if __name__=="__main__":
    for d in('models','reference','part_assets/glb','previews'):os.makedirs(f'{OUT}/{d}',exist_ok=True)
    allc={};manifest={"version":"5.0","units":"meters","authoringUnits":"meters","designDirection":"Modern, smooth, premium wayfarer-style AI/AR smart glasses family (SDF-sculpted). Component catalog kept identical to v4.","products":{}}
    for prod in('Smart','Connect','Vision'):
        parts=json.load(open(f'{V4}/reference/SIGNLINK_{prod}_parts.json'));os.makedirs(f'{OUT}/part_assets/glb/{prod}',exist_ok=True)
        built=[];builtc=[];cat=[]
        for p in parts:
            v,n,fc=mesh_for(prod,p);nm=f"{p['id']} | {p['name']}";built.append((nm,p['material'],v,n,fc));o=np.array(off(p),F)
            if p['role']=='temple_shell':
                vc,nc,fcc=mesh_for(prod,p,True);builtc.append((nm,p['material'],vc,nc,fcc))
            else: builtc.append(built[-1])
            c=(v.min(0)+v.max(0))/2;ctr=c.copy()
            gp=f"part_assets/glb/{prod}/{p['id']}_{slug(p['name'])}.glb";write_glb(f'{OUT}/{gp}',[(nm,p['material'],(v-ctr).astype(F),n,fc)],'part')
            q=dict(p);q.update(explodedOffsetMeters=[round(float(a),4) for a in o],individualGlb=gp,image=f"part_assets/images/{prod}/{p['id']}_{slug(p['name'])}.png",vertexCount=int(len(v)),faceCount=int(len(fc)),location=location(p,c))
            cat.append(q);print(prod,p['id'],p['name'],len(v),file=LOG,flush=True)
        write_glb(f'{OUT}/models/SIGNLINK_{prod}_Assembled.glb',built,'assembled')
        write_glb(f'{OUT}/models/SIGNLINK_{prod}_Cutaway.glb',builtc,'cutaway')
        ex=[(nm,mat,(v+np.array(c['explodedOffsetMeters'],F)).astype(F),n,fc) for (nm,mat,v,n,fc),c in zip(built,cat)]
        write_glb(f'{OUT}/models/SIGNLINK_{prod}_Exploded.glb',ex,'exploded')
        json.dump(cat,open(f'{OUT}/reference/SIGNLINK_{prod}_parts.json','w'),indent=1);allc[prod]=cat
        meta=json.load(open(f'{V4}/reference/threejs_explode_manifest.json'))['products'][prod]
        manifest['products'][prod]={"title":meta['title'],"assembledModel":f"models/SIGNLINK_{prod}_Assembled.glb","explodedModel":f"models/SIGNLINK_{prod}_Exploded.glb","cutawayModel":f"models/SIGNLINK_{prod}_Cutaway.glb","componentCount":len(cat),
          "parts":{c['name']:{k:c[k] for k in('id','role','category','material','side','explodedOffsetMeters','description','individualGlb','image','location')} for c in cat}}
        print('done',prod,len(cat),flush=True)
    json.dump(manifest,open(f'{OUT}/reference/threejs_explode_manifest.json','w'),indent=1);json.dump(allc,open(f'{OUT}/reference/all_components.json','w'),indent=1)
    print('ALL DONE')
