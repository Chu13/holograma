import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { useEnvironment } from "@react-three/drei";
import type * as THREE from "three";

export type HdriEnvironmentProps = {
  /** Fires once, when the real HDRI has loaded and scene.environment has been swapped to it. */
  onReady: (texture: THREE.Texture) => void;
};

/**
 * Real studio HDRI, layered on top of ProceduralEnvironment's instant
 * fallback. Self-hosted (Poly Haven, CC0, "brown_photostudio_02", 2K,
 * plain .hdr — see public/hdri/README.md for licensing/attribution and why
 * 2K plain .hdr over a gainmap .webp) — never drei's `preset` prop, which
 * pulls from a CDN drei's own docs call "not meant for production."
 *
 * Uses drei's `useEnvironment` hook directly rather than the `<Environment>`
 * component: `<Environment>` sets `scene.environment` internally but never
 * hands the resolved texture back out, and `three/DiamondMesh.tsx`'s
 * `MeshRefractionMaterial` needs that exact texture object as a prop
 * (`scene.environment` mutating imperatively doesn't trigger a React
 * re-render, so anything downstream that only reads `scene.environment`
 * once would silently keep using a stale/null envMap forever). The
 * `onReady` callback lets the resolved texture flow back up through normal
 * React state (see three/Viewer.tsx) instead.
 *
 * CHIARA has zero texture maps — every bit of surface detail is IBL
 * reflection on bare PBR factors, so the *content* of the HDRI (crisp,
 * separated bright light sources, not a flat even wash) matters more here
 * than in a textured scene. `scene.environment` only, no `scene.background`
 * — light the model, keep the app's own dark UI behind it.
 *
 * Rendered inside its own <Suspense fallback={null}> in Viewer.tsx, as a
 * sibling to the model — not a boundary the model waits on. Until this
 * resolves, ProceduralEnvironment's PMREM env keeps lighting the scene;
 * once it resolves, this overwrites `scene.environment` and calls
 * `onReady`. Progressive enhancement, never a blank/unlit flash.
 */
export function HdriEnvironment({ onReady }: HdriEnvironmentProps) {
  const texture = useEnvironment({ files: "brown_photostudio_02_2k.hdr", path: "/hdri/" });
  const scene = useThree((state) => state.scene);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    scene.environment = texture;
    onReadyRef.current(texture);
    // texture itself is cached/disposed by drei's useEnvironment — this
    // effect only needs to re-run if the resolved texture instance changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texture, scene]);

  return null;
}
