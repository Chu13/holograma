import "@/ui/HowItWorks.css";

const STEPS = [
  {
    title: "One glTF file, one pipeline",
    body: "Every feature in HOLOGRAMA — the live viewer, the stats panel, iOS's AR file, the card's marker tracking — reads from the same glTF/GLB. There's no separate asset per feature to keep in sync; the pipeline branches from one file, not four.",
  },
  {
    title: "Rendering: three.js, in your browser",
    body: "The model loads via three.js's own GLTFLoader (with a self-hosted Draco decoder for compressed meshes) directly into a WebGL canvas — no third-party viewer embed. Lighting, shadows, and material toggles all run in real time on your GPU.",
  },
  {
    title: "Inspection: gltf-transform, also in your browser",
    body: "Drop in your own .glb and the exact same glTF-Transform library used by CLI pipelines parses it client-side — triangle and vertex counts, materials, textures, animations, and detected extensions (Draco, Meshopt, KTX2). The file is read with the browser's File API only; nothing is ever uploaded.",
  },
  {
    title: "AR: three different paths, on purpose",
    body: "Android's Scene Viewer and iOS's Quick Look are different systems with different file requirements — Scene Viewer wants a GLB at a public URL, Quick Look only opens USDZ. HOLOGRAMA serves the gallery's USDZ pre-generated at build time, and can build one at runtime — in your browser — for a model you drop in, with the simplifications that requires stated plainly, not hidden.",
  },
  {
    title: "The card: a physical shortcut into AR",
    body: "The QR on the printed card skips straight to the AR-ready page — no gallery browsing first. An experimental marker mode goes a step further: point your camera at the card itself and the model anchors to it directly, no scan required.",
  },
];

export function HowItWorks() {
  return (
    <section className="how-it-works" aria-labelledby="how-it-works-heading">
      <h2 id="how-it-works-heading" className="how-it-works__heading">
        How it works
      </h2>
      <ol className="how-it-works__list">
        {STEPS.map((step, index) => (
          <li key={step.title}>
            <span className="how-it-works__index label">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
