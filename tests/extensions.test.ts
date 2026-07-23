import { describe, expect, test } from "vitest";
import { parseExtensionsUsed } from "@/inspect/extensions";

function textToBuffer(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer;
}

function buildGlb(json: object): ArrayBuffer {
  const jsonText = JSON.stringify(json);
  // Pad JSON chunk to a 4-byte boundary with spaces, per the glTF spec.
  const padded = jsonText + " ".repeat((4 - (jsonText.length % 4)) % 4);
  const jsonBytes = new TextEncoder().encode(padded);

  const totalLength = 12 + 8 + jsonBytes.length;
  const buffer = new ArrayBuffer(totalLength);
  const view = new DataView(buffer);

  view.setUint32(0, 0x46546c67, true); // magic 'glTF'
  view.setUint32(4, 2, true); // version
  view.setUint32(8, totalLength, true); // total length

  view.setUint32(12, jsonBytes.length, true); // chunk length
  view.setUint32(16, 0x4e4f534a, true); // chunk type 'JSON'
  new Uint8Array(buffer, 20, jsonBytes.length).set(jsonBytes);

  return buffer;
}

describe("parseExtensionsUsed", () => {
  test("reads extensionsUsed from a binary .glb buffer", () => {
    const buffer = buildGlb({
      asset: { version: "2.0" },
      extensionsUsed: ["KHR_draco_mesh_compression", "WEBGI_materials_diamond"],
    });
    expect(parseExtensionsUsed(buffer)).toEqual([
      "KHR_draco_mesh_compression",
      "WEBGI_materials_diamond",
    ]);
  });

  test("returns an empty array when a .glb has no extensionsUsed field", () => {
    const buffer = buildGlb({ asset: { version: "2.0" } });
    expect(parseExtensionsUsed(buffer)).toEqual([]);
  });

  test("reads extensionsUsed from a plain-text .gltf JSON buffer", () => {
    const buffer = textToBuffer(
      JSON.stringify({
        asset: { version: "2.0" },
        extensionsUsed: ["KHR_materials_variants"],
      }),
    );
    expect(parseExtensionsUsed(buffer)).toEqual(["KHR_materials_variants"]);
  });

  test("throws a clear error for a buffer that is neither glTF JSON nor a valid GLB", () => {
    const buffer = textToBuffer("not json at all {{{");
    expect(() => parseExtensionsUsed(buffer)).toThrow(/glTF/i);
  });

  test("throws a clear error for a corrupt GLB magic header", () => {
    const buffer = new ArrayBuffer(12);
    const view = new DataView(buffer);
    view.setUint32(0, 0xdeadbeef, true);
    expect(() => parseExtensionsUsed(buffer)).toThrow();
  });
});
