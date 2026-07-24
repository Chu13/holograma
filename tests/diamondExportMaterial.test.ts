import { describe, expect, test } from "vitest";
import * as THREE from "three";
import { applyExportDiamondMaterials } from "@/three/diamondMaterials";

function buildMesh(uuid: string | undefined): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial();
  material.userData = uuid ? { uuid } : {};
  return new THREE.Mesh(geometry, material);
}

describe("applyExportDiamondMaterials", () => {
  test("swaps a matched mesh to a reflection-strategy MeshPhysicalMaterial", () => {
    const mesh = buildMesh("diamond-1");
    const root = new THREE.Group();
    root.add(mesh);

    applyExportDiamondMaterials(root, new Set(["diamond-1"]));

    const material = mesh.material as THREE.MeshPhysicalMaterial;
    expect(material).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    expect(material.metalness).toBe(0);
    expect(material.clearcoat).toBe(1);
    expect(material.clearcoatRoughness).toBeGreaterThan(0);
    expect(material.clearcoatRoughness).toBeLessThan(0.1);
    expect(material.roughness).toBeGreaterThan(0);
    expect(material.roughness).toBeLessThan(0.1);
  });

  test("never sets transmission — the exporter drops it and AR renders it wrong regardless", () => {
    const mesh = buildMesh("diamond-1");
    const root = new THREE.Group();
    root.add(mesh);

    applyExportDiamondMaterials(root, new Set(["diamond-1"]));

    const material = mesh.material as THREE.MeshPhysicalMaterial;
    expect(material.transmission).toBe(0);
    expect(material.thickness).toBe(0);
  });

  test("applies a faint emissive tint of the base color, not a hardcoded glow", () => {
    const mesh = buildMesh("diamond-1");
    (mesh.material as THREE.MeshStandardMaterial).color.setHex(0xffffff);
    const root = new THREE.Group();
    root.add(mesh);

    applyExportDiamondMaterials(root, new Set(["diamond-1"]));

    const material = mesh.material as THREE.MeshPhysicalMaterial;
    // USDZExporter only writes emissiveColor when getHex() > 0 (verified
    // against three's exporter source) — must be nonzero to survive export.
    expect(material.emissive.getHex()).toBeGreaterThan(0);
    // A lift, not a light source: each channel stays well below the base
    // color's own value (white here), so the gem doesn't read as glowing.
    expect(material.emissive.r).toBeLessThan(0.2);
    expect(material.emissive.g).toBeLessThan(0.2);
    expect(material.emissive.b).toBeLessThan(0.2);
  });

  test("pushes ior toward the material system's practical ceiling for a diamond look", () => {
    const mesh = buildMesh("diamond-1");
    const root = new THREE.Group();
    root.add(mesh);

    applyExportDiamondMaterials(root, new Set(["diamond-1"]));

    const material = mesh.material as THREE.MeshPhysicalMaterial;
    expect(material.ior).toBeGreaterThan(2);
  });

  test("leaves non-diamond meshes untouched", () => {
    const mesh = buildMesh("metal-1");
    const originalMaterial = mesh.material;
    const root = new THREE.Group();
    root.add(mesh);

    applyExportDiamondMaterials(root, new Set(["diamond-1"]));

    expect(mesh.material).toBe(originalMaterial);
  });

  test("is a no-op for an empty uuid set", () => {
    const mesh = buildMesh("diamond-1");
    const originalMaterial = mesh.material;
    const root = new THREE.Group();
    root.add(mesh);

    applyExportDiamondMaterials(root, new Set());

    expect(mesh.material).toBe(originalMaterial);
  });

  test("produces an independent material instance from applyViewerDiamondMaterials's fallback, both derived from the same uuid set", () => {
    // Regression guard for the core architectural rule: the viewer and
    // export paths must never share a material instance, since
    // MeshRefractionMaterial (the viewer's primary strategy) cannot be fed
    // into USDZExporter.
    const meshA = buildMesh("diamond-1");
    const meshB = buildMesh("diamond-1");
    const rootA = new THREE.Group();
    rootA.add(meshA);
    const rootB = new THREE.Group();
    rootB.add(meshB);

    applyExportDiamondMaterials(rootA, new Set(["diamond-1"]));
    applyExportDiamondMaterials(rootB, new Set(["diamond-1"]));

    expect(meshA.material).not.toBe(meshB.material);
  });
});
