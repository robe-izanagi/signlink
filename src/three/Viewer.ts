import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Part, ProductKey } from '../data/signlinkData';
import { BASE } from '../lib/assets';

const MODEL_PART = /^(\d{3}) \| (.+)$/;
const SVG_NS = 'http://www.w3.org/2000/svg';
const loader = new GLTFLoader();

export type LabelMode = 'off' | 'ids' | 'names';

export interface ViewerCallbacks {
  onLoadStart: () => void;
  onLoadProgress: (progress: number | null) => void;
  onLoadComplete: () => void;
  onLoadError: (error: Error) => void;
  onPick: (part: Part | null) => void;
  onExplosion: (value: number, animating: boolean) => void;
  onDenseLabels: (dense: boolean) => void;
  onAutoRotateChange: (enabled: boolean) => void;
}

interface ViewerPart {
  data: Part;
  object: THREE.Mesh;
  originalPosition: THREE.Vector3;
  localOffset: THREE.Vector3;
  originalMaterial: THREE.Material | THREE.Material[];
  activeMaterial: THREE.Material | THREE.Material[];
  selectedMaterial: THREE.Material | THREE.Material[] | null;
  heatMaterial: THREE.MeshStandardMaterial | null;
  center: THREE.Vector3;
  label: HTMLButtonElement;
  line: SVGLineElement;
  dot: SVGCircleElement;
}

function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  for (const entry of Array.isArray(material) ? material : [material]) entry.dispose();
}

function disposeObject(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) {
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        materials.add(material);
        for (const value of Object.values(material)) {
          if (value && typeof value === 'object' && 'isTexture' in value && value.isTexture) {
            textures.add(value as THREE.Texture);
          }
        }
      }
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
}

function localOffset(parent: THREE.Object3D, worldOffset: THREE.Vector3): THREE.Vector3 {
  parent.updateWorldMatrix(true, false);
  const inverse = new THREE.Matrix4().copy(parent.matrixWorld).invert();
  const origin = new THREE.Vector3().applyMatrix4(inverse);
  return worldOffset.clone().applyMatrix4(inverse).sub(origin);
}

