#!/usr/bin/env python3
"""Build separated SIGNLINK concept models and exploded GLB states.

All model dimensions are authored in millimetres and exported in metres (glTF convention).
The assets are conceptual product models, not manufacturing-ready CAD or validated optical/electrical designs.
"""
from __future__ import annotations
import os, json, math, zipfile, shutil
from dataclasses import dataclass
from pathlib import Path
import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial

ROOT = Path(__file__).resolve().parents[1]
MODELS = ROOT / 'models'
REF = ROOT / 'reference'
PREV = ROOT / 'previews'
for p in [MODELS, REF, PREV]: p.mkdir(parents=True, exist_ok=True)

# Palette: [R,G,B,A] in normalized glTF color space.
PALETTES = {
    'graphite': [0.12, 0.15, 0.19, 1.0],
    'black': [0.075, 0.09, 0.12, 1.0],
    'rubber': [0.045, 0.052, 0.064, 1.0],
    'titanium': [0.42, 0.48, 0.56, 1.0],
    'silver': [0.66, 0.72, 0.78, 1.0],
    'lens': [0.42, 0.60, 0.76, 0.48],
    'lens_cyan': [0.17, 0.64, 0.76, 0.44],
    'lens_smoke': [0.28, 0.38, 0.50, 0.46],
    'cyan': [0.04, 0.68, 0.88, 1.0],
    'cyan_dark': [0.02, 0.24, 0.34, 1.0],
    'amber': [0.96, 0.48, 0.12, 1.0],
    'amber_dark': [0.36, 0.15, 0.035, 1.0],
    'pcb': [0.035, 0.20, 0.12, 1.0],
    'battery': [0.52, 0.56, 0.61, 1.0],
    'black_glass': [0.006, 0.012, 0.020, 1.0],
    'white': [0.86, 0.90, 0.94, 1.0],
}

MATERIALS: dict[str, PBRMaterial] = {}
def material(key: str) -> PBRMaterial:
    if key in MATERIALS: return MATERIALS[key]
    color = PALETTES[key]
    is_trans = color[3] < 0.99
    mat = PBRMaterial(
        name=key,
        baseColorFactor=np.array(color, dtype=float),
        metallicFactor=0.78 if key in ('titanium','silver') else (0.32 if key in ('graphite','black','cyan_dark','amber_dark') else 0.08),
        roughnessFactor=0.22 if key in ('titanium','silver','black_glass') else (0.16 if key.startswith('lens') else 0.34),
        alphaMode='BLEND' if is_trans else 'OPAQUE',
        doubleSided=True,
    )
    MATERIALS[key] = mat
    return mat

@dataclass
class Part:
    name: str
    description: str
    role: str
    mesh: trimesh.Trimesh
    explode: tuple[float,float,float]
    material_key: str


def set_mat(mesh: trimesh.Trimesh, key: str) -> trimesh.Trimesh:
    mesh.visual = trimesh.visual.TextureVisuals(material=material(key))
    mesh.metadata['material_key'] = key
    return mesh


def rounded_outline(w: float, h: float, r: float, steps: int = 12) -> np.ndarray:
    """CCW rounded rectangle outline in XY, same vertex count for all dimensions."""
    r = max(0.05, min(r, w*0.49, h*0.49))
    corners = [
        (w/2-r, h/2-r, 0, 90),
        (-w/2+r, h/2-r, 90, 180),
        (-w/2+r, -h/2+r, 180, 270),
        (w/2-r, -h/2+r, 270, 360),
    ]
    pts=[]
    for cx,cy,a0,a1 in corners:
        for a in np.linspace(a0,a1,steps+1):
            rad=math.radians(a)
            pts.append([cx+r*math.cos(rad), cy+r*math.sin(rad)])
    return np.asarray(pts, dtype=float)


def ring_mesh(cx, cy, zc, w, h, radius, rim, depth, key) -> trimesh.Trimesh:
    outer=rounded_outline(w,h,radius)
    inner=rounded_outline(w-2*rim,h-2*rim,max(1.0,radius-rim*0.65))
    n=len(outer); z0=zc-depth/2; z1=zc+depth/2
    verts=[]
    for loop,z in [(outer,z0),(inner,z0),(outer,z1),(inner,z1)]:
        arr=loop.copy(); arr[:,0]+=cx; arr[:,1]+=cy
        verts.extend([[x,y,z] for x,y in arr])
    faces=[]
    ob,ib,ot,it=0,n,2*n,3*n
    for i in range(n):
        j=(i+1)%n
        # top and bottom ring surfaces
        faces += [[ot+i,ot+j,it+j],[ot+i,it+j,it+i]]
        faces += [[ob+i,ib+j,ob+j],[ob+i,ib+i,ib+j]]
        # outer and inner side walls
        faces += [[ob+i,ob+j,ot+j],[ob+i,ot+j,ot+i]]
        faces += [[ib+i,it+j,ib+j],[ib+i,it+i,it+j]]
    m=trimesh.Trimesh(vertices=np.asarray(verts),faces=np.asarray(faces),process=True)
    m.fix_normals(); set_mat(m,key); return m


