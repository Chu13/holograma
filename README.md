# HOLOGRAMA

A hand-built three.js 3D/AR viewer — no `<model-viewer>` embed, no third-party service. Drop in
any `.glb`/`.gltf` and get a real client-side inspection (triangles, materials, textures,
animations, detected extensions), launch native AR on iOS (Quick Look) or Android (Scene Viewer),
or scan a physical card and watch a model appear on your table.

This is **Level 05** of [Jesus "Chu" Bordones' portfolio](https://www.jabordones.com) — a
standalone, publicly deployed project embedded in that site's case study.

## Live

- App: _see `demoUrl` once deployed_
- Card experience (what the QR points to): `/card`

## Stack

Vite + React 19 + TypeScript, `three` + `@react-three/fiber` + `@react-three/drei` for rendering,
`@gltf-transform/core`/`functions`/`extensions` for in-browser inspection, `react-router-dom` for
routing, Vitest for pure-logic tests, Playwright for build-time asset generation (headless
Chromium, used because WebGL/Draco decoding needs a real browser, not Node).

## Getting started

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # Vitest — pure logic (stats parsing, AR URL builders, budget, capabilities)
npm run build     # tsc -b && vite build
npm run lint      # oxlint (vendored third-party files excluded, see .oxlintrc.json)
```

## Architecture

**One glTF pipeline, several consumers.** Every feature — the live viewer, the stats panel, the
iOS AR file, the card's marker tracking — reads the same `.glb`. There's no separate asset per
feature.

- `src/three/` — the renderer. `Model.tsx` loads via `useGLTF` (drei) with a **self-hosted** Draco
  decoder (`public/draco/`, copied from `three/examples/jsm/libs/draco/gltf/` — never drei's
  default CDN decoder, so the app has no runtime dependency on a third party). `Viewer.tsx` wraps
  the R3F `Canvas`, lazy-mounting it only once the viewer scrolls into view (`useInViewport`) and
  falling back to a poster image otherwise — no WebGL, `prefers-reduced-data`, and "not yet
  visible" all render the same static fallback. Lighting is a **procedurally generated** studio
  environment (`ProceduralEnvironment.tsx`, PMREM from three's own `RoomEnvironment` — not an HDRI
  fetched from a CDN, same self-contained principle as the Draco decoder).
- `src/inspect/` — the inspector. `inspectModel.ts` runs `@gltf-transform/core`'s `WebIO` +
  `@gltf-transform/functions`'s `inspect()` **in the browser**, decoding Draco via the same
  vendored decoder (loaded as a classic script for its `DracoDecoderModule` global — see
  `dracoModule.ts`). `extensions.ts` separately reads `extensionsUsed` from the raw glTF JSON,
  because `Document.listExtensionsUsed()` only returns extensions gltf-transform has a registered
  handler for — CHIARA's vendor extensions (`WEBGI_materials_diamond` etc.) would otherwise vanish
  from the stats panel even though they're really in the file. **No upload endpoint exists
  anywhere in this app** — a dropped file is read via the File API and never leaves the browser;
  open DevTools' Network tab while dropping a file to verify.
- `src/ar/` — the three AR paths (see below), each genuinely different because Android and iOS
  solve "put a 3D model in the real world" with different systems.
- `src/data/models.ts` — the gallery. Launches with CHIARA only; add a model by dropping a `.glb`
  into `public/models/`, running `npm run build:usdz -- <slug>` and
  `npm run build:poster -- <slug>` (see below), and adding one entry here.

### AR: three different paths, on purpose

| Platform | Mechanism | Requirement | What HOLOGRAMA does |
|---|---|---|---|
| Android | Scene Viewer | `intent://` URL, model at a **public https URL** — cannot fetch `blob:` | Gallery models: works today. Dropped models: honest "not supported" message (WebXR hit-test is the natural next step, not yet wired up — see `ARButton.tsx`). |
| iOS | Quick Look | `<a rel="ar">` pointing at a **`.usdz`** file — GLB doesn't work | Gallery models: `.usdz` is **pre-generated at build time** (`scripts/build-usdz.mjs`) and committed to the repo. Dropped models: generated **at runtime**, in the browser (`src/ar/usdzRuntime.ts`). |
| Either | WebXR `immersive-ar` | Browser support only | Detected (`lib/capabilities.ts`), not yet used to place a dropped model — see the Android row. |

**Runtime USDZ generation deviates from the spec's "in a worker" instruction, deliberately** — see
the long comment in `src/ar/usdzRuntime.ts`. Short version: Draco decoding needs its own nested
worker, and nested-worker support is least reliable on exactly the platform Quick Look runs on
(iOS Safari). The model is already loaded and Draco-decoded on the main thread for the live
viewer anyway, so the runtime exporter reuses that scene graph instead of re-decoding inside a
worker — strictly faster, at the cost of a brief (already-async, non-blocking) main-thread export
step.

**Pre-generated USDZ, verified:** `scripts/build-usdz.mjs` drives headless Chromium (Playwright) —
loads the GLB through the exact same three.js `GLTFLoader`/`DRACOLoader` path the app uses, then
`USDZExporter.parseAsync(scene, { quickLookCompatible: true })`. The resulting
`public/models/chiara.usdz` is ~11.2 MB — larger than you might expect from a 660 KB source,
because this three.js version's `USDZExporter` writes ASCII `.usda` text layers, not a packed
binary `.usdc` crate (verified: `unzip -l` shows 55/55 entries are `.usda`). Valid, spec-compliant
USDZ; **not device-tested against real Quick Look** in this environment (no physical iPhone
available) — recommended before calling AR fully verified.

### The diamond material

CHIARA's stone materials use a vendor extension, `WEBGI_materials_diamond` (refractive index 2.6,
per the source data), that three.js doesn't understand — it's silently dropped during parsing.
`src/three/diamondMaterials.ts` detects which materials carried that extension (by reading the raw
glTF JSON, then matching `extras.uuid` against `material.userData.uuid` — three's GLTFLoader keeps
`extras` but drops unknown `extensions`) and swaps them for a `MeshPhysicalMaterial` transmission
approximation. **Stated as an approximation in the UI**, not hidden — see the model page's material
notes and `data/models.ts`'s `materialNotes`.

