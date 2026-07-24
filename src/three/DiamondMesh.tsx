import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { MeshRefractionMaterial } from "@react-three/drei";
import type { ViewMode } from "@/three/Model";

export type DiamondQualityTier = {
  bounces: number;
  aberrationStrength: number;
  fastChroma: boolean;
};

export type DiamondMeshProps = {
  /**
   * The real, hidden mesh from the loaded glTF — stays the single source of
   * truth for transform (the exploded-view slider moves it exactly like
   * every other mesh; see three/Model.tsx). This component only ever reads
   * it, never mutates it.
   */
  sourceMesh: THREE.Mesh;
  envMap: THREE.Texture;
  tier: DiamondQualityTier;
  viewMode: ViewMode;
  uvCheckerTexture: THREE.Texture;
};

/**
 * The live-viewer half of the two-strategy diamond split (see
 * three/diamondMaterials.ts for the AR-export half and why they can never
 * share a material instance). Renders drei's `<MeshRefractionMaterial>` —
 * real ray-traced refraction through the actual faceted geometry, reaching
 * true diamond `ior: 2.4` (plain `MeshPhysicalMaterial.ior` clamps to
 * ~2.33, physically wrong for a diamond).
 *
 * Why a separate JSX `<mesh>` twin instead of mutating `sourceMesh.material`
 * directly (the pattern every other material swap in this codebase uses):
 * `MeshRefractionMaterial`'s own implementation (@react-three/drei's
 * source, not assumed) needs (a) a `useLayoutEffect` that walks
 * `material.__r3f.parent.object` to build a BVH from the *parent mesh's*
 * geometry, and (b) a `useFrame` that updates camera-matrix uniforms every
 * frame — both only work when the material is a real JSX child of a
 * `<mesh>` inside R3F's own reconciler tree, which `sourceMesh` (loaded via
 * plain `GLTFLoader`, added via `<primitive object={root}/>`) is not. So
 * `sourceMesh` is hidden (`visible = false`, done by the caller) and this
 * component renders a lightweight twin that copies its *world* transform
 * every frame via `matrixWorld` (robust regardless of how deep the
 * original sits in the loaded hierarchy — see the `useFrame` below) and
 * shares its `geometry` (no vertex-data duplication).
 */
export function DiamondMesh({ sourceMesh, envMap, tier, viewMode, uvCheckerTexture }: DiamondMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.matrix.copy(sourceMesh.matrixWorld);
  });

  return (
    <mesh ref={meshRef} geometry={sourceMesh.geometry} matrixAutoUpdate={false}>
      {viewMode === "normals" && <meshNormalMaterial />}
      {viewMode === "uv" && <meshBasicMaterial map={uvCheckerTexture} />}
      {viewMode === "wireframe" && <meshStandardMaterial wireframe color="white" />}
      {viewMode === "solid" && (
        <MeshRefractionMaterial
          envMap={envMap}
          ior={2.4}
          bounces={tier.bounces}
          aberrationStrength={tier.aberrationStrength}
          fastChroma={tier.fastChroma}
          // Empirically tuned against CHIARA + brown_photostudio_02 (real
          // screenshots, not guessed): fresnel=0 (the material's default)
          // rendered the gem almost entirely black — this HDRI's bright
          // softboxes sit at a narrow angular range, so without a Fresnel
          // rim term blending in direct reflection at grazing angles, the
          // ray-traced refraction mostly sampled the HDRI's darker regions.
          fresnel={1}
          toneMapped={false}
        />
      )}
    </mesh>
  );
}
