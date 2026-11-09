import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import type { Part, ProductKey } from '../data/signlinkData';
import type { LabelMode } from '../three/Viewer';
import { Viewer } from '../three/Viewer';

export interface ExplorerViewerHandle {
  load: (product: ProductKey) => void;
  setExplosion: (value: number) => void;
  animateExplosion: (value: number) => void;
  pause: () => void;
  setAutoRotate: (enabled: boolean) => void;
  setView: (view: 'front' | 'side' | 'top' | 'threeQuarter') => void;
  setLabels: (mode: LabelMode, categories: Set<string> | null) => void;
  setHeatmap: (enabled: boolean) => void;
  select: (name: string | null) => void;
  resetView: () => void;
}

interface ExplorerViewerProps {
  product: ProductKey;
  productParts: Record<ProductKey, Part[]>;
  accent: string;
  labelMode: LabelMode;
  categories: Set<string>;
  heatmap: boolean;
  autoRotate: boolean;
  onLoading: () => void;
  onProgress: (progress: number | null) => void;
  onLoaded: () => void;
  onError: (error: Error) => void;
  onPick: (part: Part | null) => void;
  onExplosion: (value: number, animating: boolean) => void;
  onAutoRotate: (enabled: boolean) => void;
  onDenseLabels: (dense: boolean) => void;
}

const ExplorerViewer = forwardRef<ExplorerViewerHandle, ExplorerViewerProps>(
  function ExplorerViewer({
    product,
    productParts,
    accent,
    labelMode,
    categories,
    heatmap,
    autoRotate,
    onLoading,
    onProgress,
    onLoaded,
    onError,
    onPick,
    onExplosion,
    onAutoRotate,
    onDenseLabels,
  }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const labelsRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<Viewer | null>(null);
    const callbacksRef = useRef({
      onLoading,
      onProgress,
      onLoaded,
      onError,
      onPick,
      onExplosion,
      onAutoRotate,
      onDenseLabels,
    });
    callbacksRef.current = {
      onLoading,
      onProgress,
      onLoaded,
      onError,
      onPick,
      onExplosion,
      onAutoRotate,
      onDenseLabels,
    };

    useEffect(() => {
      const canvas = canvasRef.current;
      const labels = labelsRef.current;
      if (!canvas || !labels) return undefined;
      const viewer = new Viewer(canvas, labels, {
        onLoadStart: () => callbacksRef.current.onLoading(),
        onLoadProgress: (progress) => callbacksRef.current.onProgress(progress),
        onLoadComplete: () => callbacksRef.current.onLoaded(),
        onLoadError: (error) => callbacksRef.current.onError(error),
        onPick: (part) => callbacksRef.current.onPick(part),
        onExplosion: (value, animating) => callbacksRef.current.onExplosion(value, animating),
        onDenseLabels: (dense) => callbacksRef.current.onDenseLabels(dense),
        onAutoRotateChange: (enabled) => callbacksRef.current.onAutoRotate(enabled),
      });
      viewer.setProductData(productParts);
      viewerRef.current = viewer;
      return () => {
        viewer.dispose();
        viewerRef.current = null;
      };
    }, [productParts]);

    useImperativeHandle(ref, () => ({
      load: (key) => { void viewerRef.current?.load(key); },
      setExplosion: (value) => viewerRef.current?.setExplosion(value),
      animateExplosion: (value) => viewerRef.current?.animateExplosion(value),
      pause: () => viewerRef.current?.pause(),
      setAutoRotate: (enabled) => viewerRef.current?.setAutoRotate(enabled),
      setView: (view) => viewerRef.current?.setView(view),
      setLabels: (mode, categories) => viewerRef.current?.setLabelOptions(mode, categories),
      setHeatmap: (enabled) => viewerRef.current?.setHeatmap(enabled),
      select: (name) => viewerRef.current?.select(name),
      resetView: () => viewerRef.current?.resetView(),
    }), []);

    useEffect(() => {
      viewerRef.current?.setAccent(accent);
    }, [accent]);
    useEffect(() => {
      viewerRef.current?.setLabelOptions(labelMode, categories.size ? categories : null);
    }, [categories, labelMode]);
    useEffect(() => {
      viewerRef.current?.setHeatmap(heatmap);
    }, [heatmap]);
    useEffect(() => {
      viewerRef.current?.setAutoRotate(autoRotate);
    }, [autoRotate]);

    return (
      <div className="viewer-canvas-wrap">
        <canvas
          ref={canvasRef}
          className="viewer-canvas"
          tabIndex={0}
          aria-label="Interactive 3D model. Drag to rotate, scroll to zoom, and select a part."
        />
        <div ref={labelsRef} className="viewer-labels" />
      </div>
    );
  },
);

export default ExplorerViewer;
