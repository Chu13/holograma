import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const roomEnvironment = new RoomEnvironment();

/**
 * Studio-style lighting generated at runtime via PMREMGenerator, from
 * three's own procedural RoomEnvironment — no HDRI fetched from a CDN.
 *
 * Not drei's <Environment scene={...}>: that prop is where to *apply* a
 * loaded environment map (e.g. a portal sub-scene), not what to *generate*
 * one from — passing a procedural scene there still falls through to
 * drei's default CDN preset loader, which was throwing a real "Could not
 * load /px.png..." runtime error (caught via a Playwright smoke test
 * against the built app, not assumed). This does the PMREM conversion
 * directly instead.
 */
export function ProceduralEnvironment() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);

  useEffect(() => {
    const pmremGenerator = new THREE.PMREMGenerator(gl);
    const envTexture = pmremGenerator.fromScene(roomEnvironment, 0.04).texture;
    scene.environment = envTexture;
    pmremGenerator.dispose();

    return () => {
      envTexture.dispose();
      if (scene.environment === envTexture) {
        scene.environment = null;
      }
    };
  }, [gl, scene]);

  return null;
}
