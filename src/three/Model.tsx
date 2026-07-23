import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { parseGltfJson } from "@/inspect/extensions";
import { applyDiamondApproximation, extractDiamondMaterialUuids } from "@/three/diamondMaterials";

// Self-hosted decoder — same files three's own examples vendor, copied into
// public/draco/. Never depend on drei's default CDN decoder: the viewer
// must keep working fully offline/self-contained (AR + iframe embedding
// both depend on this app never reaching out to a third party at runtime).
useGLTF.setDecoderPath("/draco/");

export type ViewMode = "solid" | "wireframe" | "normals" | "uv";

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
  onReady?: (root: THREE.Group) => void;
};

export function Model({ url, viewMode = "solid", explodeAmount = 0, onReady }: ModelProps) {
  const gltf = useGLTF(url) as unknown as { scene: THREE.Group };

  // Clone per-instance so multiple viewer mounts (or a remount on model
  // switch) never share mutated material/position state — drei caches the
  // parsed GLTF by URL, so gltf.scene itself must stay untouched.
  const root = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const entriesRef = useRef<MeshEntry[]>([]);

  // One-time-per-root setup: clone materials (so wireframe/etc. toggles
  // never mutate a material shared with the cached original), record each
  // mesh's base position + explode direction, and apply the diamond
  // approximation once we've fetched the raw JSON to know which materials
  // need it (see three/diamondMaterials.ts for why this needs raw JSON).
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

    let cancelled = false;
    fetch(url)
      .then((response) => response.arrayBuffer())
      .then((buffer) => {
        if (cancelled) return;
        const diamondUuids = new Set(extractDiamondMaterialUuids(parseGltfJson(buffer)));
        applyDiamondApproximation(root, diamondUuids);
        // Diamond swap allocates new materials — refresh our cache so
        // "solid" mode restores the diamond version, not the pre-swap one.
        for (const entry of entriesRef.current) {
          entry.originalMaterial = entry.mesh.material;
        }
      })
      .catch(() => {
        // Non-fatal: the model still renders correctly with its
        // as-loaded materials, just without the diamond approximation.
      });

    onReady?.(root);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, url]);

  // View mode: swap to a shared debug material, or restore + toggle
  // wireframe on the (per-instance) original.
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
  // own direction-from-center, scaled by the model's overall size.
  useEffect(() => {
    for (const entry of entriesRef.current) {
      entry.mesh.position
        .copy(entry.basePosition)
        .addScaledVector(entry.explodeDirection, explodeAmount);
    }
  }, [explodeAmount]);

  return <primitive object={root} />;
}
