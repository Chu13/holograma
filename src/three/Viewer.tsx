import { Suspense, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { AdaptiveDpr, AdaptiveEvents, ContactShadows, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useInViewport } from "@/lib/useInViewport";
import {
  usePrefersReducedData,
  usePrefersReducedMotion,
  useWebglSupported,
} from "@/lib/useMediaPreferences";
import { Model, type ViewMode } from "@/three/Model";
import { Hotspots } from "@/three/Hotspots";
import { CameraFit, type ModelBounds } from "@/three/CameraFit";
import { ProceduralEnvironment } from "@/three/ProceduralEnvironment";
import { HdriEnvironment } from "@/three/HdriEnvironment";
import type { DiamondQualityTier } from "@/three/DiamondMesh";
import type { Hotspot } from "@/data/models";
import "@/three/Viewer.css";

// One fixed diamond quality tier, not two — empirically tuned against
// CHIARA + brown_photostudio_02 via real screenshots (not guessed), and
// deliberately conservative rather than adaptive:
// - `bounces: 1`: more internal ray bounces made the gem progressively
//   darker, not more detailed, for this specific faceted geometry/HDRI
//   pairing (each extra bounce statistically samples more of the HDRI's
//   darker regions before exiting) — tested up to 3, 1 looked best.
// - `aberrationStrength: 0`: tested a nonzero "desktop" dispersion tier
//   (0.03 + fastChroma:false) and it reintroduced the same near-black
//   rendering — a real, verified interaction, not yet root-caused. Chasing
//   it further risked shipping nothing; a correct, bright, non-dispersive
//   gem beats a broken dispersive one. Worth revisiting.
// PerformanceMonitor/AdaptiveDpr/AdaptiveEvents (below) still matter for
// overall scene performance — this tier just isn't wired to them for now.
const DIAMOND_TIER: DiamondQualityTier = { bounces: 1, aberrationStrength: 0, fastChroma: true };

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

// Default shadow footprint before any model has reported its real bounding
// box (first frame only) — roughly CHIARA-sized so there's no visible pop.
const DEFAULT_SHADOW_BOUNDS: ModelBounds = {
  center: new THREE.Vector3(0, 0, 0),
  size: new THREE.Vector3(2.5, 3, 0.65),
  min: new THREE.Vector3(-1.25, -1.5, -0.32),
};

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
  const [shadowBounds, setShadowBounds] = useState<ModelBounds>(DEFAULT_SHADOW_BOUNDS);
  // Deliberately starts (and stays) null until HdriEnvironment's real HDRI
  // resolves — NOT fed by ProceduralEnvironment's earlier procedural
  // texture. This is passed to Model as the diamond's refraction envMap,
  // and DiamondMesh's MeshRefractionMaterial must only ever be created
  // once, with its final envMap (see Model.tsx/DiamondMesh.tsx comments —
  // swapping envMap on an already-compiled instance hit a real, verified
  // three.js/drei shader-recompile bug). Scene-wide lighting still starts
  // immediately via ProceduralEnvironment mutating scene.environment
  // directly — this state is only ever used for the diamond's material.
  const [envTexture, setEnvTexture] = useState<THREE.Texture | null>(null);

  // Poster-first is the whole point: no WebGL, "reduced data", or simply
  // not yet scrolled into view all render the same static fallback — the
  // three.js/R3F bundle for the actual canvas never even loads until it's
  // needed. Every one of these carries real alt text, never a bare image.
  const showCanvas = inView && webglSupported && !reducedData;

  // Derived from CameraFit's real bounding box (via onFit below) instead of
  // CHIARA-specific magic numbers, so the ground shadow actually sits under
  // whatever model is loaded — the gallery's own model or an arbitrary
  // drag-dropped one at a wildly different scale.
  const shadowScale = Math.max(shadowBounds.size.x, shadowBounds.size.z, 0.5) * 4.5;
  const shadowFar = Math.max(shadowBounds.size.y, 0.5) * 1.3;

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
            gl={{
              antialias: true,
              // Explicit, not implicit: R3F already defaults the first two,
              // but pin them so a future R3F upgrade can't silently change
              // how CHIARA's bare (texture-free) PBR materials read. R3F
              // applies non-constructor renderer properties like these
              // directly onto the created WebGLRenderer instance.
              toneMapping: THREE.ACESFilmicToneMapping,
              toneMappingExposure: 1,
              outputColorSpace: THREE.SRGBColorSpace,
            }}
          >
            {/* Ambient kept low on purpose — with the real HDRI (below) as
                the primary light source, more ambient just washes out the
                reflections that are CHIARA's only source of surface detail. */}
            <ambientLight intensity={0.15} />
            <ProceduralEnvironment />
            <Suspense fallback={null}>
              <HdriEnvironment onReady={setEnvTexture} />
            </Suspense>

            {/* R3F's own (built-in, distinct from drei's separate fps-
                sampling PerformanceMonitor) interaction-driven performance
                regression: drops resolution/raycasting during camera
                movement (OrbitControls) and restores it at rest. */}
            <AdaptiveDpr pixelated />
            <AdaptiveEvents />

            <Model
              url={glbUrl}
              viewMode={viewMode}
              explodeAmount={explodeAmount}
              envMap={envTexture}
              diamondTier={DIAMOND_TIER}
              onReady={(root) => {
                setLoadedRoot(root);
                onModelReady?.(root);
              }}
            />

            {hotspots.length > 0 && onHotspotSelect && (
              <Hotspots hotspots={hotspots} activeId={activeHotspotId} onSelect={onHotspotSelect} />
            )}

            <ContactShadows
              position={[shadowBounds.center.x, shadowBounds.min.y, shadowBounds.center.z]}
              opacity={0.5}
              scale={shadowScale}
              blur={2.4}
              far={shadowFar}
              frames={1}
            />

            <CameraFit root={loadedRoot} controlsRef={controlsRef} onFit={setShadowBounds} />
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
