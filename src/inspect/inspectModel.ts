import { WebIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { inspect } from "@gltf-transform/functions";
import { getDracoDecoderModule } from "@/inspect/dracoModule";
import { parseExtensionsUsed } from "@/inspect/extensions";
import { summarizeInspectReport, type ModelStats } from "@/inspect/stats";

let ioPromise: Promise<WebIO> | null = null;

async function getIO(): Promise<WebIO> {
  if (!ioPromise) {
    ioPromise = getDracoDecoderModule().then(
      (dracoModule) =>
        new WebIO()
          .registerExtensions(ALL_EXTENSIONS)
          .registerDependencies({ "draco3d.decoder": dracoModule }),
    );
  }
  return ioPromise;
}

const GLB_MAGIC = 0x46546c67; // 'glTF'

/**
 * Inspect a glTF/GLB ArrayBuffer entirely in the browser — no upload, no
 * server round-trip. Used for both the gallery's own models and anything a
 * user drags in. Registers every known extension so `inspect()` doesn't
 * choke on an arbitrary dropped file, and Draco decoding via the same
 * vendored decoder three.js's own DRACOLoader uses (see dracoModule.ts).
 *
 * A standalone .gltf (as opposed to .glb) can reference external .bin /
 * texture files by relative URI — those bytes don't exist when only a
 * single file was dropped, so such a .gltf is read with an empty resource
 * map. That's honest: geometry/material counts still work, and gltf-transform
 * will report a clear error for anything that actually needed a missing
 * external resource, rather than this module silently pretending full
 * multi-file resolution is supported.
 */
export async function inspectModelBuffer(buffer: ArrayBuffer): Promise<ModelStats> {
  const io = await getIO();
  const isBinary = buffer.byteLength >= 4 && new DataView(buffer).getUint32(0, true) === GLB_MAGIC;

  const document = isBinary
    ? await io.readBinary(new Uint8Array(buffer))
    : await io.readJSON({
        json: JSON.parse(new TextDecoder("utf-8").decode(buffer)),
        resources: {},
      });

  const report = inspect(document);
  const extensionsUsed = parseExtensionsUsed(buffer);

  return summarizeInspectReport(report, {
    fileSizeBytes: buffer.byteLength,
    extensionsUsed,
  });
}
