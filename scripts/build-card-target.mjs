#!/usr/bin/env node
/**
 * build-card-target.mjs
 *
 * Compiles a MindAR image-tracking target (.mind) from the FINISHED,
 * trim-only card artwork (public/card/holograma-card-trim.png — 85x55mm,
 * no bleed, no trim/safe guides, since the phone camera only ever sees the
 * physically printed & cut card, not the print-shop bleed margin).
 *
 * Uses the browser bundle vendored into public/vendor/ (see
 * scripts/build-card.mjs's neighbor task / README context — mind-ar's
 * `canvas` dependency can't be natively built in this environment, so we
 * fetched the pre-built dist via `npm pack mind-ar@1.2.5` instead of
 * `npm install`, and vendored the browser ESM bundle + its two shared
 * chunks: mindar-image.prod.js, controller-mGt1s8dJ.js, ui-fBadYuor.js).
 *
 * The vendored bundle is genuine ESM with *relative* imports
 * ("./controller-mGt1s8dJ.js" etc.), which Chromium refuses to resolve
 * under a file:// origin (module script fetches are CORS-mode and file://
 * doesn't satisfy that reliably) — so this script spins up a short-lived
 * local static HTTP server over public/, points a real Playwright/Chromium
 * page at it, and drives MindAR's exported `Compiler` class directly:
 *
 *   const { Compiler } = window.MINDAR.IMAGE;
 *   const compiler = new Compiler();
 *   const dataList = await compiler.compileImageTargets([imgEl], progressCb);
 *   const buffer = compiler.exportData(); // Uint8Array (msgpack-encoded)
 *
 * That buffer is handed back to Node (via page.exposeFunction, base64-
 * encoded) and written verbatim to public/card/card.mind.
 */

import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const OUT_DIR = path.join(ROOT, "public/card");
const TARGET_IMAGE = path.join(OUT_DIR, "holograma-card-trim.png");
const OUT_MIND = path.join(OUT_DIR, "card.mind");

const MIME = {
  ".js": "text/javascript",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".html": "text/html",
};

