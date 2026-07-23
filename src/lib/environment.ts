import { detectCapabilities, type Capabilities } from "@/lib/capabilities";

type XRNavigator = Navigator & {
  xr?: { isSessionSupported(mode: string): Promise<boolean> };
};

function probeQuickLookSupport(): boolean {
  const a = document.createElement("a");
  return Boolean(a.relList?.supports?.("ar"));
}

async function probeWebXRSupport(): Promise<boolean> {
  const nav = navigator as XRNavigator;
  if (!nav.xr?.isSessionSupported) {
    return false;
  }
  try {
    return await nav.xr.isSessionSupported("immersive-ar");
  } catch {
    return false;
  }
}

let cached: Promise<Capabilities> | null = null;

/** Real-browser capability detection, built on the pure detectCapabilities core. */
export function getEnvironmentCapabilities(): Promise<Capabilities> {
  if (!cached) {
    cached = probeWebXRSupport().then((supportsWebXRImmersiveAR) =>
      detectCapabilities({
        userAgent: navigator.userAgent,
        supportsArQuickLook: probeQuickLookSupport(),
        supportsWebXRImmersiveAR,
      }),
    );
  }
  return cached;
}
