import { useEffect, useState } from "react";
import type * as THREE from "three";
import { getEnvironmentCapabilities } from "@/lib/environment";
import { buildSceneViewerUrl } from "@/ar/sceneViewer";
import { buildQuickLookLink } from "@/ar/quickLook";
import { generateRuntimeUsdz } from "@/ar/usdzRuntime";
import type { Capabilities } from "@/lib/capabilities";
import "@/ui/ARButton.css";

export type ARButtonProps = {
  title: string;
  /** Public https .glb URL — required for Android Scene Viewer. Omit (or pass a blob: URL) for a drag & dropped model. */
  glbUrl?: string;
  /** Pre-generated .usdz — gallery models only. */
  usdzUrl?: string;
  /** The already-loaded, already-Draco-decoded scene graph, for runtime USDZ export of dropped models. */
  liveRoot?: THREE.Object3D | null;
};

/**
 * The AR launch control. What it renders depends entirely on platform +
 * what's actually available — never a button that silently does nothing.
 * Android needs a public https .glb (Scene Viewer can't fetch blob: URLs);
 * iOS needs a .usdz, pre-generated for gallery models or built at runtime
 * for a dropped one (see ar/usdzRuntime.ts, including why that's main-thread
 * and not a worker). Anything else gets an honest capability message.
 */
export function ARButton({ title, glbUrl, usdzUrl, liveRoot }: ARButtonProps) {
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [generating, setGenerating] = useState(false);
  const [runtimeUsdzHref, setRuntimeUsdzHref] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getEnvironmentCapabilities().then((caps) => {
      if (!cancelled) setCapabilities(caps);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (runtimeUsdzHref) URL.revokeObjectURL(runtimeUsdzHref);
    };
  }, [runtimeUsdzHref]);

  if (!capabilities) {
    return null;
  }

  const fallbackUrl = typeof window !== "undefined" ? window.location.href : "";
  const isDroppedModel = !glbUrl || glbUrl.startsWith("blob:");

  if (capabilities.platform === "android") {
    if (glbUrl && !isDroppedModel) {
      const href = buildSceneViewerUrl({ modelUrl: glbUrl, fallbackUrl, title });
      return (
        <a className="ar-button" href={href} rel="noopener noreferrer">
          View in AR
        </a>
      );
    }
    if (capabilities.canUseWebXR) {
      return (
        <p className="ar-button ar-button--note">
          This device supports WebXR, but placing a dropped model in AR via WebXR isn't wired up
          yet — the next step for custom uploads on Android.
        </p>
      );
    }
    return (
      <p className="ar-button ar-button--note">
        Android AR needs a model hosted at a public URL — Scene Viewer can't open a file dropped
        straight into the browser. Try the gallery's own model, or check back for WebXR support.
      </p>
    );
  }

  if (capabilities.platform === "ios") {
    if (usdzUrl) {
      const link = buildQuickLookLink({ usdzUrl, canonicalWebPageURL: fallbackUrl });
      return (
        <a className="ar-button" rel={link.rel} href={link.href}>
          View in AR
        </a>
      );
    }

    if (runtimeUsdzHref) {
      // Quick Look normally identifies USDZ by the .usdz extension in the
      // URL path, which a blob: URL doesn't have — Safari also accepts it
      // via the response Content-Type, which the Blob in usdzRuntime.ts
      // sets correctly (model/vnd.usdz+zip), so a plain blob href still
      // opens Quick Look. buildQuickLookLink's extension check is for
      // hosted .usdz files (the gallery-model branch above) — a blob URL
      // skips it and links directly.
      return (
        <div className="ar-button-group">
          <a className="ar-button" rel="ar" href={runtimeUsdzHref}>
            View in AR
          </a>
          <p className="ar-note">
            Generated on the fly from your file: simplified materials, no animations, no
            variants.
          </p>
        </div>
      );
    }

    return (
      <div className="ar-button-group">
        <button
          type="button"
          className="ar-button"
          disabled={generating || !liveRoot}
          onClick={async () => {
            if (!liveRoot) return;
            setGenerating(true);
            setError(null);
            try {
              const blob = await generateRuntimeUsdz(liveRoot);
              setRuntimeUsdzHref(URL.createObjectURL(blob));
            } catch {
              setError("Couldn't generate an AR file for this model.");
            } finally {
              setGenerating(false);
            }
          }}
        >
          {generating ? "Generating AR file…" : "Generate AR file"}
        </button>
        <p className="ar-note">
          Your dropped model has no pre-made AR file — HOLOGRAMA will build one in your browser
          (simplified materials, no animations, no variants).
        </p>
        {error && <p className="ar-note ar-note--error">{error}</p>}
      </div>
    );
  }

  return (
    <p className="ar-button ar-button--note">
      AR needs an iOS or Android device — view the model here, or open this page on your phone.
    </p>
  );
}
