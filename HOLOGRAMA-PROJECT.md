# HOLOGRAMA — Project Report

**Level 05** of [Jesus "Chu" Bordones'](https://www.jabordones.com) arcade-themed portfolio: a
hand-built three.js 3D/AR viewer, reachable from a QR on Chu's business card.

- **Live app:** https://holograma.vercel.app
- **GitHub (public, under Chu13):** https://github.com/Chu13/holograma
- **Card destination (what the QR points to):** https://holograma.vercel.app/card

---

## What this is

Not a `<model-viewer>` embed, not a third-party viewer service — a renderer built from scratch on
three.js + React Three Fiber, with:

1. A **3D viewer** that loads CHIARA (a solitaire engagement ring — round brilliant diamond,
   4-prong setting, pavé band, ~132K triangles, Draco-compressed) by default, with orbit/zoom/pan,
   wireframe/normals/UV toggles, an exploded view, and hotspots.
2. **Real client-side inspection** — drag in any `.glb`/`.gltf` and get actual gltf-transform
   output (triangles, vertices, materials, textures, animations, detected extensions), never
   uploaded anywhere.
3. **Native AR** on both platforms: Android's Scene Viewer and iOS's Quick Look, via a
   pre-generated USDZ for the gallery model and a runtime-generated one for anything dropped in.
4. A **printable business card** (85×55mm + bleed, PDF + PNG) with an embedded QR that opens the
   AR experience directly, plus an **experimental** camera-based marker mode that anchors the
   model to the card image itself.

## What was actually built

### Branding
Brand Guardian designed HOLOGRAMA's identity as an extension of Chu's existing "Arcade Cabinet"
system, not a new brand — same dark violet-black canvas, the same three accent hues (magenta/
amber/cyan), the same type stack (Unbounded/Hanken Grotesk/Martian Mono). The one new thing: an
iridescent "Prism Aperture" mark — a faceted hexagonal gem/aperture built from a single gradient
sweep across the three existing accent hues, reserved for the HOLOGRAMA wordmark and hero moments
only. Source files in `brand/` (working files) and `public/brand/` (shipped assets), with
`USAGE.md` documenting the rules.

### The viewer (three.js + React Three Fiber)
Self-hosted Draco decoder (no CDN dependency), procedurally generated studio lighting (PMREM from
three's own `RoomEnvironment`, not a fetched HDRI), rendered contact shadows, keyboard-operable
orbit controls, and a poster-image fallback that gates the entire three.js/R3F bundle behind
`IntersectionObserver` — the landing page's own JS bundle is 239KB gzipped 77KB; the 3D/AR stack
never loads until a model page is actually opened.

### Real inspection, not a demo
`@gltf-transform/core`'s `WebIO` + `@gltf-transform/functions`'s `inspect()` run **in the
browser**, Draco-decoding via the same vendored decoder the renderer uses. Cross-checked against
the real `gltf-transform inspect` CLI on `chiara.glb`: 132,316 triangles, 4 materials, 0 textures,
0 animations — matches exactly. Vertex count (396,948) uses gltf-transform's own
`renderVertexCount` semantics, which is higher than a naive unique-position count because CHIARA
is flat-shaded (hard facet edges need split vertices) — verified, not assumed.

### AR, honestly
- Android Scene Viewer: works today for the gallery model (public HTTPS URL required — verified
  it rejects `blob:` URLs with a clear error).
- iOS Quick Look: gallery model ships a **pre-generated** USDZ (`scripts/build-usdz.mjs`, headless
  Chromium driving the real three.js `USDZExporter`); dropped models generate one **at runtime**,
  reusing the already-Draco-decoded scene graph instead of a worker (documented deviation from the
  spec — see README's AR section for the exact reasoning: nested-worker Draco decoding is least
  reliable on exactly the platform Quick Look runs on).
- Android + dropped model: no Scene Viewer path exists (needs a public URL) and WebXR placement
  isn't wired up yet — the UI says so plainly instead of pretending.

### The diamond material
CHIARA's stone materials carry a vendor extension (`WEBGI_materials_diamond`) three.js can't
render. Detected by cross-referencing the raw glTF JSON against `material.userData.uuid` after
load (three keeps `extras`, drops unknown `extensions`), then approximated with a
`MeshPhysicalMaterial` transmission material — stated as an approximation in the UI, not hidden.

### The card + marker mode
Card art (Brand Guardian's mark, a scattered faceted background pattern for real MindAR
trackability, embedded QR) rendered to exact-size PDF/PNG via Playwright. Marker mode is
**explicitly labeled EXPERIMENTAL**: `mind-ar`'s npm package couldn't install normally here (native
`canvas` build blocked by an unrelated Homebrew issue on the dev machine) — worked around by
vendoring just its browser bundle via `npm pack` (no install scripts triggered). One line of that
vendored bundle needed a hand-patch (a removed three.js export, `sRGBEncoding`) — documented in a
comment banner at the top of the patched file. Neither marker mode nor the pre-generated USDZ have
been verified against a real camera/device — this environment has neither.

### Tests
49 Vitest tests, all pure logic, TDD'd (red confirmed before green on every one): byte/count
formatting, the triangle budget, platform/AR capability detection, Scene Viewer intent URL and
Quick Look link construction, `extensionsUsed` parsing from raw GLB/glTF bytes (hand-built a
spec-correct GLB buffer in the test itself), diamond-material UUID extraction, and
`summarizeInspectReport` against a realistically-shaped `InspectReport`.

### Shipping
Public GitHub repo under `Chu13`, deployed to Vercel (`vercel.json` carries only an SPA rewrite —
deliberately no security headers, since the whole app must stay iframe-embeddable). Verified live:
no `X-Frame-Options`/CSP frame blocking, all three routes return 200, and an actual cross-origin
iframe embed test against the production URL loads cleanly with zero console errors.

## Known limitations (stated, not hidden)

- Runtime USDZ export runs on the main thread, not a worker — reasoned deviation, see README.
- WebXR AR placement for a dropped model on Android isn't implemented.
- Marker mode and the pre-generated USDZ are untested against a real device/camera.
- `USDZExporter` in this three.js version emits ASCII `.usda`, not binary `.usdc` — CHIARA's USDZ
  is ~11.2MB, larger than the 660KB source GLB would suggest.
- The build-time asset scripts (`build:usdz`, `build:poster`) target CHIARA specifically; taking a
  `--slug` argument like `build-poster.mjs`/`build-card-target.mjs` already do is the natural next
  step for adding a second gallery model.

## Coordination needed on the portfolio side

`Chu-Website/src/app/projects/[slug]/CaseStudy.tsx` embeds `demoUrl` in a sandboxed `<iframe>`.
For embedded WebXR/marker mode to work (not required for the primary Scene Viewer/Quick Look path,
which always opens a full page), that iframe's `sandbox` attribute needs `allow="camera;
xr-spatial-tracking"` added. Exact diff:

```diff
  <iframe
    src={project.demoUrl}
    title={`${project.title} — live preview`}
    loading="lazy"
    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
+   allow="camera; xr-spatial-tracking"
    className="h-full w-full"
  />
```

## Portfolio integration — paste-ready

For `Chu-Website/src/data/projects.ts` (matches the existing `Project` type exactly):

```ts
{
  slug: "holograma",
  levelNumber: "05",
  title: "HOLOGRAMA — 3D/AR Viewer",
  tagline: "Scan a card. Your work appears on the table.",
  description:
    "A hand-built three.js 3D/AR viewer — not a <model-viewer> embed. Loads a solitaire diamond ring by default, accepts drag-and-drop of any .glb/.gltf with a real client-side glTF-Transform inspection panel, and launches native AR on both iOS (Quick Look) and Android (Scene Viewer). A printable business card carries a QR straight into the AR experience, plus an experimental camera-based marker mode.",
  status: "active",
  tags: ["three.js", "React Three Fiber", "WebXR", "glTF", "AR"],
  demoUrl: "https://holograma.vercel.app",
  githubUrl: "https://github.com/Chu13/holograma",
  coverImage: "/projects/holograma-cover.png",
  coverImageAlt:
    "The HOLOGRAMA viewer showing CHIARA, a solitaire diamond engagement ring, in 3D against a dark background, with a real-time stats panel listing 132,316 triangles, 4 materials, and detected glTF extensions.",
  problem:
    "Seeing a .glb file properly means installing software. Online viewers upload your model to an opaque server. And a business card proves nothing about the work behind it. HOLOGRAMA answers a narrower question: what if the card itself launched the work — in 3D, on your actual table, in under five seconds?",
  architectureNote:
    "One glTF pipeline feeds four features, not four separate assets: the same .glb that renders in the three.js viewer is what gltf-transform inspects client-side, what a pre-generated USDZ was exported from for Quick Look, and what a MindAR target was compiled from for the card's marker mode. Android's Scene Viewer and iOS's Quick Look are genuinely different systems — one wants a public URL, the other only opens USDZ — so AR alone branches into two real, separately-tested paths instead of one that half-works everywhere.",
  year: 2026,
},
```

Cover image: copy `docs/cover-chiara.png` (1600×900, the live viewer with CHIARA and the real
stats panel visible) to `Chu-Website/public/projects/holograma-cover.png`.

Suggested `/log` entry:

> **HOLOGRAMA is live — Level 05.** A three.js 3D/AR viewer built from scratch: drop in any glTF
> model for a real client-side inspection, launch native AR on iOS or Android, or scan Chu's card
> and watch a diamond ring appear on your table. [Read the case study →]

## Printed card

`public/card/holograma-card.pdf` (exact 91×61mm bleed, print-ready) and
`public/card/holograma-card.png` (same, raster) — QR encodes the live `/card` URL.
