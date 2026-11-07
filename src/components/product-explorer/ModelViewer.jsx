import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const ASSET_ROOT = `${import.meta.env.BASE_URL}SIGNLINK_3D_Concepts_v2`;
const COMPONENT_NAME = /^(\d{2}) \| (.+)$/;
const loader = new GLTFLoader();
let referencePromise;

async function fetchJsonAsset(path, label) {
  let response;
  try {
    response = await fetch(path, { cache: 'no-cache' });
  } catch (error) {
    throw new Error(
      `Network request failed while loading ${label} at ${path}. ` +
      'Confirm the Vite server is running and the asset exists under public/SIGNLINK_3D_Concepts_v2. ' +
      `Original error: ${error?.message || error}`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `Unable to load ${label}: HTTP ${response.status} ${response.statusText} at ${path}. ` +
      'Check the extracted asset folder and its filename casing.',
    );
  }

  try {
    return await response.json();
  } catch (error) {
    throw new Error(
      `The ${label} response at ${path} was not valid JSON. ` +
      `Original error: ${error?.message || error}`,
    );
  }
}

function getReferences() {
  if (!referencePromise) {
    referencePromise = Promise.all([
      fetchJsonAsset(`${ASSET_ROOT}/reference/threejs_explode_manifest.json`, 'the exploded-view manifest'),
      fetchJsonAsset(`${ASSET_ROOT}/reference/all_components.json`, 'the component catalog'),
    ]).then(([manifest, components]) => ({ manifest: manifest.products, components }))
      .catch((error) => {
        referencePromise = undefined;
        throw error;
      });
  }
  return referencePromise;
}

function disposeMaterial(material, disposeTextures = false) {
  const materials = Array.isArray(material) ? material : [material];
  materials.forEach((entry) => {
    if (!entry) return;
    if (disposeTextures) {
      Object.values(entry).forEach((value) => {
        if (value?.isTexture) value.dispose();
      });
    }
    entry.dispose();
  });
}

function disposeModel(root) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();

  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    objectMaterials.filter(Boolean).forEach((material) => {
      materials.add(material);
      Object.values(material).forEach((value) => {
        if (value?.isTexture) textures.add(value);
      });
    });
  });

  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
}

function localOffsetForWorldOffset(parent, offset) {
  parent.updateWorldMatrix(true, false);
  const inverse = new THREE.Matrix4().copy(parent.matrixWorld).invert();
  const localOffset = offset.clone().applyMatrix4(inverse);
  const localOrigin = new THREE.Vector3().applyMatrix4(inverse);
  return localOffset.sub(localOrigin);
}