### The card + marker mode

- `scripts/build-card.mjs` renders the printable card (85×55mm + 3mm bleed) to exact-size PDF and
  PNG via Playwright, embedding a QR (the `qrcode` package) that encodes the deployed `/card` URL.
  Re-run with the real URL once deployed: `CARD_URL=https://<your-domain>/card npm run build:card`.
- Marker mode (**explicitly labeled EXPERIMENTAL in the UI**) uses MindAR image tracking so the
  camera can anchor CHIARA directly to the printed card, no QR scan needed for that specific
  interaction. `mind-ar`'s npm package couldn't be installed normally here — its `canvas`
  dependency needs native compilation (`node-gyp` + system `pango`/`cairo`) blocked by an unrelated
  Homebrew tap-trust issue on the build machine. Worked around by fetching just the browser bundle
  via `npm pack mind-ar@1.2.5` (no `npm install`, so no native build triggers) and vendoring it
  under `src/vendor/mindar/` — under `src/`, not `public/`, because the bundle imports the bare
  specifier `"three"`, which only resolves through Vite's bundler, not as a static asset. **Hand-
  patched** one line in that vendored file: it imported three.js's long-removed `sRGBEncoding`
  export, a hard Rollup build error against this project's pinned three version — see the comment
  banner at the top of `src/vendor/mindar/mindar-image-three.prod.js`.
  `scripts/build-card-target.mjs` compiles `public/card/card.mind` from the card artwork using that
  vendored bundle's `Compiler` API, also via headless Chromium (needed real Chromium flags —
  `--enable-unsafe-swiftshader` and friends — to get WebGL working in headless mode for TF.js).
  **Not device-tested against a real camera** — this environment has none. `ARButton`'s Scene
  Viewer/Quick Look path is the reliable one; marker mode is exactly as experimental as it's
  labeled.

### Performance budget

`lib/budget.ts`: ≤150,000 triangles recommended for a smooth 60fps orbit on a mid-range phone. A
dropped model over that gets an honest warning in the stats panel (`warn` past 150K, `high` past
300K) — never a silently-fine panel. CHIARA itself is ~132K triangles, inside budget.

### Iframe embeddability

The portfolio embeds this app in a sandboxed `<iframe>`. **No `X-Frame-Options` or
`frame-ancestors` CSP is set anywhere** (`vercel.json` only carries an SPA rewrite) — that's
required, not an oversight; don't add security headers here without checking this first. AR
launches (Quick Look/Scene Viewer/marker mode) always target a full page, never the iframe.

**Coordination note for the portfolio repo:** the case-study `<iframe>` needs
`allow="camera; xr-spatial-tracking"` added to its `sandbox`/`allow` attributes for embedded
WebXR/marker mode to work — not something this repo can change. See
`HOLOGRAMA-PROJECT.md` for the exact diff.

## Adding a gallery model

1. Drop `your-model.glb` into `public/models/`.
2. `npm run build:usdz` currently targets CHIARA specifically — generalizing it to take a slug
   argument (like `build-poster.mjs` and `build-card-target.mjs` already do) is the natural next
   step; for now, adapt the constant at the top of `scripts/build-usdz.mjs`.
3. `npm run build:poster -- your-model` → `public/posters/your-model-poster.webp`.
4. Add an entry to `galleryModels` in `src/data/models.ts` (slug, name, tagline, `glbUrl`,
   `usdzUrl`, `posterUrl`, `posterAlt`, optional `hotspots`/`materialNotes`).

## Testing

Vitest covers the pure logic: `formatBytes`/`formatCount`, the triangle budget, platform/AR
capability detection, the Scene Viewer intent URL and Quick Look link builders, `extensionsUsed`
parsing from raw GLB/glTF bytes, diamond-material UUID extraction, and `summarizeInspectReport`
against a `@gltf-transform/functions`-shaped `InspectReport` (cross-checked against the real
`gltf-transform inspect` CLI output on `chiara.glb` — 132,316 triangles, 4 materials, 0
textures/animations, matching exactly).

```bash
npm test
```

## Known limitations, stated plainly

- Runtime USDZ export runs on the main thread, not a worker (see above).
- WebXR placement for a dropped model on Android isn't implemented — an honest message shows
  instead.
- Marker mode and the pre-generated USDZ haven't been verified on a real device/camera in this
  development environment.
- `USDZExporter` output is ASCII (`.usda`), not binary (`.usdc`) — larger files than a packed
  crate would produce, though still a spec-valid USDZ.
