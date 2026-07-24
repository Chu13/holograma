#!/usr/bin/env node
/**
 * optimize-usdz.mjs
 *
 * Repackages public/models/chiara.usdz — as written by build-usdz.mjs via
 * three.js's USDZExporter — from its as-exported form (a root `model.usda`
 * text layer referencing ~50 per-mesh `geometries/Geometry_N.usda` text
 * layers, one per glTF primitive) into a single flattened, binary `usdc`
 * layer repackaged as a USDZ. Same geometry and materials, just a different
 * on-disk encoding: text USD stores every vertex/normal/UV as ASCII floats
 * across dozens of small files, which is why an 660KB Draco-compressed,
 * texture-free GLB balloons to an 11MB+ USDZ. Binary `usdc` stores the same
 * data as raw floats — no camera/material/quality difference, just a
 * several-times-smaller file that Quick Look also parses faster.
 *
 * Chained onto `npm run build:usdz` (see package.json) so a normal build
 * always ends with the optimized file, not a separate manual step.
 *
 * Uses Pixar/OpenUSD's own command-line tools (usdcat, usdzip, usdchecker)
 * — not a JS/npm package, since no maintained JS binary-USD writer exists.
 * These ship with `usd-core` (pip) / various USD installs; NOT guaranteed
 * present in every environment (e.g. a from-scratch Linux CI image without
 * it installed). When missing, this script logs why and exits 0 — the
 * ASCII USDZ build-usdz.mjs already wrote is a complete, valid, if larger,
 * fallback, and `npm run build:usdz` must keep working cross-platform.
 *
 * Pipeline (see each execFileSync call below for exact flags, verified by
 * hand against this project's real chiara.usdz before being scripted):
 *   1. unzip the current chiara.usdz to a tmp dir.
 *   2. Read the archive's original entry order (`unzip -Z1`) to find the
 *      root/default layer — the USDZ spec requires it to be the first
 *      entry, so this doesn't hardcode build-usdz.mjs's current filename.
 *   3. `usdcat --flatten <root layer> -o chiara.usd --usdFormat usdc` —
 *      composes every referenced geometry layer into one binary stage.
 *      (`.usd`, not `.usdc`, is required on the *output filename* — it's
 *      USD's format-agnostic extension; `--usdFormat` picks the encoding.)
 *   4. `usdzip --arkitAsset chiara.usd out.usdz` — packages it AND applies
 *      the extra transforms RealityKit/Quick Look need beyond generic USD
 *      (stricter than a plain `usdzip out.usdz chiara.usd`).
 *   5. `usdchecker --arkit out.usdz` — the actual Quick Look compliance
 *      bar, not just "is this a well-formed usdz". Must pass, or this
 *      script aborts and leaves the original file in place.
 *   6. Replace public/models/chiara.usdz only if the result is both
 *      arkit-compliant and smaller than what's there.
 *
 * Usage: node scripts/optimize-usdz.mjs   (wired up at the end of `npm run build:usdz`)
 */

import { execFileSync } from "node:child_process";
import { mkdtemp, rm, stat, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const usdzPath = path.join(projectRoot, "public", "models", "chiara.usdz");

// unzip is included alongside the USD-specific tools: virtually always
// present, but the whole point of this gate is "never break the build" —
// no exceptions for tools that merely happen to be common.
const REQUIRED_TOOLS = ["unzip", "usdcat", "usdzip", "usdchecker"];

function toolAvailable(tool) {
  try {
    // --help is used purely as a cheap, side-effect-free invocation to
    // prove the binary exists and execFileSync can spawn it — its exit
    // code / output are irrelevant, only whether spawning threw ENOENT.
    execFileSync(tool, ["--help"], { stdio: "ignore" });
    return true;
  } catch (err) {
    return err?.code !== "ENOENT";
  }
}

async function main() {
  const missing = REQUIRED_TOOLS.filter((tool) => !toolAvailable(tool));
  if (missing.length > 0) {
    console.log(
      `[optimize-usdz] Skipping: missing command-line tool(s): ${missing.join(", ")}. ` +
        `public/models/chiara.usdz stays as build-usdz.mjs wrote it (ASCII, larger but ` +
        `fully valid). Install Pixar/OpenUSD's tools (e.g. \`pip install usd-core\`) to ` +
        `enable this optimization.`,
    );
    return;
  }

  let originalSize;
  try {
    originalSize = (await stat(usdzPath)).size;
  } catch {
    throw new Error(`${usdzPath} not found — run \`node scripts/build-usdz.mjs\` first.`);
  }

  const tmpDir = await mkdtemp(path.join(tmpdir(), "holograma-usdz-"));
  try {
    const extractDir = path.join(tmpDir, "extracted");
    execFileSync("unzip", ["-q", usdzPath, "-d", extractDir]);

    const listing = execFileSync("unzip", ["-Z1", usdzPath], { encoding: "utf-8" })
      .trim()
      .split("\n")
      .filter(Boolean);
    const rootLayer = listing[0];
    if (!rootLayer) {
      throw new Error("Could not determine the USDZ's root layer (empty archive listing).");
    }

    const flattenedPath = path.join(tmpDir, "chiara.usd");
    execFileSync("usdcat", [
      "--flatten",
      path.join(extractDir, rootLayer),
      "-o",
      flattenedPath,
      "--usdFormat",
      "usdc",
    ]);

    const optimizedPath = path.join(tmpDir, "chiara-optimized.usdz");
    execFileSync("usdzip", ["--arkitAsset", flattenedPath, optimizedPath]);

    // Throws (nonzero exit) on any compliance failure — deliberately not
    // caught here, so a regression aborts the whole build rather than
    // silently shipping a Quick-Look-incompatible file.
    execFileSync("usdchecker", ["--arkit", optimizedPath]);

    const optimizedSize = (await stat(optimizedPath)).size;
    if (optimizedSize >= originalSize) {
      console.log(
        `[optimize-usdz] Skipping: optimized output (${optimizedSize.toLocaleString()} bytes) ` +
          `is not smaller than the current file (${originalSize.toLocaleString()} bytes). ` +
          `Leaving public/models/chiara.usdz untouched.`,
      );
      return;
    }

    await copyFile(optimizedPath, usdzPath);
    const pct = (100 * (1 - optimizedSize / originalSize)).toFixed(1);
    console.log(
      `[optimize-usdz] Repackaged public/models/chiara.usdz as binary usdc: ` +
        `${originalSize.toLocaleString()} -> ${optimizedSize.toLocaleString()} bytes ` +
        `(-${pct}%), usdchecker --arkit: pass.`,
    );
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("[optimize-usdz] FAILED");
  console.error(err?.stack ?? err?.stderr?.toString?.() ?? err);
  process.exitCode = 1;
});