def rounded_plate(cx, cy, zc, w, h, radius, depth, key) -> trimesh.Trimesh:
    loop=rounded_outline(w,h,radius)
    n=len(loop); z0=zc-depth/2; z1=zc+depth/2
    verts=[]
    verts.extend([[x+cx,y+cy,z0] for x,y in loop])
    verts.extend([[x+cx,y+cy,z1] for x,y in loop])
    verts.append([cx,cy,z0]); cb=2*n
    verts.append([cx,cy,z1]); ct=2*n+1
    faces=[]
    for i in range(n):
        j=(i+1)%n
        faces += [[cb,j,i]]
        faces += [[ct,n+i,n+j]]
        faces += [[i,j,n+j],[i,n+j,n+i]]
    m=trimesh.Trimesh(vertices=np.asarray(verts),faces=np.asarray(faces),process=True)
    m.fix_normals(); set_mat(m,key); return m


def rounded_sweep_z(stations, key) -> trimesh.Trimesh:
    """Sweep rounded rectangular cross-sections in XY along Z.
    Each station: (z, cx, cy, width_x, height_y, corner_radius)."""
    loops=[]
    for z,cx,cy,w,h,r in stations:
        outline=rounded_outline(w,h,r,steps=5)
        outline[:,0]+=cx; outline[:,1]+=cy
        loops.append((z,outline))
    n=len(loops[0][1]); verts=[]
    for z,loop in loops:
        verts.extend([[x,y,z] for x,y in loop])
    faces=[]
    for s in range(len(loops)-1):
        a=s*n; b=(s+1)*n
        for i in range(n):
            j=(i+1)%n
            faces += [[a+i,a+j,b+j],[a+i,b+j,b+i]]
    # end caps
    start_center=len(verts); z,loop=loops[0]; verts.append([np.mean(loop[:,0]),np.mean(loop[:,1]),z])
    end_center=len(verts); z,loop=loops[-1]; verts.append([np.mean(loop[:,0]),np.mean(loop[:,1]),z])
    for i in range(n):
        j=(i+1)%n
        faces.append([start_center,j,i])
        base=(len(loops)-1)*n
        faces.append([end_center,base+i,base+j])
    m=trimesh.Trimesh(vertices=np.asarray(verts),faces=np.asarray(faces),process=True)
    m.fix_normals(); set_mat(m,key); return m


def box(extents, center, key, bevel=False):
    # Slight subdivision is intentionally avoided: these are separate hardware assemblies.
    m=trimesh.creation.box(extents=extents)
    m.apply_translation(center)
    set_mat(m,key); return m


def cylinder(radius, height, center, key, axis='z', sections=40):
    m=trimesh.creation.cylinder(radius=radius,height=height,sections=sections)
    if axis=='x':
        T=trimesh.transformations.rotation_matrix(math.pi/2,[0,1,0]); m.apply_transform(T)
    elif axis=='y':
        T=trimesh.transformations.rotation_matrix(-math.pi/2,[1,0,0]); m.apply_transform(T)
    elif axis=='-y':
        T=trimesh.transformations.rotation_matrix(math.pi/2,[1,0,0]); m.apply_transform(T)
    m.apply_translation(center)
    set_mat(m,key); return m


def uv_sphere(scale, center, key, subdivisions=2):
    m=trimesh.creation.icosphere(subdivisions=subdivisions,radius=1.0)
    m.apply_scale(scale); m.apply_translation(center); set_mat(m,key); return m


def add(parts, name, desc, role, mesh, explode, key):
    mesh.metadata['component_name']=name
    mesh.metadata['description']=desc
    mesh.metadata['role']=role
    parts.append(Part(name,desc,role,mesh,tuple(explode),key))


def temples(parts, accent_key='graphite'):
    # Two swept temples, each with a separate soft earpiece section.
    for side,label in [(-1,'Left'),(1,'Right')]:
        full=[
            (3,side*58.8,0.0,6.4,4.6,1.7),
            (7,side*59.8,0.0,7.4,5.0,1.8),
            (18,side*61.0,-0.2,7.3,4.9,1.8),
            (34,side*61.8,-0.8,7.0,4.8,1.7),
            (54,side*62.2,-1.8,6.6,4.6,1.6),
            (77,side*62.2,-4.0,6.0,4.3,1.5),
            (98,side*61.8,-7.0,5.5,4.1,1.4),
            (110,side*61.4,-9.2,5.1,3.9,1.3),
        ]
        tip=[
            (104,side*61.6,-8.3,5.2,4.0,1.3),
            (112,side*61.3,-10.0,5.0,3.9,1.3),
            (122,side*61.0,-12.2,4.8,3.8,1.25),
            (132,side*60.8,-14.0,4.6,3.7,1.2),
            (140,side*60.6,-15.0,4.4,3.6,1.15),
        ]
        add(parts,f'{label} Temple Arm',f'{label} side structural temple housing carrying internal electronics and routing.', 'temple', rounded_sweep_z(full,accent_key), (side*18,0,18), accent_key)
        add(parts,f'{label} Temple Tip / Earpiece',f'Soft-touch rear temple tip for comfort and retention behind the ear.', 'temple_tip', rounded_sweep_z(tip,'rubber'), (side*23,-10,42), 'rubber')
        # Concealed battery cell and controller board are shown in the exploded view.
        batt=rounded_sweep_z([
            (39,side*61.4,-0.3,4.7,2.7,1.1),
            (46,side*61.4,-0.5,4.9,2.8,1.1),
            (70,side*61.9,-2.2,4.5,2.7,1.05),
            (76,side*62.0,-2.8,4.2,2.5,1.0),
        ],'battery')
        add(parts,f'{label} Rechargeable Battery Cell',f'Internal rechargeable battery cell housed inside the {label.lower()} temple.', 'battery', batt, (side*22,8,47), 'battery')
        pcb=box((4.2,1.1,22),(side*61.3,0.0,23),'pcb')
        add(parts,f'{label} Control PCB',f'Miniature control and power-management circuit board for the {label.lower()} temple.', 'pcb', pcb, (side*19,11,19), 'pcb')
        chip=box((2.4,0.75,4.0),(side*61.3,0.85,24),'black_glass')
        add(parts,f'{label} Main Control IC',f'Illustrative controller package mounted on the temple PCB.', 'chip', chip, (side*20,14,21), 'black_glass')
        # Hinge barrel aligned along X.
        hinge=cylinder(2.0,7.0,(side*58.5,0.0,3.5),'titanium',axis='x')
        add(parts,f'{label} Metal Hinge Assembly',f'Metal hinge joining the front frame to the {label.lower()} temple.', 'hinge', hinge, (side*14,0,0), 'titanium')