/** Minimal static file server over public/, plus one in-memory harness route. */
function startServer(harnessHtml) {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname === "/__compile__") {
        res.writeHead(200, { "content-type": "text/html" });
        res.end(harnessHtml);
        return;
      }
      const filePath = path.join(PUBLIC_DIR, decodeURIComponent(url.pathname));
      if (!filePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403);
        res.end("forbidden");
        return;
      }
      const data = await readFile(filePath);
      const ext = path.extname(filePath);
      res.writeHead(200, { "content-type": MIME[ext] || "application/octet-stream" });
      res.end(data);
    } catch (err) {
      res.writeHead(404);
      res.end(`not found: ${err.message}`);
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function buildHarnessHtml() {
  return `<!doctype html>
<html><head><meta charset="utf-8"></head>
<body>
<script type="module">
  async function run() {
    try {
      const mod = await import('/vendor/mindar-image.prod.js');
      const { Compiler } = mod;
      if (typeof Compiler !== 'function') {
        throw new Error('Compiler export is not a constructor: ' + typeof Compiler);
      }

      const img = new Image();
      const imgLoaded = new Promise((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = (e) => reject(new Error('image failed to load: ' + e));
      });
      img.src = '/card/holograma-card-trim.png';
      await imgLoaded;

      window.__log('image loaded: ' + img.width + 'x' + img.height);

      const compiler = new Compiler();
      const dataList = await compiler.compileImageTargets([img], (percent) => {
        window.__progress(percent);
      });
      window.__log('compileImageTargets resolved, targets: ' + dataList.length);

      const buffer = compiler.exportData(); // Uint8Array
      window.__log('exportData() returned ' + buffer.byteLength + ' bytes, ctor=' + buffer.constructor.name);

      // base64-encode in chunks to avoid call-stack blowups on large buffers
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < buffer.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, buffer.subarray(i, i + chunkSize));
      }
      const base64 = btoa(binary);
      await window.__deliver(base64);
    } catch (err) {
      await window.__fail(String(err && err.stack ? err.stack : err));
    }
  }
  run();
</script>
</body></html>`;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const imgStat = await stat(TARGET_IMAGE).catch(() => null);
  if (!imgStat) {
    console.error(
      `Missing ${path.relative(ROOT, TARGET_IMAGE)}. Run "npm run build:card" first (it renders the trim-only PNG this script compiles against).`,
    );
    process.exitCode = 1;
    return;
  }

  const server = await startServer(buildHarnessHtml());
  const { port } = server.address();
  console.log(`Local static server for public/ started on http://127.0.0.1:${port}`);

  // MindAR's feature detector runs through @tensorflow/tfjs's webgl backend
  // (see compiler-base.js: tf.tidy/tf.tensor + a WebGL-only "BinomialFilter"
  // kernel with no CPU-backend fallback registered in this bundle). Without
  // --enable-unsafe-swiftshader, current Chromium refuses to hand out a
  // SwiftShader-backed WebGL context in headless mode at all ("Could not
  // get context for WebGL version 2/1"), tf.js silently falls back to the
  // 'cpu' backend, and compileImageTargets() then throws
  // "Kernel 'BinomialFilter' not registered for backend 'cpu'". Confirmed
  // by reproducing that exact failure without this flag before adding it.
  const browser = await chromium.launch({
    args: [
      "--enable-unsafe-swiftshader",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--ignore-gpu-blocklist",
      "--enable-webgl",
      "--enable-webgl2",
    ],
  });
  try {
    const page = await browser.newPage();

    page.on("console", (msg) => console.log(`[page:${msg.type()}] ${msg.text()}`));
    page.on("pageerror", (err) => console.error("[page:error]", err));

    let resultBase64 = null;
    let failure = null;

    await page.exposeFunction("__log", (msg) => console.log(`[compile] ${msg}`));
    await page.exposeFunction("__progress", (percent) => {
      process.stdout.write(`\r[compile] progress: ${Number(percent).toFixed(1)}%   `);
    });
    await page.exposeFunction("__deliver", (base64) => {
      resultBase64 = base64;
    });
    await page.exposeFunction("__fail", (message) => {
      failure = message;
    });

    // Sanity: confirm WebGL is actually available in this headless context,
    // since MindAR's feature detector runs through @tensorflow/tfjs's webgl
    // backend (tf.tidy/tf.tensor calls in compiler-base.js).
    await page.goto(`http://127.0.0.1:${port}/__compile__`);
    const webglInfo = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      if (!gl) return { available: false };
      return {
        available: true,
        version: gl.getParameter(gl.VERSION),
        renderer: gl.getParameter(gl.RENDERER),
      };
    });
    console.log("WebGL context in headless Chromium:", webglInfo);

    // Poll for completion (compile can take a while for a busy texture).
    const start = Date.now();
    const TIMEOUT_MS = 5 * 60 * 1000;
    while (resultBase64 === null && failure === null) {
      if (Date.now() - start > TIMEOUT_MS) {
        throw new Error(`Timed out after ${TIMEOUT_MS}ms waiting for compileImageTargets()`);
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    process.stdout.write("\n");

    if (failure) {
      throw new Error(`MindAR Compiler failed in-browser: ${failure}`);
    }

    const mindBuffer = Buffer.from(resultBase64, "base64");
    await writeFile(OUT_MIND, mindBuffer);

    const s = await stat(OUT_MIND);
    console.log(
      `\nWrote ${path.relative(ROOT, OUT_MIND)} (${(s.size / 1024).toFixed(1)} KB) compiled from ${path.relative(ROOT, TARGET_IMAGE)}`,
    );
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error("\nbuild-card-target.mjs failed:", err);
  console.error(
    "\nAutomated .mind compilation did not succeed. As a manual fallback, use MindAR's official hosted compiler tool: https://hiukim.github.io/mind-ar-js-doc/tools/compile/ with public/card/holograma-card-trim.png as the input image.",
  );
  process.exitCode = 1;
});
