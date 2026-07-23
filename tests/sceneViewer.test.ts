import { describe, expect, test } from "vitest";
import { buildSceneViewerUrl } from "@/ar/sceneViewer";

describe("buildSceneViewerUrl", () => {
  test("rejects a blob: URL — Scene Viewer cannot fetch blob URLs", () => {
    expect(() =>
      buildSceneViewerUrl({
        modelUrl: "blob:https://holograma.app/abc-123",
        fallbackUrl: "https://holograma.app/model/chiara",
      }),
    ).toThrow(/blob/i);
  });

  test("builds a well-formed Scene Viewer intent URL for an https model", () => {
    const url = buildSceneViewerUrl({
      modelUrl: "https://holograma.app/models/chiara.glb",
      fallbackUrl: "https://holograma.app/model/chiara",
    });

    expect(url.startsWith("intent://arvr.google.com/scene-viewer/1.0?")).toBe(true);
    expect(url).toContain("file=https%3A%2F%2Fholograma.app%2Fmodels%2Fchiara.glb");
    expect(url).toContain("mode=ar_only");
    expect(url).toContain("scheme=https");
    expect(url).toContain("package=com.google.ar.core");
    expect(url).toContain("action=android.intent.action.VIEW");
    expect(url).toContain(
      "S.browser_fallback_url=https%3A%2F%2Fholograma.app%2Fmodel%2Fchiara",
    );
    expect(url.endsWith(";end;")).toBe(true);
  });

  test("includes an optional title when provided", () => {
    const url = buildSceneViewerUrl({
      modelUrl: "https://holograma.app/models/chiara.glb",
      fallbackUrl: "https://holograma.app/model/chiara",
      title: "CHIARA",
    });
    expect(url).toContain("title=CHIARA");
  });

  test("defaults to ar_only mode but allows ar_preferred", () => {
    const url = buildSceneViewerUrl({
      modelUrl: "https://holograma.app/models/chiara.glb",
      fallbackUrl: "https://holograma.app/model/chiara",
      mode: "ar_preferred",
    });
    expect(url).toContain("mode=ar_preferred");
  });

  test("rejects a non-https model URL", () => {
    expect(() =>
      buildSceneViewerUrl({
        modelUrl: "http://holograma.app/models/chiara.glb",
        fallbackUrl: "https://holograma.app/model/chiara",
      }),
    ).toThrow(/https/i);
  });
});