def common_front(parts, rim_key='graphite', lens_key='lens', accent_key='cyan'):
    # Front frame: lens centers separated by a 10 mm bridge opening.
    for side,label in [(-1,'Left'),(1,'Right')]:
        cx=side*31.0
        add(parts,f'{label} Front Frame Rim',f'Primary structural rim surrounding the {label.lower()} optical lens.', 'frame', ring_mesh(cx,0,0,54,39,10.2,3.4,5.0,rim_key), (side*13,0,0), rim_key)
        add(parts,f'{label} Optical Lens',f'Transparent lens insert; final prescription and optical specifications are not defined in this concept model.', 'lens', rounded_plate(cx,0,0.25,47.2,32.2,7.2,1.0,lens_key), (0,0,-18), lens_key)
        # Nose pads with tiny support arms.
        pad=uv_sphere((3.8,2.2,1.7),(side*9.7,-10.4,3.5),'rubber',2)
        add(parts,f'{label} Silicone Nose Pad',f'Soft nose-contact pad for fit and comfort.', 'nose_pad', pad, (side*10,-15,10), 'rubber')
        # A two-section bridge-to-pad support: a short lateral bracket meets
        # the central bridge, then a vertical stem reaches the nose pad.
        # Keeping both sections in one named mesh prevents a visibly floating pad.
        lateral=box((9.0,2.0,2.0),(side*9.0,-3.2,2.5),'titanium')
        stem=box((2.2,6.5,2.2),(side*10.8,-6.1,2.5),'titanium')
        padarm=trimesh.util.concatenate([lateral,stem])
        set_mat(padarm,'titanium')
        add(parts,f'{label} Nose Pad Support',f'Connected bridge bracket and vertical support stem attaching the nose pad to the frame.', 'nose_support', padarm, (side*11,-12,5), 'titanium')
    bridge=rounded_sweep_z([
        (-2,0,-1.0,13.0,5.4,2.2),
        (0,0,-1.0,13.8,5.5,2.2),
        (2,0,-1.0,13.0,5.2,2.1),
    ],rim_key)
    add(parts,'Central Nose Bridge', 'Structural bridge connecting left and right front rims.', 'bridge', bridge, (0,-10,-8), rim_key)


def add_camera(parts, x, y, name_prefix='Primary', accent='cyan', explode=(-25,18,-15), size=1.0):
    body=rounded_plate(x,y,-4.2,10.5*size,8.2*size,2.4*size,4.0,'graphite')
    add(parts,f'{name_prefix} Camera Housing',f'Camera module enclosure for forward-facing visual capture.', 'camera_housing',body,explode,'graphite')
    ring=cylinder(4.0*size,1.0,(x,y,-6.5),'titanium',axis='z')
    add(parts,f'{name_prefix} Camera Bezel',f'Metal retaining ring around the camera optics.', 'camera_bezel',(ring), (explode[0]*1.05,explode[1]*1.05,explode[2]-7),'titanium')
    glass=cylinder(2.85*size,0.65,(x,y,-7.35),'black_glass',axis='z')
    add(parts,f'{name_prefix} Camera Lens Glass',f'Front optical cover and dark lens element.', 'camera_lens',glass,(explode[0]*1.1,explode[1]*1.1,explode[2]-12),'black_glass')
    # small inner lens highlight
    inner=cylinder(1.35*size,0.25,(x,y,-7.82),'cyan_dark' if accent=='cyan' else 'amber_dark',axis='z')
    add(parts,f'{name_prefix} Optical Core',f'Illustrative inner optical element of the camera module.', 'camera_core',inner,(explode[0]*1.14,explode[1]*1.14,explode[2]-16),'cyan_dark' if accent=='cyan' else 'amber_dark')


