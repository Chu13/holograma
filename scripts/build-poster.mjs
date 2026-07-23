// Renders a static poster image for a gallery model — the fallback shown
// before the interactive three.js canvas mounts (no WebGL, prefers-reduced-
// data, or simply not scrolled into view yet; see src/three/Viewer.tsx).
// Same headless-Chromium + local-static-server approach as build-usdz.mjs,
// for the same reason: WebGL/Draco decoding needs a real browser.
//
// Usage: node scripts/build-poster.mjs <model-slug> [--width=960] [--height=720]
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith("--"));
const width = Number(args.find((a) => a.startsWith("--width="))?.split("=")[1] ?? 960);
const height = Number(args.find((a) => a.startsWith("--height="))?.split("=")[1] ?? 720);

if (!slug) {
  console.error("Usage: node scripts/build-poster.mjs <model-slug> [--width=960] [--height=720]");
  process.exit(1);
}

const publicDir = path.resolve("public");
const threeDir = path.resolve("node_modules/three");
const glbRelativePath = `/models/${slug}.glb`;

try {
  await stat(path.join(publicDir, glbRelativePath));
} catch {
  console.error(`No such model: public${glbRelativePath}`);
  process.exit(1);
}

const HARNESS_PATH = "/__poster_harness__.html";
const THREE_SRC_PREFIX = "/three-src/";

const HARNESS_HTML = `<!doctype html><html><body style="margin:0;background:#0E0814">
<script type="importmap">{"imports":{"three":"${THREE_SRC_PREFIX}build/three.module.js","three/addons/":"${THREE_SRC_PREFIX}examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, ${width / height}, 0.01, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setSize(${width}, ${height});
renderer.setPixelRatio(2);
document.body.appendChild(renderer.domElement);

// Same procedural studio lighting as the live app's
// src/three/ProceduralEnvironment.tsx (PMREM from three's own
// RoomEnvironment) — the metal/diamond materials are near-black without
// an environment to reflect, and the poster should look like the real
// viewer, not a flatter stand-in.
const pmremGenerator = new THREE.PMREMGenerator(renderer);
scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
pmremGenerator.dispose();

scene.add(new THREE.HemisphereLight(0xffffff, 0x22182b, 0.6));
const key = new THREE.DirectionalLight(0xffffff, 1.2); key.position.set(2, 3, 4); scene.add(key);
const rim = new THREE.DirectionalLight(0x00c1e5, 0.8); rim.position.set(-1, 2, -3); scene.add(rim);

const draco = new DRACOLoader();
draco.setDecoderPath('/draco/');
const loader = new GLTFLoader();
loader.setDRACOLoader(draco);

window.renderDone = false;
loader.load('${glbRelativePath}', (gltf) => {
  scene.add(gltf.scene);
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  camera.position.set(center.x + maxDim * 0.85, center.y + maxDim * 0.55, center.z + maxDim * 1.2);
  camera.lookAt(center);
  renderer.render(scene, camera);
  window.__dataUrl = renderer.domElement.toDataURL('image/webp', 0.92);
  window.renderDone = true;
}, undefined, (err) => { window.renderError = String((err && err.message) || err); window.renderDone = true; });
</script>
</body></html>`;

function contentTypeFor(filePath) {
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".wasm")) return "application/wasm";
  if (filePath.endsWith(".glb")) return "model/gltf-binary";
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  return "application/octet-stream";
}

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
      const relative = isThreeSrc ? pathname.slice(THREE_SRC_PREFIX.length) : pathname;
      const filePath = path.join(root, relative);

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
      res.end("Not found");
    }
  });
}

const server = createStaticServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height } });
const pageErrors = [];
page.on("pageerror", (err) => pageErrors.push(String(err)));

try {
  await page.goto(`http://127.0.0.1:${port}${HARNESS_PATH}`);
  await page.waitForFunction(() => window.renderDone === true, { timeout: 20000 });
  const renderError = await page.evaluate(() => window.renderError);
  if (renderError) throw new Error(`three.js render error: ${renderError}`);
  if (pageErrors.length > 0) throw new Error(`Page errors: ${pageErrors.join("; ")}`);

  const dataUrl = await page.evaluate(() => window.__dataUrl);
  const base64 = dataUrl.split(",")[1];
  const outPath = path.join(publicDir, "posters", `${slug}-poster.webp`);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, Buffer.from(base64, "base64"));

  const fileStat = await stat(outPath);
  console.log(`Wrote ${outPath} (${(fileStat.size / 1024).toFixed(1)} KB, ${width}x${height})`);
} finally {
  await browser.close();
  server.close();
}
