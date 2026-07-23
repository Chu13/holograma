export type SceneViewerMode = "ar_only" | "ar_preferred" | "3d_only";

export type SceneViewerOptions = {
  /** Public HTTPS URL of the .glb — Scene Viewer cannot fetch blob: URLs. */
  modelUrl: string;
  /** Where to send the user if Scene Viewer / ARCore isn't available. */
  fallbackUrl: string;
  title?: string;
  mode?: SceneViewerMode;
};

/**
 * Build an Android Scene Viewer intent: URL.
 *
 * Real limitation baked in on purpose: Scene Viewer only accepts a public
 * https URL for `file` — it cannot fetch a `blob:` URL, so drag & dropped
 * models can never use this path (see src/ar — those fall back to WebXR or
 * an honest "not supported" message instead).
 */
export function buildSceneViewerUrl({
  modelUrl,
  fallbackUrl,
  title,
  mode = "ar_only",
}: SceneViewerOptions): string {
  if (modelUrl.startsWith("blob:")) {
    throw new Error(
      "buildSceneViewerUrl: Scene Viewer cannot load a blob: URL — the model must be served from a public https URL.",
    );
  }
  if (!modelUrl.startsWith("https://")) {
    throw new Error("buildSceneViewerUrl: modelUrl must be an https:// URL.");
  }

  const params = new URLSearchParams();
  params.set("file", modelUrl);
  params.set("mode", mode);
  if (title) {
    params.set("title", title);
  }

  const intentParams = [
    "scheme=https",
    "package=com.google.ar.core",
    "action=android.intent.action.VIEW",
    `S.browser_fallback_url=${encodeURIComponent(fallbackUrl)}`,
    "end",
  ].join(";");

  return `intent://arvr.google.com/scene-viewer/1.0?${params.toString()}#Intent;${intentParams};`;
}