class ProductScene {
  constructor(canvas, callbacks, isHero) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.isHero = isHero;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.001, 100);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene.add(new THREE.HemisphereLight(0xdce9ff, 0x111827, 2.1));

    const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
    keyLight.position.set(1.5, 2.4, -2.2);
    const fillLight = new THREE.DirectionalLight(0x87b6ff, 1.7);
    fillLight.position.set(-2.2, 0.5, 2);
    const rimLight = new THREE.DirectionalLight(0x8af2e6, 1.4);
    rimLight.position.set(0, 1.2, 3);
    this.scene.add(keyLight, fillLight, rimLight);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.09;
    this.controls.screenSpacePanning = true;
    if (isHero) {
      this.controls.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.controls.autoRotateSpeed = 0.7;
      this.controls.enableZoom = false;
      this.controls.enablePan = false;
    }
    this.controls.minDistance = 0.04;
    this.controls.maxDistance = 1.5;
    this.controls.addEventListener('change', this.handleChange);

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.parts = [];
    this.selected = null;
    this.explosion = 0;
    this.explosionGoal = 0;
    this.explosionFrame = null;
    this.modelToken = 0;
    this.frameRequest = null;
    this.visible = false;
    this.destroyed = false;
    this.userMoved = false;
    this.handleVisibility = () => this.updateVisibility();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement);
    this.intersectionObserver = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      this.updateVisibility();
    }, { rootMargin: '120px' });
    this.intersectionObserver.observe(canvas.parentElement);
    document.addEventListener('visibilitychange', this.handleVisibility);
    this.pointerDown = null;
    this.handlePointerDown = (event) => {
      this.pointerDown = { x: event.clientX, y: event.clientY };
    };
    this.handlePointerUp = (event) => {
      if (!this.pointerDown) return;
      const distance = Math.hypot(
        event.clientX - this.pointerDown.x,
        event.clientY - this.pointerDown.y,
      );
      this.pointerDown = null;
      if (distance < 7) this.pick(event);
    };
    this.handleInteractionStart = () => { this.userMoved = true; };
    if (!isHero) {
      canvas.addEventListener('pointerdown', this.handlePointerDown);
      canvas.addEventListener('pointerup', this.handlePointerUp);
    }
    this.controls.addEventListener('start', this.handleInteractionStart);
    this.resize();
  }

  handleChange = () => this.requestFrame();

  updateVisibility() {
    if (this.visible && !document.hidden) {
      if (Math.abs(this.explosionGoal - this.explosion) > 0.001 && this.explosionFrame === null) {
        this.runExplosionAnimation();
      }
      this.requestFrame();
    } else {
      if (this.explosionFrame !== null) cancelAnimationFrame(this.explosionFrame);
      this.explosionFrame = null;
    }
    if ((!this.visible || document.hidden) && this.frameRequest !== null) {
      cancelAnimationFrame(this.frameRequest);
      this.frameRequest = null;
    }
  }

  requestFrame() {
    if (this.destroyed || !this.visible || document.hidden || this.frameRequest !== null) return;
    this.frameRequest = requestAnimationFrame(this.renderFrame);
  }

  renderFrame = (time) => {
    this.frameRequest = null;
    if (this.destroyed || !this.visible || document.hidden) return;

    const controlsChanged = this.controls.update();
    if (controlsChanged || this.selected?.helper) this.selected?.helper?.update();
    this.renderer.render(this.scene, this.camera);

    if (controlsChanged) this.requestFrame();
  };

  resize() {
    const parent = this.canvas.parentElement;
    const width = parent?.clientWidth ?? 0;
    const height = parent?.clientHeight ?? 0;
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    if (this.model && !this.userMoved) this.frameModel();
    this.requestFrame();
  }

  async load(productKey) {
    this.clearModel(false);
    const token = ++this.modelToken;
    this.callbacks.current.onLoading?.();

    const modelUrl = `${ASSET_ROOT}/models/SIGNLINK_${productKey}_Assembled.glb`;
    const modelPromise = loader.loadAsync(
      modelUrl,
      (event) => {
        if (token !== this.modelToken) return;
        const progress = event.total > 0 ? event.loaded / event.total : null;
        this.callbacks.current.onProgress?.(progress);
      },
    ).catch((error) => {
      throw new Error(`Failed to fetch the SIGNLINK ${productKey} assembled model at ${modelUrl}. Confirm the GLB is present in public/SIGNLINK_3D_Concepts_v2/models and that the app is running through the Vite dev server. Original error: ${error?.message || error}`);
    });
    const [modelResult, referenceResult] = await Promise.allSettled([
      modelPromise,
      getReferences(),
    ]);
    const gltf = modelResult.status === 'fulfilled' ? modelResult.value : null;

    if (this.destroyed || token !== this.modelToken) {
      if (gltf) disposeModel(gltf.scene);
      return;
    }
    if (modelResult.status === 'rejected') throw modelResult.reason;
    if (referenceResult.status === 'rejected') {
      disposeModel(gltf.scene);
      throw referenceResult.reason;
    }

    const references = referenceResult.value;
    const manifest = references.manifest[productKey];
    const components = references.components[productKey];
    if (!manifest || !components) {
      disposeModel(gltf.scene);
      throw new Error(`No component reference data was found for SIGNLINK ${productKey}.`);
    }

    const componentByName = new Map(components.map((component) => [component.name, component]));
    this.model = gltf.scene;
    this.scene.add(this.model);
    this.model.updateMatrixWorld(true);
    this.parts = [];

    this.model.traverse((object) => {
      if (!object.isMesh) return;
      const rawName = object.userData.name || object.name.replace(/_/g, ' ');
      const match = COMPONENT_NAME.exec(rawName);
      if (!match) return;

      const [, id, name] = match;
      const manifestPart = manifest[name];
      const referencePart = componentByName.get(name);
      if (!manifestPart || !referencePart || manifestPart.componentId !== id || referencePart.id !== id) {
        return;
      }

      this.parts.push({
        id,
        name,
        description: referencePart.description,
        role: referencePart.role,
        explodedOffset: [...manifestPart.explodedOffsetMeters],
        offset: localOffsetForWorldOffset(
          object.parent,
          new THREE.Vector3(...manifestPart.explodedOffsetMeters),
        ),
        originalPosition: object.position.clone(),
        originalMaterial: object.material,
        object,
      });
    });

    if (this.parts.length !== components.length) {
      const matchedCount = this.parts.length;
      this.scene.remove(this.model);
      disposeModel(this.model);
      this.model = null;
      throw new Error(`Matched ${matchedCount} of ${components.length} named meshes in the SIGNLINK ${productKey} model.`);
    }

    this.parts.sort((first, second) => first.id.localeCompare(second.id));
    this.byName = new Map(this.parts.map((part) => [part.name, part]));
    this.userMoved = false;
    this.setExplosion(0);
    this.explosionGoal = 0;
    this.frameModel();
    this.callbacks.current.onParts?.(this.parts);
    this.callbacks.current.onLoaded?.();
    this.requestFrame();
  }

  frameModel(wake = false) {
    if (!this.model) return;
    if (wake) this.visible = true;

    // Fit the camera to both assembled and fully exploded bounds so components
    // remain in view throughout the entire explosion slider range.
    this.model.updateMatrixWorld(true);
    const assembledBounds = new THREE.Box3().setFromObject(this.model);
    const currentPositions = this.parts.map((part) => part.object.position.clone());
    this.parts.forEach((part) => {
      part.object.position.copy(part.originalPosition).add(part.offset);
    });
    this.model.updateMatrixWorld(true);
    const explodedBounds = new THREE.Box3().setFromObject(this.model);
    this.parts.forEach((part, index) => {
      part.object.position.copy(currentPositions[index]);
    });
    this.model.updateMatrixWorld(true);

    const bounds = assembledBounds.union(explodedBounds);
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    const center = bounds.getCenter(new THREE.Vector3());
    const verticalFov = THREE.MathUtils.degToRad(this.camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * this.camera.aspect);
    const distance = (sphere.radius / Math.sin(Math.min(verticalFov, horizontalFov) / 2)) * 1.02;
    const direction = new THREE.Vector3(0.65, 0.38, -1).normalize();

    this.camera.position.copy(center).addScaledVector(direction, distance);
    this.camera.near = Math.max(distance / 100, 0.001);
    this.camera.far = distance * 100;
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(center);
    this.controls.minDistance = Math.max(distance * 0.25, 0.01);
    this.controls.maxDistance = distance * 3.2;
    this.controls.update();
    this.requestFrame();
  }

  setExplosion(value, wake = false) {
    if (wake) {
      this.visible = true;
      if (this.explosionFrame !== null) cancelAnimationFrame(this.explosionFrame);
      this.explosionFrame = null;
      this.explosionGoal = THREE.MathUtils.clamp(value, 0, 1);
    }
    this.explosion = THREE.MathUtils.clamp(value, 0, 1);
    this.parts.forEach((part) => {
      part.object.position.copy(part.originalPosition);
      part.object.position.addScaledVector(part.offset, this.explosion);
    });
    this.callbacks.current.onAmount?.(this.explosion);
    this.requestFrame();
  }

  animateExplosion(goal) {
    this.visible = true;
    this.explosionGoal = THREE.MathUtils.clamp(goal, 0, 1);
    if (this.explosionFrame !== null) cancelAnimationFrame(this.explosionFrame);
    this.explosionFrame = null;
    this.runExplosionAnimation();
  }

  runExplosionAnimation() {
    if (this.destroyed || !this.visible || document.hidden) return;
    const start = this.explosion;
    const target = this.explosionGoal;
    const beganAt = performance.now();
    const duration = 720;
    const step = (time) => {
      if (this.destroyed || !this.visible || document.hidden) {
        this.explosionFrame = null;
        return;
      }
      const progress = Math.min((time - beganAt) / duration, 1);
      const eased = progress * progress * (3 - 2 * progress);
      this.setExplosion(start + (target - start) * eased);
      if (progress < 1) this.explosionFrame = requestAnimationFrame(step);
      else {
        this.setExplosion(target);
        this.explosionFrame = null;
      }
    };
    this.explosionFrame = requestAnimationFrame(step);
  }

  setSelected(name) {
    this.visible = true;
    const part = name ? this.byName?.get(name) : null;
    if (this.selected === part) return;
    this.clearSelection();
    if (!part) {
      this.callbacks.current.onSelect?.(null);
      this.requestFrame();
      return;
    }

    const cloneHighlight = (material) => {
      const highlight = material.clone();
      if (highlight.emissive) {
        highlight.emissive.set(this.callbacks.current.accent);
        highlight.emissiveIntensity = 0.9;
      }
      return highlight;
    };
    part.object.material = Array.isArray(part.originalMaterial)
      ? part.originalMaterial.map(cloneHighlight)
      : cloneHighlight(part.originalMaterial);
    part.highlightMaterial = part.object.material;
    part.helper = new THREE.BoxHelper(part.object, this.callbacks.current.accent);
    this.scene.add(part.helper);
    this.selected = part;
    this.callbacks.current.onSelect?.(part);
    this.requestFrame();
  }

  clearSelection() {
    if (!this.selected) return;
    this.selected.object.material = this.selected.originalMaterial;
    disposeMaterial(this.selected.highlightMaterial);
    if (this.selected.helper) {
      this.scene.remove(this.selected.helper);
      this.selected.helper.geometry.dispose();
      disposeMaterial(this.selected.helper.material);
    }
    this.selected = null;
  }

  pick(event) {
    if (!this.parts.length) return;
    const bounds = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersections = this.raycaster.intersectObjects(this.parts.map((part) => part.object), false);
    const hit = intersections.find((intersection) => this.byName.get(this.partName(intersection.object))?.role !== 'lens')
      ?? intersections[0];
    this.callbacks.current.onPick?.(hit ? this.partName(hit.object) : null);
  }

  partName(object) {
    const match = COMPONENT_NAME.exec(object.userData.name || object.name.replace(/_/g, ' '));
    return match?.[2];
  }

  clearModel(notify = true) {
    this.modelToken += 1;
    if (this.explosionFrame !== null) cancelAnimationFrame(this.explosionFrame);
    this.explosionFrame = null;
    this.explosion = 0;
    this.explosionGoal = 0;
    this.clearSelection();
    if (this.model) {
      this.scene.remove(this.model);
      disposeModel(this.model);
    }
    this.model = null;
    this.parts = [];
    this.byName = new Map();
    if (notify) {
      this.callbacks.current.onParts?.([]);
      this.callbacks.current.onAmount?.(0);
      this.callbacks.current.onSelect?.(null);
    }
  }

  destroy() {
    this.destroyed = true;
    this.modelToken += 1;
    if (this.frameRequest !== null) cancelAnimationFrame(this.frameRequest);
    this.clearModel(false);
    this.resizeObserver.disconnect();
    this.intersectionObserver.disconnect();
    document.removeEventListener('visibilitychange', this.handleVisibility);
    if (!this.isHero) {
      this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
      this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    }
    this.controls.removeEventListener('change', this.handleChange);
    this.controls.removeEventListener('start', this.handleInteractionStart);
    this.controls.dispose();
    this.renderer.dispose();
  }
}

