import type { InspectReport } from "@gltf-transform/functions";

export type TextureStat = {
  name: string;
  resolution: string;
  format: string;
  sizeBytes: number;
};

export type CompressionFlags = {
  draco: boolean;
  meshopt: boolean;
  ktx2: boolean;
};

export type ModelStats = {
  triangles: number;
  vertices: number;
  materialCount: number;
  textures: TextureStat[];
  fileSizeBytes: number;
  animationNames: string[];
  extensionsUsed: string[];
  detectedCompression: CompressionFlags;
};

export type SummarizeOptions = {
  /** The original file's byte size — inspect() reports don't carry this. */
  fileSizeBytes: number;
  /**
   * `extensionsUsed` from the raw glTF JSON (or
   * `document.getRoot().listExtensionsUsed()`) — kept as caller input so
   * this module stays a pure formatter, not an extension-detection engine.
   */
  extensionsUsed: string[];
};

function detectCompression(extensionsUsed: string[]): CompressionFlags {
  return {
    draco: extensionsUsed.includes("KHR_draco_mesh_compression"),
    meshopt: extensionsUsed.includes("EXT_meshopt_compression"),
    ktx2: extensionsUsed.includes("KHR_texture_basisu"),
  };
}

/**
 * Normalize a real `@gltf-transform/functions` `inspect()` report into the
 * shape HOLOGRAMA's stats panel renders. Triangle count sums each mesh's
 * `glPrimitives` (the GL-primitive/triangle count gltf-transform's own CLI
 * reports); vertex count prefers the scene's `renderVertexCount`, which
 * accounts for instancing correctly, and falls back to summing mesh vertex
 * counts only when a document has no scene.
 */
export function summarizeInspectReport(
  report: InspectReport,
  options: SummarizeOptions,
): ModelStats {
  const triangles = report.meshes.properties.reduce(
    (sum, mesh) => sum + mesh.glPrimitives,
    0,
  );

  const scene = report.scenes.properties[0];
  const vertices =
    scene !== undefined
      ? scene.renderVertexCount
      : report.meshes.properties.reduce((sum, mesh) => sum + mesh.vertices, 0);

  const textures: TextureStat[] = report.textures.properties.map((texture) => ({
    name: texture.name,
    resolution: texture.resolution,
    format: texture.mimeType,
    sizeBytes: texture.size,
  }));

  return {
    triangles,
    vertices,
    materialCount: report.materials.properties.length,
    textures,
    fileSizeBytes: options.fileSizeBytes,
    animationNames: report.animations.properties.map((animation) => animation.name),
    extensionsUsed: options.extensionsUsed,
    detectedCompression: detectCompression(options.extensionsUsed),
  };
}
