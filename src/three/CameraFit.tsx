import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

export type ModelBounds = {
  center: THREE.Vector3;
  size: THREE.Vector3;
  min: THREE.Vector3;
};

export type CameraFitProps = {
  root: THREE.Object3D | null;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  /** Reports the model's world-space bounding box once per fit — e.g. so ContactShadows can size/place itself instead of using CHIARA-specific magic numbers. */
  onFit?: (bounds: ModelBounds) => void;
};

/**
 * Frame the camera to whatever model just loaded, since the gallery's
 * default model and an arbitrary drag & dropped model can be wildly
 * different scales — a fixed camera position only works for one of them.
 */
export function CameraFit({ root, controlsRef, onFit }: CameraFitProps) {
  const camera = useThree((state) => state.camera);

  // Stash the latest onFit in a ref rather than the effect's dep array —
  // Viewer.tsx isn't expected to memoize it, and this effect must only
  // re-run when the model itself (re)loads, not on every parent re-render
  // (a viewMode/explodeAmount change would otherwise snap the camera back).
  const onFitRef = useRef(onFit);
  onFitRef.current = onFit;

  useEffect(() => {
    if (!root) return;
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    if (box.isEmpty()) return;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.length() / 2, 0.01);

    onFitRef.current?.({ center: center.clone(), size: size.clone(), min: box.min.clone() });

    const perspective = camera as THREE.PerspectiveCamera;
    const fov = perspective.isPerspectiveCamera ? (perspective.fov * Math.PI) / 180 : Math.PI / 4;
    const distance = radius / Math.sin(fov / 2);

    camera.position.set(
      center.x + distance * 0.55,
      center.y + distance * 0.35,
      center.z + distance * 0.75,
    );
    camera.near = Math.max(distance / 100, 0.01);
    camera.far = distance * 100;
    camera.updateProjectionMatrix();
    camera.lookAt(center);

    const controls = controlsRef.current;
    if (controls) {
      controls.target.copy(center);
      controls.minDistance = distance * 0.3;
      controls.maxDistance = distance * 3;
      controls.update();
    }
  }, [root, camera, controlsRef]);

  return null;
}