export default function ModelViewer({
  productKey,
  accent,
  enabled,
  onLoading,
  onProgress,
  onLoaded,
  onError,
  onParts,
  onSelect,
  onAmount,
  onPick,
  sceneRef,
  isHero = false,
}) {
  const canvasRef = useRef(null);
  const callbacks = useRef({});
  callbacks.current = {
    accent,
    onLoading,
    onProgress,
    onLoaded,
    onError,
    onParts,
    onSelect,
    onAmount,
    onPick,
  };

  useEffect(() => {
    if (!canvasRef.current) return undefined;
    const scene = new ProductScene(canvasRef.current, callbacks, isHero);
    sceneRef.current = scene;
    return () => {
      sceneRef.current = null;
      scene.destroy();
    };
  }, [isHero, sceneRef]);

  useEffect(() => {
    if (!enabled || !sceneRef.current) return;
    sceneRef.current.load(productKey).catch((error) => {
      if (sceneRef.current) callbacks.current.onError?.(error);
    });
  }, [enabled, productKey, sceneRef]);

  return (
    <canvas
      className={`product-viewer-canvas${isHero ? ' hero-viewer-canvas' : ''}`}
      ref={canvasRef}
      aria-label={isHero
        ? 'Slowly rotating SIGNLINK Smart concept model'
        : 'Interactive 3D model. Drag to rotate, use the scroll wheel or pinch to zoom, and right-drag to pan.'}
      tabIndex="0"
    />
  );
}
