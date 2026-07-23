#!/usr/bin/env node
/**
 * build-card.mjs
 *
 * Generates the printable HOLOGRAMA business card (front only):
 *   - public/card/holograma-card.png        91x61mm bleed artboard, ~300dpi
 *   - public/card/holograma-card.pdf        exact 91mm x 61mm print-ready PDF
 *   - public/card/holograma-card-trim.png   85x55mm trim-only artwork (no
 *                                            bleed/guides) — this is the file
 *                                            scripts/build-card-target.mjs
 *                                            compiles the MindAR .mind target
 *                                            from, since the camera only ever
 *                                            sees the trimmed, printed card.
 *   - public/card/holograma-card-guides.png bonus: bleed art + trim/safe
 *                                            guide overlay, for reference only
 *                                            (not a print deliverable).
 *
 * The target URL encoded in the QR is CARD_URL (CLI arg takes precedence,
 * then the CARD_URL env var, then a placeholder) so this script can be
 * re-run once the app is actually deployed without touching the design:
 *
 *   node scripts/build-card.mjs https://holograma.example/card
 *   CARD_URL=https://holograma.jabordones.com/card node scripts/build-card.mjs
 */

import { readFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BRAND_DIR = path.join(ROOT, "public/brand");
const OUT_DIR = path.join(ROOT, "public/card");

const CARD_URL =
  process.argv[2] || process.env.CARD_URL || "https://holograma.example/card";

// ---------------------------------------------------------------------------
// Print geometry
//
// DPI = 300 (standard print resolution). 1in = 25.4mm, so:
//   PX_PER_MM = 300 / 25.4 = 11.811023622047244 px/mm
//
// Canvas (bleed) = trim (85x55mm) + 3mm bleed on every side = 91x61mm.
// Pixel dimensions are rounded once at the canvas level; the bleed margin in
// px is rounded once too, and the trim pixel box is *derived* by subtracting
// (rather than independently re-rounding 85/55mm), so the clipped trim PNG
// shares the exact same coordinate space as the bleed PNG with no seam:
//
//   canvasWidthPx  = round(91 * PX_PER_MM) = 1075
//   canvasHeightPx = round(61 * PX_PER_MM) = 720
//   bleedPx        = round(3  * PX_PER_MM) = 35
//   trimWidthPx    = canvasWidthPx  - 2*bleedPx = 1005
//   trimHeightPx   = canvasHeightPx - 2*bleedPx = 650
// ---------------------------------------------------------------------------
const DPI = 300;
const PX_PER_MM = DPI / 25.4;
const BLEED_MM = 3;
const TRIM_W_MM = 85;
const TRIM_H_MM = 55;
const SAFE_INSET_MM = 3; // inside the trim edge
const CANVAS_W_MM = TRIM_W_MM + BLEED_MM * 2; // 91
const CANVAS_H_MM = TRIM_H_MM + BLEED_MM * 2; // 61

const canvasWidthPx = Math.round(CANVAS_W_MM * PX_PER_MM);
const canvasHeightPx = Math.round(CANVAS_H_MM * PX_PER_MM);
const bleedPx = Math.round(BLEED_MM * PX_PER_MM);
const trimWidthPx = canvasWidthPx - bleedPx * 2;
const trimHeightPx = canvasHeightPx - bleedPx * 2;

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32) — same background pattern every run unless
// the seed below is changed, so re-running the script (e.g. only to update
// the QR target) doesn't needlessly churn the artwork.
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Background "trackable texture" — scattered, non-repeating hex-facet
// clusters echoing the Prism Aperture mark's six-triangle construction
// (mark.svg), but flat single-color fills per shape (never the mark's
// reserved iridescent gradient — see public/brand/USAGE.md: "Don't use the
// mark/wordmark gradient as a repeating pattern... it isn't decorative
// wallpaper"). This gives MindAR rich, non-repeating local contrast across
// the whole card face instead of a plain logo on an empty field.
// ---------------------------------------------------------------------------
const PATTERN_PALETTE = [
  { fill: "#2B2136", opacity: [0.35, 0.6] }, // elevation-2 surface
  { fill: "#2B2136", opacity: [0.35, 0.6] },
  { fill: "#3C3347", opacity: [0.3, 0.55] }, // border tone
  { fill: "#3C3347", opacity: [0.3, 0.55] },
  { fill: "#D63BD6", opacity: [0.06, 0.14] }, // primary accent
  { fill: "#FFC100", opacity: [0.05, 0.12] }, // secondary accent
  { fill: "#00C1E5", opacity: [0.06, 0.14] }, // tertiary accent
];

