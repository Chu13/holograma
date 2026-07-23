import { describe, expect, test } from "vitest";
import { detectCapabilities } from "@/lib/capabilities";

const IOS_SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPAD_UA =
  "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";
const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

describe("detectCapabilities", () => {
  test("identifies iOS from an iPhone UA", () => {
    const caps = detectCapabilities({ userAgent: IOS_SAFARI_UA });
    expect(caps.platform).toBe("ios");
  });

  test("identifies iOS from an iPad UA", () => {
    const caps = detectCapabilities({ userAgent: IPAD_UA });
    expect(caps.platform).toBe("ios");
  });

  test("identifies Android from a Pixel Chrome UA", () => {
    const caps = detectCapabilities({ userAgent: ANDROID_CHROME_UA });
    expect(caps.platform).toBe("android");
  });

  test("falls back to desktop/other for a Mac UA", () => {
    const caps = detectCapabilities({ userAgent: DESKTOP_UA });
    expect(caps.platform).toBe("other");
  });

  test("Quick Look is only offered on iOS, and only when the probe says so", () => {
    const supported = detectCapabilities({
      userAgent: IOS_SAFARI_UA,
      supportsArQuickLook: true,
    });
    expect(supported.canUseQuickLook).toBe(true);

    const unsupported = detectCapabilities({
      userAgent: IOS_SAFARI_UA,
      supportsArQuickLook: false,
    });
    expect(unsupported.canUseQuickLook).toBe(false);

    const androidWithFlagTrue = detectCapabilities({
      userAgent: ANDROID_CHROME_UA,
      supportsArQuickLook: true,
    });
    expect(androidWithFlagTrue.canUseQuickLook).toBe(false);
  });

  test("Scene Viewer is only offered on Android", () => {
    const android = detectCapabilities({ userAgent: ANDROID_CHROME_UA });
    expect(android.canUseSceneViewer).toBe(true);

    const ios = detectCapabilities({ userAgent: IOS_SAFARI_UA });
    expect(ios.canUseSceneViewer).toBe(false);
  });

  test("WebXR immersive-ar reflects the injected probe regardless of platform", () => {
    const withXr = detectCapabilities({
      userAgent: ANDROID_CHROME_UA,
      supportsWebXRImmersiveAR: true,
    });
    expect(withXr.canUseWebXR).toBe(true);

    const withoutXr = detectCapabilities({
      userAgent: ANDROID_CHROME_UA,
      supportsWebXRImmersiveAR: false,
    });
    expect(withoutXr.canUseWebXR).toBe(false);
  });

  test("defaults every probe to false when omitted", () => {
    const caps = detectCapabilities({ userAgent: ANDROID_CHROME_UA });
    expect(caps.canUseWebXR).toBe(false);
    expect(caps.canUseQuickLook).toBe(false);
  });
});
