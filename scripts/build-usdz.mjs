#!/usr/bin/env node
/**
 * build-usdz.mjs
 *
 * Build-time generator for public/models/chiara.usdz.
 *
 * iOS Quick Look AR requires a USDZ file (it will not open a .glb). Since
 * CHIARA is the site's one pre-vetted gallery model, the spec requires the
 * USDZ to be pre-generated at build time and committed to the repo, rather
 * than generated live on every page load.
 *
 * three.js ships an official USDZExporter (three/examples/jsm/exporters/
 * USDZExporter.js) that turns a loaded THREE.Object3D/Scene into a USDZ
 * ArrayBuffer. USDZExporter leans on browser APIs (canvas/OffscreenCanvas/
 * Blob) for texture and material handling, so it needs to run inside a real
 * browser rather than plain Node. This script drives it inside a headless
 * Chromium page via Playwright:
 *
 *   1. Spin up a tiny local static HTTP server (127.0.0.1, ephemeral port)
 *      that serves this project's public/ directory (for chiara.glb and the
 *      vendored Draco decoder) and the three package's module sources (for
 *      GLTFLoader / DRACOLoader / USDZExporter) — served over http:// rather
 *      than file:// because fetch()/WASM loading in a browser context is
 *      unreliable over file://.
 *   2. Load a tiny harness page in headless Chromium that imports three's
 *      module build via an import map, loads chiara.glb through GLTFLoader
 *      (with DRACOLoader attached, since KHR_draco_mesh_compression is a
 *      required extension on this GLB), and exports the resulting scene via
 *      `new USDZExporter().parseAsync(scene, options)`.
 *   3. Pass the resulting bytes back out of the page (base64-encoded, over
 *      Playwright's page.evaluate() return channel) and write them to
 *      public/models/chiara.usdz from the Node process.
 *
 * The static server exists only for the lifetime of this script (and is
 * always torn down, success or failure) — it is not part of the deployed
 * app and never sets any response headers, in keeping with this project's
 * "must stay iframe-embeddable" constraint elsewhere.
 *
 * Known limitation (expected, not a bug): CHIARA's diamond material uses
 * non-standard WEBGI_materials_diamond / other WEBGI_* glTF extensions that
 * three.js does not understand. three simply falls back to whatever
 * standard PBR properties exist on the material — it does not crash, and it
 * does not produce true diamond refraction. That is a known, documented
 * approximation elsewhere in the project; this script does not treat the
 * resulting "unknown extension" warnings as fatal.
 *
 * Usage: node scripts/build-usdz.mjs   (wired up as `npm run build:usdz`)
 */

import { createServer } from "node:http";
import { readFile, stat, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const publicDir = path.join(projectRoot, "public");
const threeDir = path.join(projectRoot, "node_modules", "three");
const glbPath = path.join(publicDir, "models", "chiara.glb");
const outputPath = path.join(publicDir, "models", "chiara.usdz");

const THREE_SRC_PREFIX = "/three-src/";
const HARNESS_PATH = "/__harness.html";

// A USDZ built from a 660KB, texture-free, Draco-compressed 132K-triangle
// GLB should land somewhere in the range of a few hundred KB to a few MB.
// Anything below this floor almost certainly means a broken/empty export.
const MIN_SANE_OUTPUT_BYTES = 10 * 1024;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".wasm": "application/wasm",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".json": "application/json; charset=utf-8",
  ".bin": "application/octet-stream",
};

function contentTypeFor(filePath) {
  return MIME_TYPES[path.extname(filePath)] || "application/octet-stream";
}

/**
 * The in-browser harness. Loads three's module build (via an import map),
 * GLTFLoader + DRACOLoader + USDZExporter from the same three package this
 * app depends on, loads chiara.glb, and exports it to USDZ bytes.
 */
const HARNESS_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>build-usdz harness</title>
<script type="importmap">
{
  "imports": {
    "three": "${THREE_SRC_PREFIX}build/three.module.js"
  }
}
</script>
</head>
<body>
<script type="module">
import * as THREE from "three";
import { GLTFLoader } from "${THREE_SRC_PREFIX}examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "${THREE_SRC_PREFIX}examples/jsm/loaders/DRACOLoader.js";
import { USDZExporter } from "${THREE_SRC_PREFIX}examples/jsm/exporters/USDZExporter.js";