def add_mic(parts, side, z, label, explode):
    x=side*18.0
    mic=cylinder(1.35,0.8,(x,-17.1,-2.2),'black_glass',axis='z',sections=24)
    add(parts,f'{label} Microphone Port',f'Acoustic inlet for the microphone array.', 'microphone',mic,explode,'black_glass')


def add_speaker(parts, side, label, accent, explode):
    x=side*66.0; y=-0.6; z=31.0
    shell=cylinder(4.2,4.0,(x,y,z),'graphite',axis='x')
    add(parts,f'{label} Open-Ear Speaker Housing',f'Compact open-ear audio module mounted along the temple.', 'speaker',shell,explode,'graphite')
    disc=cylinder(3.5,0.7,(side*68.1,y,z),'titanium',axis='x')
    add(parts,f'{label} Speaker Grille',f'Protective acoustic grille for the open-ear speaker.', 'speaker_grille',disc,(explode[0]+side*4,explode[1],explode[2]),'titanium')
    # Grille accent centre
    center=cylinder(1.4,0.8,(side*68.6,y,z),'black_glass',axis='x',sections=28)
    add(parts,f'{label} Speaker Driver',f'Illustrative acoustic driver behind the grille.', 'speaker_driver',center,(explode[0]+side*7,explode[1],explode[2]+4),'black_glass')


def add_button(parts, xside, z, name='Multifunction Button', accent='cyan'):
    # Place the outward-facing control on the temple surface, not beyond it.
    x=xside*64.7
    body=cylinder(2.2,1.3,(x,-0.2,z),'titanium',axis='x')
    add(parts,name,f'Tactile control for power, capture, assistant activation, or supported shortcuts.', 'button',(body),(xside*18,6,z-8),'titanium')
    cap=cylinder(1.45,0.7,(x+xside*0.9,-0.2,z),accent,axis='x')
    add(parts,f'{name} Accent Cap',f'Colored tactile button cap.', 'button_cap',cap,(xside*22,8,z-7),accent)


def add_led(parts, side, name, key='cyan'):
    # Seat the LED on the outer temple wall.
    led=uv_sphere((1.0,0.8,1.0),(side*64.7,1.8,12.0),key,2)
    add(parts,name,'Small device status indicator light.', 'status_led',led,(side*19,9,0),key)


def add_usb(parts, side, name='USB-C Charging Port'):
    port=box((2.0,3.2,7.8),(side*62.2,-10.6,116.0),'black_glass')
    add(parts,name,'Charging/data connector opening near the rear underside of the temple.', 'port',port,(side*22,-12,38),'black_glass')
    lip=box((2.5,3.8,8.5),(side*62.1,-10.3,116.0),'titanium')
    add(parts,f'{name} Metal Surround', 'Metallic surround for the charging port.', 'port_trim',lip,(side*25,-14,40),'titanium')


def add_logo_badge(parts, side, accent):
    badge=rounded_sweep_z([
        (17,side*66.0,2.3,1.0,5.0,0.45),
        (18,side*66.0,2.3,1.0,5.0,0.45),
    ],accent)
    add(parts,f'{"Left" if side<0 else "Right"} Variant Accent Inlay','Subtle exterior accent inlay on the temple.', 'accent',badge,(side*18,12,18),accent)


def build_smart() -> list[Part]:
    parts=[]; common_front(parts,'graphite','lens','cyan'); temples(parts,'graphite')
    add_camera(parts,-31.0,17.4,'Primary Wide-Angle','cyan',(-26,18,-13),0.88)
    # Two microphones and one ambient/voice pickup.
    add_mic(parts,-1,0,'Front Voice',(-8,-20,-13))
    add_mic(parts,1,0,'Ambient Voice',(8,-20,-13))
    add_mic(parts,1,0,'Secondary Voice',(18,-18,-16))
    add_speaker(parts,-1,'Left','cyan',(-18,-10,28))
    add_speaker(parts,1,'Right','cyan',(18,-10,28))
    add_button(parts,1,18,'Power / Assistant Button','cyan')
    add_led(parts,1,'Status LED','cyan')
    add_usb(parts,1)
    # External touch-sensitive control strip on right temple.
    touch=rounded_sweep_z([(42,65.3,2.0,1.3,16,0.5),(65,65.3,1.0,1.3,16,0.5)],'titanium')
    add(parts,'Right Temple Touch Strip','Touch-sensitive control zone for the general-purpose assistant.', 'touch_strip',touch,(24,9,35),'titanium')
    # Internal sensor/control board near front bridge.
    board=box((4.5,1.0,12.0),(-61.2,-0.5,12.5),'pcb')
    add(parts,'Front Sensor Interface PCB','Illustrative front sensor interconnect board housed inside the left temple.', 'pcb',board,(0,17,16),'pcb')
    assign_exploded_offsets(parts, 'Smart')
    return parts


