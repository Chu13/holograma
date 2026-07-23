const GLB_MAGIC = 0x46546c67; // 'glTF'
const CHUNK_TYPE_JSON = 0x4e4f534a; // 'JSON'

export type RawGltfJson = Record<string, unknown>;

/**
 * Parse the raw glTF JSON document out of either a binary .glb or a
 * plain-text .gltf file. Shared by parseExtensionsUsed (stats panel) and
 * three/diamondMaterials.ts (material-approximation detection) — both need
 * the untouched raw JSON because three.js's GLTFLoader and gltf-transform's
 * Document both drop unknown vendor extensions during parsing.
 */
export function parseGltfJson(buffer: ArrayBuffer): RawGltfJson {
  const view = new DataView(buffer);
  const looksLikeGlb = buffer.byteLength >= 12 && view.getUint32(0, true) === GLB_MAGIC;
  return looksLikeGlb ? readGlbJsonChunk(buffer, view) : readGltfJsonText(buffer);
}

/**
 * Read `extensionsUsed` directly from raw glTF bytes.
 *
 * This exists because `@gltf-transform`'s `Document.listExtensionsUsed()`
 * only returns extensions it has a registered handler for — vendor
 * extensions like CHIARA's `WEBGI_materials_diamond` are silently dropped
 * from that list even though they're present in the file. Reading the raw
 * JSON is the only way to report every extension honestly in the stats
 * panel, including ones HOLOGRAMA can't render.
 */
export function parseExtensionsUsed(buffer: ArrayBuffer): string[] {
  const json = parseGltfJson(buffer);
  return Array.isArray(json.extensionsUsed) ? (json.extensionsUsed as string[]) : [];
}

function readGlbJsonChunk(buffer: ArrayBuffer, view: DataView): RawGltfJson {
  if (buffer.byteLength < 20) {
    throw new Error("parseGltfJson: buffer is too small to be a valid GLB.");
  }
  const chunkLength = view.getUint32(12, true);
  const chunkType = view.getUint32(16, true);
  if (chunkType !== CHUNK_TYPE_JSON) {
    throw new Error("parseGltfJson: GLB's first chunk is not a JSON chunk.");
  }
  const jsonBytes = new Uint8Array(buffer, 20, chunkLength);
  const text = new TextDecoder("utf-8").decode(jsonBytes);
  return JSON.parse(text);
}

function readGltfJsonText(buffer: ArrayBuffer): RawGltfJson {
  const text = new TextDecoder("utf-8").decode(buffer);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      "parseGltfJson: buffer is neither a valid GLB nor a parseable glTF JSON file.",
    );
  }
}
