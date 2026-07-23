// Loads the same vendored Draco decoder three.js's own DRACOLoader uses
// (public/draco/, copied from three/examples/jsm/libs/draco/gltf/) as a
// classic script, so gltf-transform's WebIO can decode Draco-compressed
// meshes in-browser too — one vendored decoder, two consumers. Verified
// working against the real chiara.glb (54 meshes) in a headless-Chromium
// smoke test before wiring this into the app.
declare global {
  interface Window {
    DracoDecoderModule?: () => Promise<unknown>;
  }
}

let modulePromise: Promise<unknown> | null = null;
let scriptPromise: Promise<void> | null = null;

function loadDecoderScript(): Promise<void> {
  if (scriptPromise) {
    return scriptPromise;
  }
  scriptPromise = new Promise((resolve, reject) => {
    if (window.DracoDecoderModule) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "/draco/draco_decoder.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load /draco/draco_decoder.js"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/** Returns the (cached) Draco decoder module instance, loading it on first use. */
export async function getDracoDecoderModule(): Promise<unknown> {
  if (!modulePromise) {
    modulePromise = loadDecoderScript().then(() => {
      if (!window.DracoDecoderModule) {
        throw new Error("draco_decoder.js loaded but did not define window.DracoDecoderModule.");
      }
      return window.DracoDecoderModule();
    });
  }
  return modulePromise;
}