def build_connect() -> list[Part]:
    parts=[]; common_front(parts,'graphite','lens_cyan','cyan'); temples(parts,'graphite')
    # Distinct optical waveguide/combiner plates positioned just behind the front lenses.
    for side,label in [(-1,'Left'),(1,'Right')]:
        wave=rounded_plate(side*31.0,0,1.15,46.2,31.2,6.9,0.55,'lens_cyan')
        add(parts,f'{label} AR Waveguide / Combiner',f'Transparent optical layer intended to guide virtual display imagery into the {label.lower()} eye box.', 'waveguide',wave,(0,0,-24), 'lens_cyan')
    # Microdisplay/projector module at upper right brow, with a tiny output window.
    proj=rounded_plate(43,16,-4.5,15.5,7.5,2.1,4.0,'graphite')
    add(parts,'AR Microdisplay Projector Housing','Enclosure for the miniature AR display/projector assembly.', 'projector_housing',proj,(24,22,-19),'graphite')
    window=rounded_plate(43,16,-7.0,8.0,3.8,1.0,0.8,'black_glass')
    add(parts,'AR Projector Optical Window','Optical output window of the microdisplay assembly.', 'projector_window',window,(28,26,-27),'black_glass')
    pcb=box((4.8,1.2,12.0),(61.2,-0.6,12.5),'pcb')
    add(parts,'AR Display Driver PCB','Driver electronics for the AR microdisplay, housed inside the right temple.', 'display_pcb',pcb,(28,28,-16),'pcb')
    add_camera(parts,-31.0,17.4,'Sign Recognition Front Camera','cyan',(0,25,-19),0.82)
    # Downward-facing auxiliary camera concept for capturing the wearer's own hand-sign area.
    hand_housing=box((8.0,4.2,6.0),(0.0,-4.6,2.8),'graphite')
    add(parts,'Wearer Hand-Sign Camera Housing','Small downward-facing camera enclosure intended to observe the wearer’s signing area; exact field of view requires ergonomic testing.', 'hand_camera_housing',(hand_housing),(18,-22,-14),'graphite')
    hand_bezel=cylinder(2.0,0.9,(0.0,-6.9,2.8),'titanium',axis='-y')
    add(parts,'Wearer Hand-Sign Camera Bezel','Metal retaining ring for the downward-facing hand-sign camera.', 'hand_camera_bezel',(hand_bezel),(21,-26,-19),'titanium')
    hand_lens=cylinder(1.3,0.55,(0.0,-7.65,2.8),'black_glass',axis='-y')
    add(parts,'Wearer Hand-Sign Camera Lens','Optical cover for the auxiliary hand-sign camera.', 'hand_camera_lens',(hand_lens),(23,-28,-23),'black_glass')
    add_mic(parts,-1,0,'Speech Capture Left',(-12,-20,-12))
    add_mic(parts,1,0,'Speech Capture Right',(12,-20,-12))
    add_speaker(parts,-1,'Left','cyan',(-18,-10,28))
    add_speaker(parts,1,'Right','cyan',(18,-10,28))
    add_button(parts,1,18,'Communication Mode Button','cyan')
    add_led(parts,1,'Communication Status LED','cyan')
    add_usb(parts,1)
    # Small camera illumination/ambient sensor near brow.
    ambient=uv_sphere((1.4,1.1,0.8),(8,17,-3.7),'titanium',2)
    add(parts,'Ambient Light Sensor','Measures ambient brightness for display adjustment.', 'ambient_sensor',(ambient),(0,24,-11),'titanium')
    # Distinct temple touch bar to switch caption/sign output.
    touch=rounded_sweep_z([(42,65.3,2.0,1.3,17,0.5),(66,65.3,1.0,1.3,17,0.5)],'cyan')
    add(parts,'Right Temple Communication Control Strip','Touch surface for caption, sign output, and volume controls.', 'touch_strip',touch,(25,9,35),'cyan')
    assign_exploded_offsets(parts, 'Connect')
    return parts


def build_vision() -> list[Part]:
    parts=[]; common_front(parts,'black','lens_smoke','amber'); temples(parts,'black')
    # Larger central wide-angle stereo camera and ToF depth sensor.
    add_camera(parts,-31.0,17.4,'Primary Wide-Angle Scene Camera','amber',(0,25,-18),0.92)
    add_camera(parts,31.0,17.4,'Secondary Stereo Camera','amber',(-22,22,-17),0.78)
    tof=cylinder(2.5,1.8,(0.0,-1.0,-2.6),'amber',axis='z',sections=32)
    add(parts,'Time-of-Flight Depth Sensor','Optional depth-sensing module for improved distance estimation; final sensor selection is not fixed.', 'depth_sensor',(tof),(24,25,-20),'amber')
    tofglass=cylinder(1.75,0.5,(0.0,-1.0,-3.75),'black_glass',axis='z',sections=32)
    add(parts,'Depth Sensor Optical Window','Protective optical window for the depth sensor.', 'depth_window',tofglass,(27,28,-26),'black_glass')
    # Multi-mic array at lower front.
    add_mic(parts,-1,0,'Voice Input Left',(-14,-20,-13))
    add_mic(parts,1,0,'Voice Input Right',(14,-20,-13))
    add_mic(parts,1,0,'Environmental Audio',(22,-19,-15))
    add_speaker(parts,-1,'Left','amber',(-18,-10,28))
    add_speaker(parts,1,'Right','amber',(18,-10,28))
    add_button(parts,-1,18,'Voice Assistant Button','amber')
    add_button(parts,1,18,'Hazard Alert / Control Button','amber')
    add_led(parts,1,'Vision Status LED','amber')
    add_usb(parts,1)
    # Haptic cue modules, separate so they can be seen in exploded layout.
    haptic=cylinder(1.7,6.0,(-61.8,-5.1,84),'titanium',axis='x',sections=32)
    add(parts,'Left Temple Haptic Motor','Optional vibration motor for discreet tactile notifications.', 'haptic_motor',haptic,(-23,-10,32),'titanium')
    vib=box((4.5,1.0,12),(61.2,-0.6,12.5),'pcb')
    add(parts,'Vision Sensor Interface PCB','Illustrative interface board for camera, depth and audio components, housed inside the right temple.', 'pcb',vib,(0,22,20),'pcb')
    assign_exploded_offsets(parts, 'Vision')
    return parts