function arrayBufferToBase64(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

window.__exportUsdz = async function () {
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath("/draco/");

  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);

  const gltf = await gltfLoader.loadAsync("/models/chiara.glb");

  const exporter = new USDZExporter();
  const arrayBuffer = await exporter.parseAsync(gltf.scene, {
    quickLookCompatible: true,
  });

  dracoLoader.dispose();

  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    throw new Error("USDZExporter.parseAsync returned an empty buffer");
  }

  return {
    base64: arrayBufferToBase64(arrayBuffer),
    byteLength: arrayBuffer.byteLength,
  };
};

window.__harnessReady = true;
</script>
</body>
</html>
`;

function createStaticServer() {
  return createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url ?? "/", "http://127.0.0.1");
      const pathname = decodeURIComponent(requestUrl.pathname);

      if (pathname === HARNESS_PATH) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(HARNESS_HTML);
        return;
      }

      const isThreeSrc = pathname.startsWith(THREE_SRC_PREFIX);
      const root = isThreeSrc ? threeDir : publicDir;
      const relative = isThreeSrc
        ? pathname.slice(THREE_SRC_PREFIX.length)
        : pathname;
      const filePath = path.join(root, relative);

      // Guard against path traversal escaping the intended root.
      const resolvedRoot = path.resolve(root) + path.sep;
      if (!path.resolve(filePath).startsWith(resolvedRoot)) {
        res.writeHead(403, { "Content-Type": "text/plain" });
        res.end("Forbidden");
        return;
      }

      const data = await readFile(filePath);
      res.writeHead(200, { "Content-Type": contentTypeFor(filePath) });
      res.end(data);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end(`Not found: ${req.url}`);
    }
  });
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
}

function close(server) {
  return new Promise((resolve) => server.close(() => resolve()));
}

async function main() {
  try {
    await stat(glbPath);
  } catch {
    throw new Error(
      `Source GLB not found at ${glbPath} — cannot build chiara.usdz.`,
    );
  }

  await mkdir(path.dirname(outputPath), { recursive: true });

  const server = createStaticServer();
  await listen(server);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Static server failed to bind to a TCP port.");
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;

  let browser;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage();

    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      consoleErrors.push(String(err?.stack ?? err));
    });

    await page.goto(`${baseUrl}${HARNESS_PATH}`, { waitUntil: "load" });
    await page.waitForFunction(() => window.__harnessReady === true, {
      timeout: 15000,
    });

    let result;
    try {
      result = await page.evaluate(() => window.__exportUsdz());
    } catch (evalError) {
      const context =
        consoleErrors.length > 0
          ? `\n\nBrowser console errors:\n${consoleErrors.join("\n")}`
          : "";
      throw new Error(
        `USDZ export failed inside headless Chromium (GLB load, Draco ` +
          `decode, or USDZExporter threw): ${evalError?.message ?? evalError}${context}`,
      );
    }

    if (!result || typeof result.base64 !== "string" || !result.byteLength) {
      throw new Error(
        "USDZ export produced no data (empty/undefined result from the page).",
      );
    }

    const buffer = Buffer.from(result.base64, "base64");

    if (buffer.length < MIN_SANE_OUTPUT_BYTES) {
      throw new Error(
        `Exported USDZ is suspiciously small (${buffer.length} bytes, ` +
          `expected at least ${MIN_SANE_OUTPUT_BYTES} bytes) — this almost ` +
          `certainly indicates a broken/empty export. Refusing to write it.`,
      );
    }

    await writeFile(outputPath, buffer);

    console.log(
      `[build-usdz] Wrote ${path.relative(projectRoot, outputPath)} ` +
        `(${buffer.length.toLocaleString()} bytes)`,
    );
  } finally {
    if (browser) await browser.close();
    await close(server);
  }
}

main().catch((err) => {
  console.error("[build-usdz] FAILED to build chiara.usdz");
  console.error(err?.stack ?? err);
  process.exitCode = 1;
});