export class Viewer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(30, 1, 0.001, 10);
  private readonly controls: OrbitControls;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly resizeObserver: ResizeObserver;
  private readonly intersectionObserver: IntersectionObserver;
  private readonly labelSvg: SVGSVGElement;
  private readonly partsByName = new Map<string, ViewerPart>();
  private readonly parts: ViewerPart[] = [];
  private model: THREE.Group | null = null;
  private selected: ViewerPart | null = null;
  private helper: THREE.BoxHelper | null = null;
  private frameRequest: number | null = null;
  private explosionFrame: number | null = null;
  private loadGeneration = 0;
  private visible = false;
  private destroyed = false;
  private dirty = true;
  private lastFrame = 0;
  private lastProgressReport = 0;
  private lastLabelLayout = 0;
  private inFrame = false;
  private explosion = 0;
  private explosionGoal = 0;
  private animating = false;
  private labelMode: LabelMode = 'off';
  private labelCategories: Set<string> | null = null;
  private heatmap = false;
  private userMoved = false;
  private priceRange: [number, number] = [1, 1];
  private accent = '#6aa8ff';
  private pointerDown: { x: number; y: number } | null = null;
  private onChange: () => void;
  private onStart: () => void;
  private onPointerDown: (event: PointerEvent) => void;
  private onPointerUp: (event: PointerEvent) => void;
  private onVisibilityChange: () => void;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly overlay: HTMLDivElement,
    private readonly callbacks: ViewerCallbacks,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(0.5, 0.8, -0.6);
    this.scene.add(keyLight, new THREE.HemisphereLight(0xe4eeff, 0x182338, 1.1));

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.screenSpacePanning = true;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 1.1;
    this.controls.minDistance = 0.03;
    this.controls.maxDistance = 2;
    this.controls.addEventListener('change', this.onChange = () => this.requestRender());
    this.controls.addEventListener('start', this.onStart = () => {
      this.userMoved = true;
      this.controls.autoRotate = false;
      this.callbacks.onAutoRotateChange(false);
    });

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'label-lines');
    svg.setAttribute('aria-hidden', 'true');
    this.labelSvg = svg;
    this.overlay.replaceChildren(svg);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    this.intersectionObserver = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      this.syncLoop();
    }, { rootMargin: '120px' });
    this.intersectionObserver.observe(canvas.parentElement ?? canvas);

    this.onVisibilityChange = () => this.syncLoop();
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.onPointerDown = (event) => {
      this.pointerDown = { x: event.clientX, y: event.clientY };
    };
    this.onPointerUp = (event) => {
      if (!this.pointerDown) return;
      const distance = Math.hypot(
        event.clientX - this.pointerDown.x,
        event.clientY - this.pointerDown.y,
      );
      this.pointerDown = null;
      if (distance < 6) this.pick(event);
    };
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);
    this.resize();
  }

  private requestRender(): void {
    this.dirty = true;
    this.syncLoop();
  }

  private syncLoop(): void {
    if (this.destroyed) return;
    const active = this.visible && !document.hidden;
    if (!active) {
      if (this.frameRequest !== null) cancelAnimationFrame(this.frameRequest);
      this.frameRequest = null;
      return;
    }
    if (this.inFrame) return;
    if (this.frameRequest === null) {
      this.frameRequest = requestAnimationFrame((time) => this.tick(time));
    }
  }

  private tick(time: number): void {
    this.frameRequest = null;
    if (this.destroyed || !this.visible || document.hidden) return;
    this.inFrame = true;
    const delta = Math.min((time - (this.lastFrame || time)) / 1000, 0.1);
    this.lastFrame = time;
    if (this.animating) {
      const distance = this.explosionGoal - this.explosion;
      const next = Math.abs(distance) < 0.004
        ? this.explosionGoal
        : this.explosion + distance * (1 - Math.exp(-delta * 4.5));
      this.setExplosion(next);
      if (this.animating && time - this.lastProgressReport >= 80) {
        this.callbacks.onExplosion(this.explosion, true);
        this.lastProgressReport = time;
      }
      if (next === this.explosionGoal) this.setAnimating(false);
    }

    const controlsChanged = this.controls.update();
    if (controlsChanged || this.dirty) {
      this.helper?.update();
      this.renderer.render(this.scene, this.camera);
      this.dirty = false;
      if (this.labelMode !== 'off' && time - this.lastLabelLayout >= 45) {
        this.layoutLabels();
        this.lastLabelLayout = time;
      }
    }
    this.inFrame = false;
    if ((this.animating || this.controls.autoRotate || controlsChanged || this.dirty)
      && this.frameRequest === null) {
      this.frameRequest = requestAnimationFrame((nextTime) => this.tick(nextTime));
    }
  }

  private resize(): void {
    const parent = this.canvas.parentElement;
    const width = parent?.clientWidth ?? 0;
    const height = parent?.clientHeight ?? 0;
    if (!width || !height) return;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    if (this.model && !this.userMoved) this.frameModel();
    this.requestRender();
  }

  async load(product: ProductKey): Promise<void> {
    const generation = ++this.loadGeneration;
    this.clearModel(false);
    this.callbacks.onLoadStart();
    const url = `${BASE}models/SIGNLINK_${product}_Assembled.glb`;

    try {
      const gltf = await loader.loadAsync(url, (event) => {
        if (generation !== this.loadGeneration) return;
        this.callbacks.onLoadProgress(event.total > 0 ? event.loaded / event.total : null);
      });
      if (this.destroyed || generation !== this.loadGeneration) {
        disposeObject(gltf.scene);
        return;
      }

      this.model = gltf.scene;
      this.scene.add(this.model);
      this.model.updateMatrixWorld(true);
      const productParts = this.getProductParts(product);
      const byName = new Map(productParts.map((part) => [part.name, part]));

      this.model.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh || !mesh.parent) return;
        const originalName = String(mesh.userData.name ?? mesh.name.replace(/_/g, ' '));
        const match = MODEL_PART.exec(originalName);
        if (!match) return;
        const [, id, name] = match;
        const data = byName.get(name);
        if (!data || data.id !== id) return;

        mesh.geometry.computeBoundingBox();
        const boundsCenter = mesh.geometry.boundingBox?.getCenter(new THREE.Vector3())
          ?? new THREE.Vector3();
        const label = document.createElement('button');
        label.type = 'button';
        label.className = 'part-label';
        label.setAttribute('aria-label', `${id} | ${name}`);
        label.innerHTML = `<span class="label-arrow" aria-hidden="true">▸</span><b>${id}</b><span class="label-name"></span>`;
        label.querySelector('.label-name')!.textContent = name;
        label.addEventListener('click', () => this.callbacks.onPick(
          this.selected?.data.name === name ? null : data,
        ));
        const line = document.createElementNS(SVG_NS, 'line');
        const dot = document.createElementNS(SVG_NS, 'circle');
        dot.setAttribute('r', '3');
        this.labelSvg.append(line, dot);
        this.overlay.append(label);
        const part: ViewerPart = {
          data,
          object: mesh,
          originalPosition: mesh.position.clone(),
          localOffset: localOffset(mesh.parent, new THREE.Vector3(data.offX, data.offY, data.offZ)),
          originalMaterial: mesh.material,
          activeMaterial: mesh.material,
          selectedMaterial: null,
          heatMaterial: null,
          center: boundsCenter,
          label,
          line,
          dot,
        };
        this.parts.push(part);
        this.partsByName.set(name, part);
      });

      if (this.parts.length !== productParts.length) {
        const count = this.parts.length;
        this.clearModel(false);
        throw new Error(`Matched ${count} of ${productParts.length} named meshes in the SIGNLINK ${product} model.`);
      }

      this.parts.sort((a, b) => a.data.id.localeCompare(b.data.id));
      this.priceRange = this.getPriceRange();
      this.setExplosion(0);
      this.setHeatmap(this.heatmap);
      this.userMoved = false;
      this.frameModel();
      this.applySelection(null);
      this.callbacks.onLoadComplete();
    } catch (error) {
      if (this.destroyed || generation !== this.loadGeneration) return;
      this.clearModel(false);
      this.callbacks.onLoadError(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  private getProductParts(key: ProductKey): Part[] {
    return this.callbacksData[key];
  }

  private callbacksData: Record<ProductKey, Part[]> = {
    Smart: [],
    Connect: [],
    Vision: [],
  };

  setProductData(data: Record<ProductKey, Part[]>): void {
    this.callbacksData = data;
  }

  private getPriceRange(): [number, number] {
    const prices = this.parts.map((part) => part.data.price).filter(
      (price): price is number => price !== null && price > 0,
    );
    return [Math.min(...prices), Math.max(...prices)];
  }

  setExplosion(value: number): void {
    this.explosion = THREE.MathUtils.clamp(value, 0, 1);
    for (const part of this.parts) {
      part.object.position.copy(part.originalPosition)
        .addScaledVector(part.localOffset, this.explosion);
    }
    this.requestRender();
  }

  setAnimating(value: boolean): void {
    this.animating = value;
    this.callbacks.onExplosion(this.explosion, value);
    this.syncLoop();
  }

  animateExplosion(value: number): void {
    this.explosionGoal = THREE.MathUtils.clamp(value, 0, 1);
    this.setAnimating(true);
  }

  pause(): void {
    this.explosionGoal = this.explosion;
    this.setAnimating(false);
  }

  setAutoRotate(enabled: boolean): void {
    this.controls.autoRotate = enabled;
    this.callbacks.onAutoRotateChange(enabled);
    this.requestRender();
  }

  setAccent(accent: string): void {
    this.accent = accent;
    if (this.selected) this.applySelection(this.selected.data);
  }

  setView(view: 'front' | 'side' | 'top' | 'threeQuarter'): void {
    if (!this.home) return;
    this.userMoved = true;
    this.controls.autoRotate = false;
    const angles = {
      front: [0, 0.05],
      side: [Math.PI / 2, 0.05],
      top: [0, 1.45],
      threeQuarter: [0.5, 0.3],
    } as const;
    const [azimuth, elevation] = angles[view];
    this.applyView(azimuth, elevation, this.home.distance, false);
  }

  private home: { center: THREE.Vector3; distance: number } | null = null;

  private frameModel(): void {
    if (!this.model) return;
    this.model.updateMatrixWorld(true);
    const assembled = new THREE.Box3().setFromObject(this.model);
    const previous = this.parts.map((part) => part.object.position.clone());
    this.parts.forEach((part) => {
      part.object.position.copy(part.originalPosition).add(part.localOffset);
    });
    this.model.updateMatrixWorld(true);
    const exploded = new THREE.Box3().setFromObject(this.model);
    this.parts.forEach((part, index) => part.object.position.copy(previous[index]));
    this.model.updateMatrixWorld(true);
    const bounds = assembled.union(exploded);
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    const center = bounds.getCenter(new THREE.Vector3());
    const vertical = THREE.MathUtils.degToRad(this.camera.fov);
    const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * this.camera.aspect);
    const distance = (sphere.radius / Math.sin(Math.min(vertical, horizontal) / 2)) * 1.04;
    this.home = { center, distance };
    this.camera.near = Math.max(distance / 100, 0.001);
    this.camera.far = distance * 100;
    this.camera.updateProjectionMatrix();
    this.controls.minDistance = distance * 0.25;
    this.controls.maxDistance = distance * 3.2;
    this.controls.target.copy(center);
    this.applyView(0.5, 0.3, distance, true);
  }

  private applyView(
    azimuth: number,
    elevation: number,
    distance: number,
    resetTarget: boolean,
  ): void {
    if (!this.home) return;
    const direction = new THREE.Vector3(
      Math.sin(azimuth) * Math.cos(elevation),
      Math.sin(elevation),
      -Math.cos(azimuth) * Math.cos(elevation),
    );
    if (resetTarget) this.controls.target.copy(this.home.center);
    this.camera.position.copy(this.controls.target).addScaledVector(direction, distance);
    this.controls.update();
    this.requestRender();
  }

  resetView(): void {
    if (!this.home) return;
    this.userMoved = false;
    this.frameModel();
  }

  setLabelOptions(mode: LabelMode, categories: Set<string> | null): void {
    this.labelMode = mode;
    this.labelCategories = categories;
    this.layoutLabels();
    this.requestRender();
  }

  setHeatmap(enabled: boolean): void {
    this.heatmap = enabled;
    for (const part of this.parts) {
      if (enabled) {
        if (!part.heatMaterial) {
          const color = this.getPriceColor(part.data.price);
          part.heatMaterial = new THREE.MeshStandardMaterial({
            color,
            roughness: 0.45,
            metalness: 0.1,
            transparent: part.data.price === null,
            opacity: part.data.price === null ? 0.35 : 1,
          });
        }
        part.activeMaterial = part.heatMaterial;
      } else {
        part.activeMaterial = part.originalMaterial;
      }
      if (part !== this.selected) part.object.material = part.activeMaterial;
    }
    if (this.selected) this.applySelection(this.selected.data);
    this.requestRender();
  }

  private getPriceColor(price: number | null): THREE.Color {
    if (price === null) return new THREE.Color(0x6b7280);
    const [minimum, maximum] = this.priceRange;
    const t = maximum === minimum ? 0 : THREE.MathUtils.clamp(
      Math.log(Math.max(price, minimum) / minimum) / Math.log(maximum / minimum),
      0,
      1,
    );
    return new THREE.Color().setHSL((1 - t) * 0.58, 0.8, 0.5);
  }

  select(name: string | null): void {
    this.applySelection(name ? this.partsByName.get(name)?.data ?? null : null);
  }

  private applySelection(data: Part | null): void {
    this.deselectInternal();
    if (!data) {
      this.requestRender();
      return;
    }
    const part = this.partsByName.get(data.name);
    if (!part) return;
    this.selected = part;
    const base = part.activeMaterial;
    part.selectedMaterial = Array.isArray(base)
      ? base.map((material) => material.clone())
      : base.clone();
    for (const material of Array.isArray(part.selectedMaterial)
      ? part.selectedMaterial
      : [part.selectedMaterial]) {
      if (material instanceof THREE.MeshStandardMaterial) {
        material.emissive.set(this.accent);
        material.emissiveIntensity = 0.9;
      }
    }
    part.object.material = part.selectedMaterial;
    this.helper = new THREE.BoxHelper(part.object, this.accent);
    this.scene.add(this.helper);
    this.requestRender();
  }

  private deselectInternal(): void {
    if (this.selected) {
      this.selected.object.material = this.selected.activeMaterial;
      if (this.selected.selectedMaterial) disposeMaterial(this.selected.selectedMaterial);
      this.selected.selectedMaterial = null;
      this.selected = null;
    }
    if (this.helper) {
      this.scene.remove(this.helper);
      this.helper.geometry.dispose();
      (this.helper.material as THREE.Material).dispose();
      this.helper = null;
    }
  }

  private pick(event: PointerEvent): void {
    if (!this.parts.length) return;
    const bounds = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.parts.map((part) => part.object), false);
    const preferred = hits.find((hit) => {
      const part = this.parts.find((entry) => entry.object === hit.object);
      return part?.data.role !== 'lens';
    }) ?? hits[0];
    const part = preferred && this.parts.find((entry) => entry.object === preferred.object);
    this.callbacks.onPick(part?.data ?? null);
  }

  private layoutLabels(): void {
    for (const part of this.parts) {
      part.label.style.display = 'none';
      part.line.style.display = 'none';
      part.dot.style.display = 'none';
    }
    if (this.labelMode === 'off') {
      this.callbacks.onDenseLabels(false);
      return;
    }
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    const projected: Array<{ part: ViewerPart; x: number; y: number }> = [];
    for (const part of this.parts) {
      if (this.labelCategories && !this.labelCategories.has(part.data.category)) continue;
      const point = part.center.clone();
      part.object.localToWorld(point);
      point.project(this.camera);
      if (point.z > 1) continue;
      const x = ((point.x + 1) / 2) * width;
      const y = ((1 - point.y) / 2) * height;
      if (x < 0 || x > width || y < 0 || y > height) continue;
      projected.push({ part, x, y });
    }
    const capacity = 2 * Math.floor((height - 16) / 20);
    const showNames = this.labelMode === 'names' && projected.length <= capacity;
    this.callbacks.onDenseLabels(this.labelMode === 'names' && !showNames);
    if (!showNames) {
      for (const item of projected) {
        const { part, x, y } = item;
        part.label.className = `part-label id-label${part === this.selected ? ' selected' : ''}`;
        part.label.style.display = 'flex';
        part.label.style.left = `${x}px`;
        part.label.style.top = `${y}px`;
        part.label.style.right = 'auto';
        part.line.style.display = 'none';
        part.dot.style.display = '';
      }
      return;
    }

    const place = (items: typeof projected, side: 'left' | 'right') => {
      items.sort((a, b) => a.y - b.y);
      const ys = items.map((item) => item.y);
      for (let index = 0; index < ys.length; index += 1) {
        ys[index] = Math.max(ys[index], index ? ys[index - 1] + 20 : 12);
      }
      for (let index = ys.length - 1; index >= 0; index -= 1) {
        ys[index] = Math.min(ys[index], index < ys.length - 1 ? ys[index + 1] - 20 : height - 12);
      }
      for (let index = 0; index < ys.length; index += 1) {
        ys[index] = Math.max(ys[index], index ? ys[index - 1] + 20 : 12);
      }
      items.forEach(({ part, x, y }, index) => {
        const labelY = ys[index];
        part.label.className = `part-label ${side}${part === this.selected ? ' selected' : ''}`;
        part.label.style.display = 'flex';
        part.label.style.top = `${labelY - 9}px`;
        part.label.style.left = side === 'left' ? '8px' : 'auto';
        part.label.style.right = side === 'right' ? '8px' : 'auto';
        const edgeX = side === 'left' ? 244 : width - 244;
        part.line.setAttribute('x1', String(edgeX));
        part.line.setAttribute('y1', String(labelY));
        part.line.setAttribute('x2', String(x));
        part.line.setAttribute('y2', String(y));
        part.dot.setAttribute('cx', String(x));
        part.dot.setAttribute('cy', String(y));
        part.line.style.display = '';
        part.dot.style.display = '';
      });
    };
    place(projected.filter((item) => item.x < width / 2), 'left');
    place(projected.filter((item) => item.x >= width / 2), 'right');
  }

  private clearModel(invalidateLoad = true): void {
    if (invalidateLoad) this.loadGeneration += 1;
    this.animating = false;
    this.explosionGoal = this.explosion;
    this.deselectInternal();
    for (const part of this.parts) {
      part.object.material = part.originalMaterial;
      part.heatMaterial?.dispose();
      part.label.remove();
      part.line.remove();
      part.dot.remove();
    }
    this.parts.length = 0;
    this.partsByName.clear();
    if (this.model) {
      this.scene.remove(this.model);
      disposeObject(this.model);
      this.model = null;
    }
    this.home = null;
    this.callbacks.onDenseLabels(false);
    this.requestRender();
  }

  dispose(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.loadGeneration += 1;
    if (this.frameRequest !== null) cancelAnimationFrame(this.frameRequest);
    if (this.explosionFrame !== null) cancelAnimationFrame(this.explosionFrame);
    this.resizeObserver.disconnect();
    this.intersectionObserver.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.controls.removeEventListener('change', this.onChange);
    this.controls.removeEventListener('start', this.onStart);
    this.controls.dispose();
    this.clearModel(false);
    this.scene.environment?.dispose();
    this.renderer.dispose();
    this.overlay.replaceChildren();
  }
}