def assign_exploded_offsets(parts: list[Part], product: str) -> None:
    """Assign deliberate, grouped offsets for a readable exploded assembly.

    Offsets are in millimetres in the model's world coordinate system. Camera
    subassemblies stay coaxial, speaker stacks separate along their mounting
    axis, and internal temple electronics move outward from their enclosures.
    """
    for part in parts:
        name = part.name
        side = -1 if name.startswith('Left ') else (1 if name.startswith('Right ') else (-1 if part.mesh.centroid[0] < -1 else (1 if part.mesh.centroid[0] > 1 else 0)))
        offset = part.explode

        if name.endswith('Front Frame Rim'):
            offset = (side * 14, 0, 0)
        elif name.endswith('Optical Lens'):
            offset = (0, 0, -20)
        elif name.endswith('Silicone Nose Pad'):
            offset = (side * 9, -9, 8)
        elif name.endswith('Nose Pad Support'):
            offset = (side * 12, -6, 4)
        elif name == 'Central Nose Bridge':
            offset = (0, -10, -8)
        elif name.endswith('Temple Arm') and 'Tip' not in name:
            offset = (side * 18, 0, 14)
        elif 'Temple Tip / Earpiece' in name:
            offset = (side * 22, -8, 28)
        elif 'Rechargeable Battery Cell' in name:
            offset = (side * 13, 7, 2)
        elif name.endswith('Control PCB') or name.endswith('Sensor Interface PCB') or name == 'AR Display Driver PCB':
            offset = (side * 16 if side else 0, 10, 8)
        elif name.endswith('Main Control IC'):
            offset = (side * 19, 5, 10)
        elif name.endswith('Metal Hinge Assembly'):
            offset = (side * 12, 0, -7)
        elif 'Hand-Sign Camera Housing' in name:
            offset = (0, -12, 0)
        elif 'Hand-Sign Camera Bezel' in name:
            offset = (0, -18, 0)
        elif 'Hand-Sign Camera Lens' in name:
            offset = (0, -23, 0)
        elif 'Camera Housing' in name:
            offset = (0, 0, -15)
        elif 'Camera Bezel' in name:
            offset = (0, 0, -23)
        elif 'Camera Lens Glass' in name:
            offset = (0, 0, -31)
        elif 'Optical Core' in name:
            offset = (0, 0, -39)
        elif name.endswith('Microphone Port'):
            offset = (0, -11, -3)
        elif 'Open-Ear Speaker Housing' in name:
            offset = (side * 13, 0, 0)
        elif 'Speaker Grille' in name:
            offset = (side * 21, 0, 0)
        elif 'Speaker Driver' in name:
            offset = (side * 29, 0, 0)
        elif name.endswith('Accent Cap'):
            offset = (side * 18, 7, -2)
        elif name.endswith('Button'):
            offset = (side * 12, 5, 0)
        elif name.endswith('Status LED'):
            offset = (side * 14, 7, -3)
        elif name.endswith('Charging Port Metal Surround'):
            offset = (side * 18, -8, 8)
        elif name.endswith('Charging Port'):
            offset = (side * 13, -6, 6)
        elif 'Touch Strip' in name:
            offset = (side * 16, 5, 12)
        elif 'Waveguide / Combiner' in name:
            offset = (0, 0, 18)
        elif name == 'AR Projector Optical Window':
            offset = (14, 8, -20)
        elif name == 'AR Microdisplay Projector Housing':
            offset = (14, 8, -12)
        elif name == 'Ambient Light Sensor':
            offset = (0, 12, -5)
        elif name == 'Time-of-Flight Depth Sensor':
            offset = (0, -10, -12)
        elif name == 'Depth Sensor Optical Window':
            offset = (0, -10, -20)
        elif name == 'Left Temple Haptic Motor':
            offset = (-14, -5, 8)
        elif 'Variant Accent Inlay' in name:
            offset = (side * 15, 8, 12)

        part.explode = tuple(float(v) for v in offset)


