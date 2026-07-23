import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import "@/ar/MarkerExperience.css";

// MindARThree's public API (container, imageTargetSrc, addAnchor, start/
// stop) is stable and documented upstream — see
// https://hiukim.github.io/mind-ar-js-doc/. Typed loosely here since the
// vendored bundle (src/vendor/mindar/, see README for how it got there) is
// a minified third-party build with no shipped .d.ts.
type MindARThreeInstance = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  addAnchor(targetIndex: number): { group: THREE.Group };
  start(): Promise<void>;
  stop(): void;
};

export type MarkerExperienceProps = {
  /** URL of the compiled .mind target (see scripts/build-card-target.mjs). */
  mindTargetUrl: string;
  /** The model to anchor onto the tracked card. */
  glbUrl: string;
  onClose: () => void;
};

/**
 * EXPERIMENTAL: point the camera at the printed card and CHIARA anchors to
 * it directly — image tracking via a vendored MindAR bundle (see
 * src/vendor/mindar/), no QR scan needed for this path. Explicit opt-in
 * only: nothing here runs until the user clicks into it, and the camera
 * permission prompt is the browser's own, never bypassed. Untested against
 * a live camera/device in this environment — see README's AR section.
 */
export function MarkerExperience({ mindTargetUrl, glbUrl, onClose }: MarkerExperienceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "running" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let mindar: MindARThreeInstance | null = null;

    async function start() {
      const container = containerRef.current;
      if (!container) return;

      try {
        const { MindARThree } = await import("@/vendor/mindar/mindar-image-three.prod.js");
        if (cancelled) return;

        mindar = new MindARThree({
          container,
          imageTargetSrc: mindTargetUrl,
        }) as MindARThreeInstance;

        const anchor = mindar.addAnchor(0);

        const draco = new DRACOLoader();
        draco.setDecoderPath("/draco/");
        const loader = new GLTFLoader();
        loader.setDRACOLoader(draco);
        const gltf = await loader.loadAsync(glbUrl);
        if (cancelled) return;

        gltf.scene.scale.setScalar(0.15);
        anchor.group.add(gltf.scene);
        anchor.group.add(new THREE.HemisphereLight(0xffffff, 0x222233, 2));

        await mindar.start();
        if (cancelled) {
          mindar.stop();
          return;
        }

        mindar.renderer.setAnimationLoop(() => {
          mindar!.renderer.render(mindar!.scene, mindar!.camera);
        });
        setStatus("running");
      } catch (error) {
        if (cancelled) return;
        setStatus("error");
        setErrorMessage(
          error instanceof DOMException && error.name === "NotAllowedError"
            ? "Camera access was denied."
            : "Marker mode couldn't start on this device.",
        );
      }
    }

    start();
    return () => {
      cancelled = true;
      try {
        mindar?.stop();
      } catch {
        // Already stopped or never started — nothing to clean up.
      }
    };
  }, [mindTargetUrl, glbUrl]);

  return (
    <div className="marker-experience">
      <div ref={containerRef} className="marker-experience__container" />
      <div className="marker-experience__chrome">
        <span className="label marker-experience__badge">Experimental — marker mode</span>
        <button type="button" className="marker-experience__close" onClick={onClose}>
          Close
        </button>
      </div>
      {status === "loading" && <p className="marker-experience__status">Starting camera…</p>}
      {status === "error" && (
        <p className="marker-experience__status marker-experience__status--error">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
