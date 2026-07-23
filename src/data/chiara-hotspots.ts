import type { Hotspot } from "@/data/models";

/**
 * CHIARA is a solitaire engagement ring: a round brilliant-cut center
 * stone in a 4-prong setting, a pavé diamond band on both sides of the
 * shank, and a plain lower shank. Positions were placed by actually
 * rendering the model (three.js + DRACOLoader, headless Chromium, three
 * camera angles) and reading its real bounding box
 * (x:[-1.26,1.26] y:[-1.52,1.52] z:[-0.32,0.32]) — not guessed. The mesh
 * data itself carries no part names (it's an unlabeled Rhino 3DM export),
 * so labels below describe only what's visibly true in the render.
 */
export const chiaraHotspots: Hotspot[] = [
  {
    id: "center-stone",
    position: [0, 1.3, 0.05],
    label: "Center stone",
    description: "A round brilliant-cut stone set at the top of the ring.",
  },
  {
    id: "prong-setting",
    position: [0, 0.95, 0],
    label: "Prong setting",
    description:
      "A 4-prong mount holds the center stone above an open gallery/basket.",
  },
  {
    id: "pave-band",
    position: [0.8, 0.55, 0.15],
    label: "Pavé band",
    description:
      "A row of smaller pavé-set stones runs along the shank on both sides of the setting.",
  },
  {
    id: "shank",
    position: [0, -1.35, 0],
    label: "Shank",
    description: "The plain lower half of the band, opposite the stone.",
  },
];
