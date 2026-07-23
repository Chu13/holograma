import { Suspense, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import type * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useInViewport } from "@/lib/useInViewport";
import {
  usePrefersReducedData,
  usePrefersReducedMotion,
  useWebglSupported,
} from "@/lib/useMediaPreferences";
import { Model, type ViewMode } from "@/three/Model";
import { Hotspots } from "@/three/Hotspots";
import { CameraFit } from "@/three/CameraFit";
import { ProceduralEnvironment } from "@/three/ProceduralEnvironment";
import type { Hotspot } from "@/data/models";
import "@/three/Viewer.css";

export type ViewerProps = {
  glbUrl: string;
  /** Omit for a freshly dropped model — there's no pre-rendered poster for it. */
  posterUrl?: string;
  posterAlt: string;
  viewMode?: ViewMode;
  explodeAmount?: number;
  hotspots?: Hotspot[];
  activeHotspotId?: string | null;
  onHotspotSelect?: (id: string) => void;
  /** Bubbles up the loaded, Draco-decoded scene graph — e.g. for runtime USDZ export of a dropped model. */
  onModelReady?: (root: THREE.Object3D) => void;
};

function Poster({ posterUrl, posterAlt }: { posterUrl?: string; posterAlt: string }) {
  if (posterUrl) {
    return <img className="viewer__poster" src={posterUrl} alt={posterAlt} loading="lazy" />;
  }
  return (
    <div className="viewer__poster viewer__poster--placeholder" role="img" aria-label={posterAlt}>
      Loading model…
    </div>
  );
}

export function Viewer({
  glbUrl,
  posterUrl,
  posterAlt,
  viewMode = "solid",
  explodeAmount = 0,
  hotspots = [],
  activeHotspotId = null,
  onHotspotSelect,
  onModelReady,
}: ViewerProps) {
  const { ref: containerRef, inView } = useInViewport<HTMLDivElement>();
  const webglSupported = useWebglSupported();
  const reducedMotion = usePrefersReducedMotion();
  const reducedData = usePrefersReducedData();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const [loadedRoot, setLoadedRoot] = useState<THREE.Object3D | null>(null);

  // Poster-first is the whole point: no WebGL, "reduced data", or simply
  // not yet scrolled into view all render the same static fallback — the
  // three.js/R3F bundle for the actual canvas never even loads until it's
  // needed. Every one of these carries real alt text, never a bare image.
  const showCanvas = inView && webglSupported && !reducedData;

  return (
    <div ref={containerRef} className="viewer">
      {!showCanvas && <Poster posterUrl={posterUrl} posterAlt={posterAlt} />}

      {showCanvas && (
        <Suspense fallback={<Poster posterUrl={posterUrl} posterAlt={posterAlt} />}>
          <Canvas
            className="viewer__canvas"
            tabIndex={0}
            aria-label={posterAlt}
            camera={{ position: [0, 0.6, 3], fov: 40 }}
            dpr={[1, 2]}
            gl={{ antialias: true }}
          >
            <ambientLight intensity={0.35} />
            <ProceduralEnvironment />

            <Model
              url={glbUrl}
              viewMode={viewMode}
              explodeAmount={explodeAmount}
              onReady={(root) => {
                setLoadedRoot(root);
                onModelReady?.(root);
              }}
            />

            {hotspots.length > 0 && onHotspotSelect && (
              <Hotspots hotspots={hotspots} activeId={activeHotspotId} onSelect={onHotspotSelect} />
            )}

            <ContactShadows position={[0, -1, 0]} opacity={0.5} scale={12} blur={2.4} far={4} />

            <CameraFit root={loadedRoot} controlsRef={controlsRef} />
            <OrbitControls
              ref={controlsRef}
              enableDamping
              dampingFactor={0.08}
              autoRotate={!reducedMotion}
              autoRotateSpeed={0.6}
              keyEvents
            />
          </Canvas>
        </Suspense>
      )}
    </div>
  );
}