def scene_for(parts: list[Part], exploded=False) -> trimesh.Scene:
    sc=trimesh.Scene()
    sc.metadata={'generator':'SIGNLINK parametric concept model','units':'meters','state':'exploded' if exploded else 'assembled'}
    for idx,p in enumerate(parts, start=1):
        mesh=p.mesh.copy()
        if exploded:
            mesh.apply_translation(np.asarray(p.explode,dtype=float))
        mesh.vertices *= 0.001  # glTF linear unit is metres
        mesh.metadata.update({'component_id':f'{idx:02d}','component_name':p.name,'description':p.description,'role':p.role})
        node=f'{idx:02d} | {p.name}'
        geom=f'{idx:02d}_{p.name.replace("/","-")}'
        sc.add_geometry(mesh,geom_name=geom,node_name=node)
    return sc


def make_vtk_poly(mesh: trimesh.Trimesh):
    import vtk
    pts=vtk.vtkPoints(); pts.SetNumberOfPoints(len(mesh.vertices))
    for i,v in enumerate(mesh.vertices): pts.SetPoint(i,float(v[0]),float(v[1]),float(v[2]))
    cells=vtk.vtkCellArray()
    for face in mesh.faces:
        tri=vtk.vtkTriangle()
        for j,vid in enumerate(face): tri.GetPointIds().SetId(j,int(vid))
        cells.InsertNextCell(tri)
    poly=vtk.vtkPolyData(); poly.SetPoints(pts); poly.SetPolys(cells)
    normals=vtk.vtkPolyDataNormals(); normals.SetInputData(poly); normals.ConsistencyOn(); normals.AutoOrientNormalsOn(); normals.SplittingOff(); normals.ComputePointNormalsOn(); normals.ComputeCellNormalsOff(); normals.Update()
    return normals.GetOutput()


def render(parts: list[Part], out_path: Path, exploded=False, title=''):
    import vtk
    rw=vtk.vtkRenderWindow(); rw.SetOffScreenRendering(1); rw.SetSize(1600,1100); rw.SetMultiSamples(8)
    ren=vtk.vtkRenderer(); rw.AddRenderer(ren)
    ren.SetBackground(0.035,0.050,0.075); ren.SetBackground2(0.16,0.205,0.26); ren.GradientBackgroundOn()
    ren.SetUseDepthPeeling(1); ren.SetMaximumNumberOfPeels(100); ren.SetOcclusionRatio(0.1)
    for p in parts:
        mesh=p.mesh.copy()
        if exploded: mesh.apply_translation(p.explode)
        poly=make_vtk_poly(mesh)
        mapper=vtk.vtkPolyDataMapper(); mapper.SetInputData(poly)
        actor=vtk.vtkActor(); actor.SetMapper(mapper)
        # palette to normalized RGB
        col=PALETTES[p.material_key]
        prop=actor.GetProperty(); prop.SetColor(col[0],col[1],col[2]); prop.SetOpacity(col[3])
        if p.role in ('lens','waveguide'):
            # Preview renders intentionally use opaque tinted optical surfaces so
            # the lens and waveguide boundaries remain visible in static PNGs.
            # The exported GLB materials retain their translucent alpha values.
            prop.SetColor(0.28,0.48,0.68 if p.role == 'lens' else 0.58)
            prop.SetOpacity(1.0 if p.role == 'lens' else 0.82)
        prop.SetInterpolationToPhong(); prop.SetAmbient(0.48); prop.SetDiffuse(0.85); prop.SetSpecular(0.18 if p.role in ('lens','waveguide') else (0.58 if p.material_key not in ('lens','lens_cyan','lens_smoke') else 0.78)); prop.SetSpecularPower(54)
        # PBR values where supported by this VTK build
        try:
            prop.SetMetallic(0.65 if p.material_key in ('titanium','silver','graphite','black') else 0.1)
            prop.SetRoughness(0.25 if p.material_key in ('titanium','silver') else 0.36)
        except Exception: pass
        ren.AddActor(actor)
    # Three broad studio lights.
    for pos,intensity in [((180,180,-120),1.10),((-150,90,-80),0.82),((0,130,240),0.86)]:
        light=vtk.vtkLight(); light.SetLightTypeToSceneLight(); light.SetPosition(*pos); light.SetFocalPoint(0,0,60); light.SetIntensity(intensity); ren.AddLight(light)
    cam=ren.GetActiveCamera()
    focus=np.array([0.0,-1.0,67.0])
    # Front-right elevated three-quarter view, exposing both front optics and one temple.
    offset=np.array([65.0,76.0,-315.0])
    if exploded: offset=np.array([75.0,86.0,-340.0])
    cam.SetFocalPoint(*focus); cam.SetPosition(*(focus+offset)); cam.SetViewUp(0,1,0); cam.SetViewAngle(33.0); cam.ParallelProjectionOff(); cam.Zoom(1.0)
    ren.ResetCameraClippingRange()
    # Add a soft title/subtitle overlay, kept separate from the 3D geometry.
    text=vtk.vtkTextActor(); text.SetInput(title)
    tp=text.GetTextProperty(); tp.SetFontSize(28); tp.SetBold(True); tp.SetColor(0.88,0.93,0.98); tp.SetFontFamilyToArial()
    text.SetDisplayPosition(48,1030); ren.AddActor2D(text)
    sub=vtk.vtkTextActor(); sub.SetInput('CONCEPT MODEL  /  SEPARATED NAMED COMPONENTS' if exploded else 'CONCEPT MODEL  /  ASSEMBLED PRODUCT')
    sp=sub.GetTextProperty(); sp.SetFontSize(16); sp.SetColor(0.48,0.68,0.82); sp.SetFontFamilyToArial()
    sub.SetDisplayPosition(50,995); ren.AddActor2D(sub)
    rw.Render()
    w2i=vtk.vtkWindowToImageFilter(); w2i.SetInput(rw); w2i.SetInputBufferTypeToRGBA(); w2i.ReadFrontBufferOff(); w2i.Update()
    writer=vtk.vtkPNGWriter(); writer.SetFileName(str(out_path)); writer.SetInputConnection(w2i.GetOutputPort()); writer.Write()
    rw.Finalize()


