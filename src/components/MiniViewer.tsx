import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BASE } from '../lib/assets';

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

interface MiniViewerProps {
  path: string;
  label: string;
  onError: (message: string) => void;
}

export default function MiniViewer({ path, label, onError }: MiniViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    let disposed = false;
    let visible = false;
    let frame: number | null = null;
    let model: THREE.Group | null = null;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.0005, 2);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    const light = new THREE.DirectionalLight(0xffffff, 1.8);
    light.position.set(0.6, 0.9, -0.5);
    scene.add(light, new THREE.HemisphereLight(0xe4eeff, 0x182338, 0.8));
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2.5;
    controls.minDistance = 0.002;
    controls.maxDistance = 1;
    const resize = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !document.hidden && frame === null) {
        frame = requestAnimationFrame(render);
      } else if (!visible && frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
      }
    });
    intersectionObserver.observe(canvas);
    const onVisibilityChange = () => {
      if (document.hidden && frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
      } else if (!document.hidden && visible && frame === null) {
        frame = requestAnimationFrame(render);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    const render = () => {
      frame = null;
      if (disposed || !visible || document.hidden) return;
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    resize();

    void new GLTFLoader().loadAsync(`${BASE}${path}`).then((gltf) => {
      if (disposed) {
        disposeObject(gltf.scene);
        return;
      }
      model = gltf.scene;
      scene.add(model);
      const sphere = new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere());
      const distance = sphere.radius
        / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))
        * 1.05;
      controls.target.copy(sphere.center);
      camera.position.copy(sphere.center).add(
        new THREE.Vector3(0.7, 0.45, -1).normalize().multiplyScalar(distance),
      );
      camera.near = Math.max(distance / 50, 0.0005);
      camera.far = distance * 6;
      controls.maxDistance = distance * 2;
      camera.updateProjectionMatrix();
      if (visible && !document.hidden && frame === null) frame = requestAnimationFrame(render);
    }).catch((error: unknown) => {
      if (!disposed) {
        onError(`Unable to load the separate part model: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    return () => {
      disposed = true;
      if (frame !== null) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      controls.dispose();
      if (model) {
        scene.remove(model);
        disposeObject(model);
      }
      scene.environment?.dispose();
      renderer.dispose();
    };
  }, [label, onError, path]);

  return <canvas ref={canvasRef} className="mini-viewer" aria-label={`${label}, rotatable 3D part model`} />;
}