function hexFacetGroup({ cx, cy, r, rotationDeg, fill, opacity }) {
  const angles = [-90, -30, 30, 90, 150, 210].map(
    (a) => ((a + rotationDeg) * Math.PI) / 180,
  );
  const pts = angles.map((a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  let polys = "";
  for (let i = 0; i < 6; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % 6];
    polys += `<polygon points="${cx.toFixed(2)},${cy.toFixed(2)} ${p1[0].toFixed(2)},${p1[1].toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}"/>`;
  }
  return `<g fill="${fill}" opacity="${opacity.toFixed(3)}" stroke="#0E0814" stroke-width="0.15" stroke-linejoin="round">${polys}</g>`;
}

function buildBackgroundPatternSvg({ seed = 42, count = 90 } = {}) {
  const rng = mulberry32(seed);
  let shapes = "";
  for (let i = 0; i < count; i++) {
    const cx = -6 + rng() * (CANVAS_W_MM + 12);
    const cy = -6 + rng() * (CANVAS_H_MM + 12);
    const r = 3 + rng() * 9; // 3mm - 12mm facet radius, multi-scale texture
    const rotationDeg = rng() * 360;
    const palette = PATTERN_PALETTE[Math.floor(rng() * PATTERN_PALETTE.length)];
    const opacity =
      palette.opacity[0] + rng() * (palette.opacity[1] - palette.opacity[0]);
    shapes += hexFacetGroup({
      cx,
      cy,
      r,
      rotationDeg,
      fill: palette.fill,
      opacity,
    });
  }
  return `<svg class="bg-pattern-svg" viewBox="0 0 ${CANVAS_W_MM} ${CANVAS_H_MM}" xmlns="http://www.w3.org/2000/svg">${shapes}</svg>`;
}

function buildGuidesSvg() {
  const trimX = BLEED_MM;
  const trimY = BLEED_MM;
  const safeX = BLEED_MM + SAFE_INSET_MM;
  const safeY = BLEED_MM + SAFE_INSET_MM;
  const safeW = TRIM_W_MM - SAFE_INSET_MM * 2;
  const safeH = TRIM_H_MM - SAFE_INSET_MM * 2;
  const tick = 2.5; // crop mark length, mm
  const gap = 0.6; // gap between crop mark and trim corner, mm
  const corners = [
    [trimX, trimY, -1, -1],
    [trimX + TRIM_W_MM, trimY, 1, -1],
    [trimX, trimY + TRIM_H_MM, -1, 1],
    [trimX + TRIM_W_MM, trimY + TRIM_H_MM, 1, 1],
  ];
  let marks = "";
  for (const [x, y, dx, dy] of corners) {
    marks += `<line x1="${x + dx * gap}" y1="${y}" x2="${x + dx * (gap + tick)}" y2="${y}"/>`;
    marks += `<line x1="${x}" y1="${y + dy * gap}" x2="${x}" y2="${y + dy * (gap + tick)}"/>`;
  }
  return `<svg class="guides-svg" viewBox="0 0 ${CANVAS_W_MM} ${CANVAS_H_MM}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${trimX}" y="${trimY}" width="${TRIM_W_MM}" height="${TRIM_H_MM}" fill="none" stroke="#00C1E5" stroke-width="0.25" stroke-dasharray="1.2 1"/>
    <rect x="${safeX}" y="${safeY}" width="${safeW}" height="${safeH}" fill="none" stroke="#FFC100" stroke-width="0.2" stroke-dasharray="1 1"/>
    <g stroke="#F7F3FC" stroke-width="0.2">${marks}</g>
  </svg>`;
}

// ---------------------------------------------------------------------------
// HTML template. Every mm-based CSS length routes through calc(N * var(--mm))
// so the same markup can serve both render passes:
//   - PNG pass: --mm = 11.811023622047244px (i.e. 300dpi baked directly into
//     the CSS px), viewport set to the exact target pixel size, deviceScaleFactor 1.
//   - PDF pass: --mm is switched (via page.evaluate, no reload) to the
//     browser-native `1mm` CSS unit, and page.pdf({width:'91mm',height:'61mm'})
//     prints the page at true physical size.
// ---------------------------------------------------------------------------
function mm(v) {
  return `calc(${v} * var(--mm))`;
}

function buildHtml({ lockupSvg, qrSvg, patternSvg, guidesSvg, cardUrl }) {
  const displayUrl = cardUrl.replace(/^https?:\/\//, "");
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Unbounded:wght@400;600;800&family=Hanken+Grotesk:wght@400;600&family=Martian+Mono&display=swap"
/>
<style>
  :root { --mm: ${PX_PER_MM}px; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0; background: transparent;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .canvas {
    position: relative;
    width: ${mm(CANVAS_W_MM)};
    height: ${mm(CANVAS_H_MM)};
    background: #0E0814;
    overflow: hidden;
    font-family: "Hanken Grotesk", ui-sans-serif, sans-serif;
  }
  .bg-pattern-svg, .guides-svg {
    position: absolute; inset: 0; width: 100%; height: 100%; display: block;
  }
  .guides-svg { opacity: 0; pointer-events: none; }
  .show-guides .guides-svg { opacity: 1; }

  .content {
    position: absolute;
    left: ${mm(BLEED_MM + SAFE_INSET_MM)};
    top: ${mm(BLEED_MM + SAFE_INSET_MM)};
    width: ${mm(TRIM_W_MM - SAFE_INSET_MM * 2)};
    height: ${mm(TRIM_H_MM - SAFE_INSET_MM * 2)};
    display: flex;
    flex-direction: column;
  }

  .row-header {
    height: ${mm(8)};
    margin-bottom: ${mm(2)};
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  /* lockup.svg's own <text> wordmark measures ~345.4 user units wide when
     laid out with the real, web-loaded Unbounded 800 (its declared
     viewBox is only 300 wide), so the SVG's default overflow:hidden clips
     the final "A" of HOLOGRAMA. We don't edit the source brand file — the
     fix lives entirely here at the point of embedding: size the container
     to the file's *nominal* 300:64 box (small enough to leave generous
     clearance before the "Level 05" badge) and let the true content
     overflow visibly via overflow:visible, so the full wordmark paints. */
  .lockup { width: ${mm(30)}; height: ${mm(6.4)}; }
  .lockup svg { width: 100%; height: 100%; display: block; overflow: visible; }

  .badge {
    font-family: "Martian Mono", ui-monospace, monospace;
    font-size: ${mm(2.3)};
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #B2AABD;
    background: #1C1425;
    border: ${mm(0.3)} solid #3C3347;
    border-radius: ${mm(1)};
    padding: ${mm(1.2)} ${mm(2.2)};
    white-space: nowrap;
  }

  .tagline {
    height: ${mm(11)};
    margin-bottom: ${mm(2)};
    font-family: "Hanken Grotesk", ui-sans-serif, sans-serif;
    font-weight: 600;
    font-size: ${mm(4.2)};
    line-height: 1.3;
    color: #F7F3FC;
    max-width: ${mm(66)};
  }

  .row-footer {
    height: ${mm(26)};
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
  }

  .footer-caption { display: flex; flex-direction: column; gap: ${mm(1.4)}; }
  .footer-caption .label {
    font-family: "Martian Mono", ui-monospace, monospace;
    font-size: ${mm(2.4)};
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #B2AABD;
  }
  .footer-caption .url {
    font-family: "Hanken Grotesk", ui-sans-serif, sans-serif;
    font-weight: 400;
    font-size: ${mm(2.8)};
    color: #F7F3FC;
  }

  .qr-chip {
    width: ${mm(26)};
    height: ${mm(26)};
    background: #F7F3FC;
    border-radius: ${mm(1.5)};
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
  }
  .qr-graphic { width: ${mm(22)}; height: ${mm(22)}; }
  .qr-graphic svg { width: 100%; height: 100%; display: block; }
</style>
</head>
<body>
  <div class="canvas" id="canvas">
    <div class="bg-pattern">${patternSvg}</div>
    <div class="content">
      <div class="row-header">
        <div class="lockup">${lockupSvg}</div>
        <div class="badge">Level 05</div>
      </div>
      <div class="tagline">Scan to see CHIARA rise on your table in AR.</div>
      <div class="row-footer">
        <div class="footer-caption">
          <div class="label">Scan for AR</div>
          <div class="url">${displayUrl}</div>
        </div>
        <div class="qr-chip"><div class="qr-graphic">${qrSvg}</div></div>
      </div>
    </div>
    ${guidesSvg}
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Tiny PNG IHDR reader (verify actual raster dimensions of what we wrote,
// independent of the intended calc — no extra dependency needed).
// ---------------------------------------------------------------------------
async function readPngDimensions(filePath) {
  const buf = await readFile(filePath);
  // PNG signature (8 bytes) + IHDR chunk: 4 length + 4 "IHDR" + 4 width + 4 height
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

async function fileSummary(filePath) {
  const s = await stat(filePath);
  const kb = (s.size / 1024).toFixed(1);
  return `${path.relative(ROOT, filePath)}  (${kb} KB)`;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  console.log(`Target URL for QR: ${CARD_URL}`);
  console.log(
    `Geometry: canvas ${CANVAS_W_MM}x${CANVAS_H_MM}mm (bleed) -> ${canvasWidthPx}x${canvasHeightPx}px @ ${DPI}dpi; trim ${TRIM_W_MM}x${TRIM_H_MM}mm -> ${trimWidthPx}x${trimHeightPx}px; bleed margin ${BLEED_MM}mm -> ${bleedPx}px`,
  );

  const [lockupSvg] = await Promise.all([
    readFile(path.join(BRAND_DIR, "lockup.svg"), "utf8"),
  ]);

  const qrSvg = await QRCode.toString(CARD_URL, {
    type: "svg",
    errorCorrectionLevel: "Q",
    margin: 2,
    color: { dark: "#0E0814", light: "#F7F3FC" },
  });

  const patternSvg = buildBackgroundPatternSvg({ seed: 42, count: 90 });
  const guidesSvg = buildGuidesSvg();

  const html = buildHtml({
    lockupSvg,
    qrSvg,
    patternSvg,
    guidesSvg,
    cardUrl: CARD_URL,
  });

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: canvasWidthPx, height: canvasHeightPx },
      deviceScaleFactor: 1,
    });

    await page.setContent(html, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);

    // 1) Full bleed PNG — required deliverable.
    const pngPath = path.join(OUT_DIR, "holograma-card.png");
    await page.screenshot({ path: pngPath, type: "png" });

    // 2) Trim-only PNG (no bleed, no guides) — MindAR compile input.
    const trimPngPath = path.join(OUT_DIR, "holograma-card-trim.png");
    await page.screenshot({
      path: trimPngPath,
      type: "png",
      clip: { x: bleedPx, y: bleedPx, width: trimWidthPx, height: trimHeightPx },
    });

    // 3) Bonus: bleed art + trim/safe guide overlay, for reference only.
    const guidesPngPath = path.join(OUT_DIR, "holograma-card-guides.png");
    await page.evaluate(() => document.body.classList.add("show-guides"));
    await page.screenshot({ path: guidesPngPath, type: "png" });
    await page.evaluate(() => document.body.classList.remove("show-guides"));

    // 4) PDF — switch the same live DOM to native mm units (no reload) and
    //    print at the exact 91mm x 61mm bleed page size.
    await page.evaluate(() => {
      document.documentElement.style.setProperty("--mm", "1mm");
    });
    // Force a layout flush so the mm-mode reflow is committed before print.
    await page.evaluate(() => document.body.offsetHeight);

    const pdfPath = path.join(OUT_DIR, "holograma-card.pdf");
    await page.pdf({
      path: pdfPath,
      width: `${CANVAS_W_MM}mm`,
      height: `${CANVAS_H_MM}mm`,
      printBackground: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
      pageRanges: "1",
    });

    // ---- summary ----
    const pngDims = await readPngDimensions(pngPath);
    const trimDims = await readPngDimensions(trimPngPath);
    const guidesDims = await readPngDimensions(guidesPngPath);
    const pdfBuf = await readFile(pdfPath);
    const mediaBoxMatch = pdfBuf.toString("latin1").match(/\/MediaBox\s*\[[^\]]*\]/);

    console.log("\nFiles written:");
    console.log(
      `  ${await fileSummary(pngPath)} — ${pngDims.width}x${pngDims.height}px (91x61mm bleed @300dpi)`,
    );
    console.log(
      `  ${await fileSummary(trimPngPath)} — ${trimDims.width}x${trimDims.height}px (85x55mm trim only, MindAR compile input)`,
    );
    console.log(
      `  ${await fileSummary(guidesPngPath)} — ${guidesDims.width}x${guidesDims.height}px (bleed art + trim/safe guides, reference only)`,
    );
    console.log(
      `  ${await fileSummary(pdfPath)} — page size ${CANVAS_W_MM}mm x ${CANVAS_H_MM}mm${mediaBoxMatch ? ` (raw PDF ${mediaBoxMatch[0]})` : ""}`,
    );
    console.log(
      `\nQR currently encodes: ${CARD_URL}${CARD_URL === "https://holograma.example/card" ? "  (placeholder — re-run with the real deployed URL once live)" : ""}`,
    );
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
