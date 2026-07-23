import { describe, expect, test } from "vitest";
import { extractDiamondMaterialUuids } from "@/three/diamondMaterials";

describe("extractDiamondMaterialUuids", () => {
  test("returns the extras.uuid of materials carrying WEBGI_materials_diamond", () => {
    const json = {
      materials: [
        { extensions: { WEBGI_material_extras: {} } }, // no extras, no diamond
        {
          extras: { uuid: "diamond-1" },
          extensions: { WEBGI_materials_diamond: { refractiveIndex: 2.6 } },
        },
        { name: "Default", extras: { uuid: "metal-uuid" } }, // has extras, not a diamond
        {
          extras: { uuid: "diamond-2" },
          extensions: { WEBGI_materials_diamond: { refractiveIndex: 2.6 } },
        },
      ],
    };
    expect(extractDiamondMaterialUuids(json)).toEqual(["diamond-1", "diamond-2"]);
  });

  test("returns an empty array when there are no materials", () => {
    expect(extractDiamondMaterialUuids({})).toEqual([]);
  });

  test("skips a diamond-flagged material that has no extras.uuid to correlate by", () => {
    const json = {
      materials: [{ extensions: { WEBGI_materials_diamond: {} } }],
    };
    expect(extractDiamondMaterialUuids(json)).toEqual([]);
  });

  test("returns an empty array when no material uses the diamond extension", () => {
    const json = {
      materials: [{ extras: { uuid: "a" } }, { name: "Default", extras: { uuid: "b" } }],
    };
    expect(extractDiamondMaterialUuids(json)).toEqual([]);
  });
});