def create_product(name, title, builder):
    parts=builder()
    assembled=scene_for(parts,False); exploded=scene_for(parts,True)
    (MODELS/f'{name}_Assembled.glb').write_bytes(assembled.export(file_type='glb'))
    (MODELS/f'{name}_Exploded.glb').write_bytes(exploded.export(file_type='glb'))
    render(parts,PREV/f'{name}_Assembled.png',False,title)
    render(parts,PREV/f'{name}_Exploded.png',True,title)
    rows=[]
    for i,p in enumerate(parts,1):
        rows.append({
            'id':f'{i:02d}', 'name':p.name, 'description':p.description,
            'role':p.role, 'material':p.material_key,
            'exploded_offset_mm':list(p.explode),
            'mesh_vertices':int(len(p.mesh.vertices)), 'mesh_faces':int(len(p.mesh.faces)),
        })
    with open(REF/f'{name}_parts.json','w',encoding='utf-8') as f: json.dump(rows,f,indent=2)
    return rows


def main():
    catalog={}
    catalog['Smart']=create_product('SIGNLINK_Smart','SIGNLINK SMART  /  GENERAL AI ASSISTANCE',build_smart)
    catalog['Connect']=create_product('SIGNLINK_Connect','SIGNLINK CONNECT  /  DEAF & HARD-OF-HEARING COMMUNICATION',build_connect)
    catalog['Vision']=create_product('SIGNLINK_Vision','SIGNLINK VISION  /  BLIND & LOW-VISION ASSISTANCE',build_vision)
    with open(REF/'all_components.json','w',encoding='utf-8') as f: json.dump(catalog,f,indent=2)
    # Human-readable parts reference and Three.js explode metadata.
    lines=['# SIGNLINK 3D Concept Models — Component Reference','',
           'All geometry is authored in millimetres and exported to GLB in metres. Each component is an individually named mesh/node. ',
           'The assembled and exploded GLB files contain the same components; the exploded GLB applies the per-part offsets listed below.',
           '', '**Important:** These are visual concept models, not manufacturing-ready CAD, validated optical designs, or certified hardware layouts.', '']
    manifest={'units':'meters','authoring_units':'millimeters','products':{}}
    for product, rows in catalog.items():
        lines += [f'## SIGNLINK {product}', '', '| ID | Component name | Function |', '|---:|---|---|']
        manifest['products'][product]={}
        for row in rows:
            lines.append(f"| {row['id']} | {row['name']} | {row['description']} |")
            manifest['products'][product][row['name']]={
                'componentId':row['id'], 'role':row['role'],
                'explodedOffsetMeters':[v/1000 for v in row['exploded_offset_mm']],
                'description':row['description']
            }
        lines.append('')
    (REF/'COMPONENTS_REFERENCE.md').write_text('\n'.join(lines),encoding='utf-8')
    (REF/'threejs_explode_manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    readme='''# SIGNLINK 3D Concept Package\n\n## Contents\n- `models/*_Assembled.glb`: assembled products, with individual named components preserved.\n- `models/*_Exploded.glb`: static exploded arrangement of those same components.\n- `previews/*.png`: studio preview renders.\n- `reference/COMPONENTS_REFERENCE.md`: human-readable component index.\n- `reference/threejs_explode_manifest.json`: per-part exploded offsets for Three.js animation.\n- `source/build_models.py`: procedural source generator.\n\n## Opening the models\nImport any `.glb` into Blender, Windows 3D Viewer, or another glTF-compatible viewer. In Blender, use the Outliner to select each separately named component. The assembled and exploded states are supplied as two files per variant.\n\n## Three.js integration\nLoad the assembled GLB with `GLTFLoader`. Each component is a separately named scene node. Use `threejs_explode_manifest.json` to animate each node from its original position to the specified offset. The exploded GLBs are supplied as visual references.\n\n## Units and limitations\nThe geometry is dimensioned conceptually in millimetres and exported in metres, as expected by glTF. These are illustrative 3D concept models, not manufacturing-ready CAD. Internal electronics, optics, component placements, and dimensions require engineering validation before fabrication. The Connect waveguide/projector and Vision depth sensing are illustrative concept components, not tested optical/electrical assemblies.\n'''
    (ROOT/'README.md').write_text(readme,encoding='utf-8')
    print('Generated:', sum(len(v) for v in catalog.values()), 'named components across', len(catalog), 'variants')
    for k,v in catalog.items(): print(k, len(v),'parts')

if __name__=='__main__': main()
