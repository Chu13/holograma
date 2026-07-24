import { useEffect, useMemo, useRef, useState } from "react";
import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { parseGltfJson } from "@/inspect/extensions";
import {
  applyViewerFallbackDiamondMaterials,
  extractDiamondMaterialUuids,
  findDiamondMeshes,
  type DiamondMeshMatch,
} from "@/three/diamondMaterials";
import { DiamondMesh, type DiamondQualityTier } from "@/three/DiamondMesh";

// Self-hosted decoder — same files three's own examples vendor, copied into
// public/draco/. Never depend on drei's default CDN decoder: the viewer
// must keep working fully offline/self-contained (AR + iframe embedding
// both depend on this app never reaching out to a third party at runtime).
useGLTF.setDecoderPath("/draco/");

export type ViewMode = "solid" | "wireframe" | "normals" | "uv";

const DEFAULT_DIAMOND_TIER: DiamondQualityTier = {
  bounces: 2,
  aberrationStrength: 0.03,
  fastChroma: true,
};

const uvCheckerTexture = (() => {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const tiles = 8;
  const tileSize = size / tiles;
  for (let y = 0; y < tiles; y++) {
    for (let x = 0; x < tiles; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#D63BD6" : "#0E0814";
      ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
})();

type MeshEntry = {
  mesh: THREE.Mesh;
  originalMaterial: THREE.Material | THREE.Material[];
  basePosition: THREE.Vector3;
  explodeDirection: THREE.Vector3;
};

export type ModelProps = {
  url: string;
  viewMode?: ViewMode;
  /** 0 = assembled, 1 = fully exploded. */
  explodeAmount?: number;
  /**
   * The *final* HDRI environment map — deliberately null until
   * HdriEnvironment's real HDRI resolves (see Viewer.tsx), never the
   * earlier procedural one. `MeshRefractionMaterial` gets created exactly
   * once with its permanent envMap, never handed a swapped-later texture —
   * see DiamondMesh.tsx's comment for why that matters (a real, verified
   * shader-recompile bug otherwise). Until this is ready, the diamond shows
   * the fallback material instead — never invisible, never a black gem.
   */
  envMap?: THREE.Texture | null;
  /** Ray-traced-refraction quality knobs, meant to be driven down on weaker devices — see Viewer.tsx's PerformanceMonitor wiring. */
  diamondTier?: DiamondQualityTier;
  onReady?: (root: THREE.Group) => void;
};

export function Model({
  url,
  viewMode = "solid",
  explodeAmount = 0,
  envMap = null,
  diamondTier = DEFAULT_DIAMOND_TIER,
  onReady,
}: ModelProps) {
  const gltf = useGLTF(url) as unknown as { scene: THREE.Group };
  const isWebGL2 = useThree((state) => state.gl.capabilities.isWebGL2);

  // Clone per-instance so multiple viewer mounts (or a remount on model
  // switch) never share mutated material/position state — drei caches the
  // parsed GLTF by URL, so gltf.scene itself must stay untouched.
  const root = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const entriesRef = useRef<MeshEntry[]>([]);
  const diamondUuidsRef = useRef<Set<string> | null>(null);
  const refractionAppliedRef = useRef(false);
  const [diamondMatches, setDiamondMatches] = useState<DiamondMeshMatch[]>([]);

  // One-time-per-root setup: clone materials (so wireframe/etc. toggles
  // never mutate a material shared with the cached original), record each
  // mesh's base position + explode direction, apply the fallback diamond
  // material immediately (visible right away, before the HDRI is ready —
  // see the effect below for the upgrade to ray-traced refraction), and
  // resolve which meshes need diamond handling at all (see
  // three/diamondMaterials.ts for why this needs raw JSON, not just the
  // parsed three.js scene).
  useEffect(() => {
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());
    const diagonal = box.getSize(new THREE.Vector3()).length() || 1;

    const entries: MeshEntry[] = [];
    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) {
        return;
      }
      child.material = Array.isArray(child.material)
        ? child.material.map((m) => m.clone())
        : child.material.clone();

      const worldPos = new THREE.Vector3();
      child.getWorldPosition(worldPos);
      const direction = worldPos.clone().sub(center);
      if (direction.lengthSq() === 0) {
        direction.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
      }
      direction.normalize().multiplyScalar(diagonal * 0.6);

      entries.push({
        mesh: child,
        originalMaterial: child.material,
        basePosition: child.position.clone(),
        explodeDirection: direction,
      });
    });
    entriesRef.current = entries;
    diamondUuidsRef.current = null;
    refractionAppliedRef.current = false;
    setDiamondMatches([]);

    let cancelled = false;
    fetch(url)
      .then((response) => response.arrayBuffer())
      .then((buffer) => {
        if (cancelled) return;
        const diamondUuids = new Set(extractDiamondMaterialUuids(parseGltfJson(buffer)));
        diamondUuidsRef.current = diamondUuids;
        root.userData.holoDiamondUuids = diamondUuids;

        // Fallback first, always — visible immediately, before the HDRI
        // (a network fetch) has necessarily resolved. See the [envMap]
        // effect below for the one-time upgrade to real refraction.
        applyViewerFallbackDiamondMaterials(root, diamondUuids);
        for (const entry of entriesRef.current) {
          entry.originalMaterial = entry.mesh.material;
        }
      })
      .catch(() => {
        // Non-fatal: the model still renders correctly with its
        // as-loaded materials, just without any diamond handling.
      });

    onReady?.(root);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, url]);

  // One-time upgrade to ray-traced refraction, once both the real HDRI and
  // WebGL2 (MeshRefractionMaterial is a WebGL2-only shader — see
  // DiamondMesh.tsx) are available. Deliberately never re-runs after that
  // (refractionAppliedRef guards it) — DiamondMesh must only ever mount
  // with its final envMap, not have one swapped in after creation.
  useEffect(() => {
    if (!envMap || !isWebGL2 || refractionAppliedRef.current || !diamondUuidsRef.current) {
      return;
    }
    const matches = findDiamondMeshes(root, diamondUuidsRef.current);
    if (matches.length === 0) {
      return;
    }
    refractionAppliedRef.current = true;
    for (const { mesh } of matches) {
      mesh.visible = false;
    }
    setDiamondMatches(matches);
  }, [root, envMap, isWebGL2]);

  // View mode: swap to a shared debug material, or restore + toggle
  // wireframe on the (per-instance) original. Diamond meshes rendered via
  // DiamondMesh get their own viewMode handling (passed as a prop below);
  // this loop still runs for them too (harmless — they're invisible once
  // upgraded to refraction).
  useEffect(() => {
    for (const entry of entriesRef.current) {
      if (viewMode === "normals") {
        entry.mesh.material = new THREE.MeshNormalMaterial();
      } else if (viewMode === "uv") {
        entry.mesh.material = new THREE.MeshBasicMaterial({ map: uvCheckerTexture });
      } else {
        entry.mesh.material = entry.originalMaterial;
        const materials = Array.isArray(entry.originalMaterial)
          ? entry.originalMaterial
          : [entry.originalMaterial];
        for (const material of materials) {
          if ("wireframe" in material) {
            (material as THREE.MeshStandardMaterial).wireframe = viewMode === "wireframe";
          }
        }
      }
    }
  }, [viewMode]);

  // Exploded view: offset each mesh from its assembled position along its
  // own direction-from-center, scaled by the model's overall size. Diamond
  // meshes are still regular entries here — their (hidden) position drives
  // DiamondMesh's per-frame world-transform sync.
  useEffect(() => {
    for (const entry of entriesRef.current) {
      entry.mesh.position
        .copy(entry.basePosition)
        .addScaledVector(entry.explodeDirection, explodeAmount);
    }
  }, [explodeAmount]);

  return (
    <>
      <primitive object={root} />
      {envMap &&
        diamondMatches.map(({ mesh }) => (
          <DiamondMesh
            key={mesh.uuid}
            sourceMesh={mesh}
            envMap={envMap}
            tier={diamondTier}
            viewMode={viewMode}
            uvCheckerTexture={uvCheckerTexture}
          />
        ))}
    </>
  );
}
