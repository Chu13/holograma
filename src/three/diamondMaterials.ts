import * as THREE from "three";

type RawGltfMaterial = {
  extras?: { uuid?: string };
  extensions?: { WEBGI_materials_diamond?: unknown };
};

type RawGltfJson = { materials?: RawGltfMaterial[] };

/**
 * Find which materials in a raw glTF JSON carry the vendor extension
 * `WEBGI_materials_diamond` — three.js's GLTFLoader doesn't understand this
 * extension and silently drops it, but it *does* copy each material's
 * `extras` onto the loaded THREE.Material's `userData` (verified in
 * three/examples/jsm/loaders/GLTFLoader.js — `assignExtrasToUserData`).
 * So: read the diamond flag from the raw JSON here, keyed by `extras.uuid`,
 * then match against `material.userData.uuid` after load (see
 * applyDiamondApproximation) to find the same materials on the live scene
 * graph. Verified against CHIARA's real material JSON — its two diamond
 * materials ("Layer 01"/"Layer 02", refractiveIndex 2.6) both carry
 * `extras.uuid`; its rose-gold "Default" metal material has `extras` too
 * but no diamond extension, so name/extras-presence alone can't
 * distinguish them — the extension flag is the only reliable signal.
 */
export function extractDiamondMaterialUuids(json: RawGltfJson): string[] {
  const materials = json.materials ?? [];
  const uuids: string[] = [];
  for (const material of materials) {
    if (material.extensions?.WEBGI_materials_diamond === undefined) {
      continue;
    }
    const uuid = material.extras?.uuid;
    if (uuid) {
      uuids.push(uuid);
    }
  }
  return uuids;
}

/**
 * Swap the given materials for an honest three.js approximation of a
 * diamond: a physically-based transmissive material tuned toward the
 * source's own `refractiveIndex` (2.6 in CHIARA's WEBGI data — close to,
 * though not identical to, a real diamond's ~2.42). This is a stated
 * approximation, not a reproduction — the original WEBGI_materials_diamond
 * shader (dispersion, ray-traced bounces) has no three.js equivalent. The
 * UI must say so; see data/models.ts `materialNotes`.
 */
export function applyDiamondApproximation(root: THREE.Object3D, diamondUuids: Set<string>): void {
  if (diamondUuids.size === 0) {
    return;
  }
  const seen = new Set<THREE.Material>();
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    child.material = Array.isArray(child.material)
      ? materials.map((m) => upgradeIfDiamond(m, diamondUuids, seen))
      : upgradeIfDiamond(materials[0], diamondUuids, seen);
  });
}

function upgradeIfDiamond(
  material: THREE.Material,
  diamondUuids: Set<string>,
  seen: Set<THREE.Material>,
): THREE.Material {
  const uuid = material.userData?.uuid as string | undefined;
  if (!uuid || !diamondUuids.has(uuid) || seen.has(material)) {
    return material;
  }
  seen.add(material);

  const source = material as THREE.MeshStandardMaterial;
  const diamond = new THREE.MeshPhysicalMaterial({
    color: source.color?.clone() ?? new THREE.Color(0xffffff),
    metalness: 0,
    roughness: 0,
    transmission: 1,
    ior: 2.4, // three.js clamps ior to [1, 2.333]-ish in practice via the physical BRDF; close to diamond's ~2.42
    thickness: 0.5,
    envMapIntensity: 1.3,
    name: material.name,
  });
  diamond.userData = { ...material.userData, holoDiamondApproximation: true };
  return diamond;
}
