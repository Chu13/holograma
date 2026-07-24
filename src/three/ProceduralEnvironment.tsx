import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const roomEnvironment = new RoomEnvironment();

export type ProceduralEnvironmentProps = {
  /** Fires once, with the generated PMREM texture — see HdriEnvironment.tsx for why (MeshRefractionMaterial needs the actual texture object as a prop, not just scene.environment mutated imperatively). */
  onReady?: (texture: THREE.Texture) => void;
};

/**
 * Studio-style lighting generated at runtime via PMREMGenerator, from
 * three's own procedural RoomEnvironment — no HDRI fetched from a CDN.
 * The instant-load fallback (zero network cost) that HdriEnvironment.tsx
 * progressively upgrades once the real self-hosted HDRI has loaded.
 *
 * Not drei's <Environment scene={...}>: that prop is where to *apply* a
 * loaded environment map (e.g. a portal sub-scene), not what to *generate*
 * one from — passing a procedural scene there still falls through to
 * drei's default CDN preset loader, which was throwing a real "Could not
 * load /px.png..." runtime error (caught via a Playwright smoke test
 * against the built app, not assumed). This does the PMREM conversion
 * directly instead.
 */
export function ProceduralEnvironment({ onReady }: ProceduralEnvironmentProps) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    const pmremGenerator = new THREE.PMREMGenerator(gl);
    const envTexture = pmremGenerator.fromScene(roomEnvironment, 0.04).texture;
    scene.environment = envTexture;
    pmremGenerator.dispose();
    onReadyRef.current?.(envTexture);

    return () => {
      envTexture.dispose();
      if (scene.environment === envTexture) {
        scene.environment = null;
      }
    };
  }, [gl, scene]);

  return null;
}
