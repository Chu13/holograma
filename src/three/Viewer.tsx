import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import {
  AdaptiveDpr,
  AdaptiveEvents,
  ContactShadows,
  OrbitControls,
  PerformanceMonitor,
} from "@react-three/drei";
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

// Two tiers, chosen by PerformanceMonitor's measured fps factor (0-1) — but
// ONLY `bounces` differs between them. This is load-bearing, not stylistic:
// drei's MeshRefractionMaterial wrapper derives a shader `defines` object
// from `aberrationStrength`/`fastChroma` (CHROMATIC_ABERRATIONS/FAST_CHROMA)
// and keys the rendered element on `JSON.stringify(defines)` (see
// node_modules/@react-three/drei/core/MeshRefractionMaterial.js). An
// earlier version of this file varied `aberrationStrength` between tiers
// (0 on mobile, 0.04 on desktop) — every time PerformanceMonitor's factor
// crossed the 0.7 threshold, that flipped `aberrationStrength` across zero,
// which flipped the CHROMATIC_ABERRATIONS define, which changed the `key`,
// which made React unmount+remount the material. Remounting reruns the
// `useLayoutEffect(..., [])` that rebuilds the refraction BVH from a clone
// of the ~132K-triangle geometry — for the frame(s) that takes, the diamond
// has no BVH and renders black/invisible, and the resulting frame-time hit
// pushes the fps factor down further, causing more crossings: a visible
// "parts disappear after a while" thrashing loop on the live web viewer.
//
// Fix: keep `aberrationStrength` and `fastChroma` — and therefore `defines`
// and `key` — constant across both tiers, so the material is created once
// and never remounted. Only `bounces` is a plain shader *uniform* (updated
// in place every frame by the wrapper's `useFrame`, no remount), so it's
// the only thing safe to drive from PerformanceMonitor.
const MOBILE_TIER: DiamondQualityTier = { bounces: 1, aberrationStrength: 0.03, fastChroma: true };
const DESKTOP_TIER: DiamondQualityTier = { bounces: 2, aberrationStrength: 0.03, fastChroma: true };

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
  const [qualityFactor, setQualityFactor] = useState(1);
  const diamondTier = useMemo(
    () => (qualityFactor >= 0.7 ? DESKTOP_TIER : MOBILE_TIER),
    [qualityFactor],
  );

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

            {/* drei's fps-sampling PerformanceMonitor drives the diamond's
                quality tier (above). R3F's own, separate, built-in
                interaction-driven performance regression — AdaptiveDpr/
                AdaptiveEvents — drops resolution/raycasting during camera
                movement (OrbitControls) and restores it at rest; the two
                mechanisms are independent and both useful. */}
            <PerformanceMonitor onChange={({ factor }) => setQualityFactor(factor)} />
            <AdaptiveDpr pixelated />
            <AdaptiveEvents />

            <Model
              url={glbUrl}
              viewMode={viewMode}
              explodeAmount={explodeAmount}
              envMap={envTexture}
              diamondTier={diamondTier}
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
