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
 * then match against `material.userData.uuid` after load to find the same
 * materials on the live scene graph. Verified against CHIARA's real
 * material JSON — its two diamond materials ("Layer 01"/"Layer 02",
 * refractiveIndex 2.6) both carry `extras.uuid`; its rose-gold "Default"
 * metal material has `extras` too but no diamond extension, so
 * name/extras-presence alone can't distinguish them — the extension flag
 * is the only reliable signal.
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
 * Two deliberately separate strategies for the same flagged meshes — see
 * the long comment on `applyExportDiamondMaterials` for why they can never
 * share a material instance.
 */
export type DiamondMeshMatch = {
  mesh: THREE.Mesh;
  originalMaterial: THREE.Material;
};

/** Find every mesh whose material carries one of the given diamond uuids. Does not mutate anything. */
export function findDiamondMeshes(root: THREE.Object3D, uuids: Set<string>): DiamondMeshMatch[] {
  if (uuids.size === 0) {
    return [];
  }
  const matches: DiamondMeshMatch[] = [];
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) {
      return;
    }
    const uuid = child.material.userData?.uuid as string | undefined;
    if (uuid && uuids.has(uuid)) {
      matches.push({ mesh: child, originalMaterial: child.material });
    }
  });
  return matches;
}

/**
 * AR-export material recipe — a plain `MeshPhysicalMaterial` tuned as a
 * *reflection*, not a transmission, strategy. This is not a downgrade from
 * the live viewer's ray-traced refraction (see three/DiamondMesh.tsx) —
 * it's the only strategy that actually reaches native AR at all.
 *
 * Researched, not guessed: iOS Quick Look (RealityKit) has no true
 * refraction — a transmissive USDZ just shows the background through a
 * "hollow bubble." Android Scene Viewer (Filament) renders
 * `KHR_materials_transmission` **opaque** (confirmed via multiple
 * community reports). three.js's own `USDZExporter` already drops
 * `transmission`/`thickness`/`volume` when writing a `MeshPhysicalMaterial`
 * into USD — for that material type it only ever writes `ior`, `clearcoat`,
 * `clearcoatRoughness` on top of the base diffuse/roughness/metallic/
 * opacity. So `transmission`/`thickness` are 100% wasted for AR: they
 * silently vanish in export. RealityKit's own `clearcoat` API is literally
 * documented as "transparent highlights that simulate a clear, shiny
 * coating" — exactly gem sparkle, and one of the few properties that
 * actually survives into the USDZ and gets rendered.
 *
 * `ior` is pushed to ~2.33, three's practical ceiling for this material's
 * `ior` setter (clamped roughly to [1, 2.333]) — short of a real diamond's
 * 2.42, but it strengthens the Fresnel/reflection response, which is what
 * both RealityKit and Filament actually use it for.
 *
 * `emissive` is set to a faint tint of the gem's own base color (verified
 * against three's `USDZExporter` source: it writes `emissiveColor` for any
 * material whenever `material.emissive.getHex() > 0`, independent of the
 * `isMeshPhysicalMaterial`-gated block above — so unlike `transmission` this
 * genuinely reaches the USDZ). Native AR has no equivalent of the app's own
 * curated studio HDRI — Quick Look and Scene Viewer light the gem with
 * their own neutral/real-world IBL instead — so a real diamond re-lit that
 * way can read flat/grey. A small emissive floor keeps facets from ever
 * going fully dark without looking like the gem is glowing (kept low enough
 * to be a lift, not a light source; verify on a real device with C1/C2).
 */
export function applyExportDiamondMaterials(root: THREE.Object3D, uuids: Set<string>): void {
  for (const { mesh, originalMaterial } of findDiamondMeshes(root, uuids)) {
    const source = originalMaterial as THREE.MeshStandardMaterial;
    const baseColor = source.color?.clone() ?? new THREE.Color(0xffffff);
    const exportMaterial = new THREE.MeshPhysicalMaterial({
      color: baseColor,
      metalness: 0,
      roughness: 0.03,
      ior: 2.33,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      envMapIntensity: 1.3,
      emissive: baseColor.clone().multiplyScalar(0.05),
      name: originalMaterial.name,
    });
    exportMaterial.userData = { ...originalMaterial.userData, holoDiamondExportMaterial: true };
    mesh.material = exportMaterial;
  }
}

/**
 * Viewer fallback for devices that can't run `MeshRefractionMaterial`
 * (see three/DiamondMesh.tsx — that's a WebGL2-only custom shader, and
 * this project's own research turned up a real drei issue where it fails
 * to compile on some older/low-end GPUs). Mutates the *original* meshes in
 * place — no hide-and-twin needed since there's no ray-traced version
 * competing for the same geometry.
 *
 * Physically-based transmission + three 0.185's native `dispersion`
 * property (added ~r164, implementing KHR_materials_dispersion) — the
 * closest approximation available outside the ray-traced shader, tuned
 * toward CHIARA's own WEBGI data (`refractiveIndex: 2.6`; real diamond is
 * ~2.42, and `MeshPhysicalMaterial.ior` clamps to roughly the same ~2.33
 * ceiling as the export strategy above).
 */
export function applyViewerFallbackDiamondMaterials(root: THREE.Object3D, uuids: Set<string>): void {
  for (const { mesh, originalMaterial } of findDiamondMeshes(root, uuids)) {
    const source = originalMaterial as THREE.MeshStandardMaterial;
    const fallback = new THREE.MeshPhysicalMaterial({
      color: source.color?.clone() ?? new THREE.Color(0xffffff),
      metalness: 0,
      roughness: 0,
      transmission: 1,
      ior: 2.33,
      thickness: 0.5,
      dispersion: 1,
      envMapIntensity: 1.3,
      name: originalMaterial.name,
    });
    fallback.userData = { ...originalMaterial.userData, holoDiamondViewerFallback: true };
    mesh.material = fallback;
  }
}
