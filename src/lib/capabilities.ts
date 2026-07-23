export type Platform = "ios" | "android" | "other";

export type CapabilityProbe = {
  userAgent: string;
  /** Result of the real `<a rel="ar">` relList feature probe. */
  supportsArQuickLook?: boolean;
  /** Result of `navigator.xr?.isSessionSupported("immersive-ar")`. */
  supportsWebXRImmersiveAR?: boolean;
};

export type Capabilities = {
  platform: Platform;
  /** iOS + Quick Look feature probe both true. */
  canUseQuickLook: boolean;
  /** Android — Scene Viewer is reached via an Android-only intent: URL. */
  canUseSceneViewer: boolean;
  /** WebXR immersive-ar session support, independent of platform. */
  canUseWebXR: boolean;
};

function detectPlatform(userAgent: string): Platform {
  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    return "ios";
  }
  if (/Android/i.test(userAgent)) {
    return "android";
  }
  return "other";
}

/**
 * Pure capability detection: takes a UA string plus already-run feature
 * probes and returns which AR path(s) are available. Kept pure (no direct
 * `navigator`/`document` access) so it's testable without a real browser —
 * see src/lib/environment.ts for the thin wrapper that supplies real probes.
 */
export function detectCapabilities(probe: CapabilityProbe): Capabilities {
  const platform = detectPlatform(probe.userAgent);

  return {
    platform,
    canUseQuickLook: platform === "ios" && Boolean(probe.supportsArQuickLook),
    canUseSceneViewer: platform === "android",
    canUseWebXR: Boolean(probe.supportsWebXRImmersiveAR),
  };
}
