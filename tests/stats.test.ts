import { describe, expect, test } from "vitest";
import { summarizeInspectReport } from "@/inspect/stats";
import type { InspectReport } from "@gltf-transform/functions";

// Shaped to match the real InspectReport interface from
// @gltf-transform/functions (verified against node_modules/@gltf-transform
// /functions/dist/index.d.ts) — not a guessed shape.
function makeReport(overrides: Partial<InspectReport> = {}): InspectReport {
  return {
    scenes: {
      properties: [
        {
          name: "Scene",
          rootName: "Root",
          bboxMin: [-1, -1, -1],
          bboxMax: [1, 1, 1],
          renderVertexCount: 92_893,
          uploadVertexCount: 92_893,
          uploadNaiveVertexCount: 92_893,
        },
      ],
    },
    meshes: {
      properties: [
        {
          name: "Mesh_0",
          meshPrimitives: 1,
          mode: ["TRIANGLES"],
          vertices: 60_000,
          glPrimitives: 80_000,
          indices: ["ushort"],
          attributes: ["POSITION", "NORMAL"],
          instances: 1,
          size: 500_000,
        },
        {
          name: "Mesh_1",
          meshPrimitives: 1,
          mode: ["TRIANGLES"],
          vertices: 32_893,
          glPrimitives: 52_316,
          indices: ["ushort"],
          attributes: ["POSITION", "NORMAL"],
          instances: 1,
          size: 200_000,
        },
      ],
    },
    materials: {
      properties: [
        { name: "Gold", instances: 3, textures: [], alphaMode: "OPAQUE", doubleSided: false },
        { name: "Diamond", instances: 1, textures: [], alphaMode: "BLEND", doubleSided: false },
      ],
    },
    textures: { properties: [] },
    animations: { properties: [] },
    ...overrides,
  } as InspectReport;
}

describe("summarizeInspectReport", () => {
  test("sums glPrimitives across meshes as the triangle count", () => {
    const stats = summarizeInspectReport(makeReport(), {
      fileSizeBytes: 674_608,
      extensionsUsed: [],
    });
    expect(stats.triangles).toBe(132_316); // 80,000 + 52,316 — matches CHIARA's real count
  });

  test("prefers the scene's renderVertexCount over summing mesh vertices", () => {
    const stats = summarizeInspectReport(makeReport(), {
      fileSizeBytes: 674_608,
      extensionsUsed: [],
    });
    expect(stats.vertices).toBe(92_893);
  });

  test("falls back to summing mesh vertices when there is no scene", () => {
    const report = makeReport({ scenes: { properties: [] } });
    const stats = summarizeInspectReport(report, {
      fileSizeBytes: 674_608,
      extensionsUsed: [],
    });
    expect(stats.vertices).toBe(92_893); // 60,000 + 32,893
  });

  test("counts materials", () => {
    const stats = summarizeInspectReport(makeReport(), {
      fileSizeBytes: 674_608,
      extensionsUsed: [],
    });
    expect(stats.materialCount).toBe(2);
  });

  test("reports zero animations and textures for CHIARA-shaped input", () => {
    const stats = summarizeInspectReport(makeReport(), {
      fileSizeBytes: 674_608,
      extensionsUsed: [],
    });
    expect(stats.animationNames).toEqual([]);
    expect(stats.textures).toEqual([]);
  });

  test("maps texture properties to the app's TextureStat shape", () => {
    const report = makeReport({
      textures: {
        properties: [
          {
            name: "BaseColor",
            uri: "basecolor.jpg",
            slots: ["baseColorTexture"],
            instances: 1,
            mimeType: "image/jpeg",
            resolution: "2048x2048",
            compression: "",
            size: 900_000,
            gpuSize: null,
          },
        ],
      },
    });
    const stats = summarizeInspectReport(report, {
      fileSizeBytes: 674_608,
      extensionsUsed: [],
    });
    expect(stats.textures).toEqual([
      { name: "BaseColor", resolution: "2048x2048", format: "image/jpeg", sizeBytes: 900_000 },
    ]);
  });

  test("passes through the file size given by the caller", () => {
    const stats = summarizeInspectReport(makeReport(), {
      fileSizeBytes: 674_608,
      extensionsUsed: [],
    });
    expect(stats.fileSizeBytes).toBe(674_608);
  });

  test("detects Draco compression from extensionsUsed", () => {
    const stats = summarizeInspectReport(makeReport(), {
      fileSizeBytes: 674_608,
      extensionsUsed: ["KHR_draco_mesh_compression", "KHR_materials_ior"],
    });
    expect(stats.detectedCompression.draco).toBe(true);
    expect(stats.detectedCompression.meshopt).toBe(false);
    expect(stats.detectedCompression.ktx2).toBe(false);
    expect(stats.extensionsUsed).toEqual(["KHR_draco_mesh_compression", "KHR_materials_ior"]);
  });

  test("detects Meshopt and KTX2 compression from extensionsUsed", () => {
    const stats = summarizeInspectReport(makeReport(), {
      fileSizeBytes: 674_608,
      extensionsUsed: ["EXT_meshopt_compression", "KHR_texture_basisu"],
    });
    expect(stats.detectedCompression.draco).toBe(false);
    expect(stats.detectedCompression.meshopt).toBe(true);
    expect(stats.detectedCompression.ktx2).toBe(true);
  });

  test("collects animation clip names", () => {
    const report = makeReport({
      animations: {
        properties: [
          { name: "Idle", channels: 2, samplers: 2, keyframes: 60, duration: 2, size: 1000 },
          { name: "Spin", channels: 2, samplers: 2, keyframes: 120, duration: 4, size: 2000 },
        ],
      },
    });
    const stats = summarizeInspectReport(report, {
      fileSizeBytes: 674_608,
      extensionsUsed: [],
    });
    expect(stats.animationNames).toEqual(["Idle", "Spin"]);
  });
});
