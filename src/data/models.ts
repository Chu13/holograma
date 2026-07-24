export type Hotspot = {
  id: string;
  /** Position in the model's local space [x, y, z]. */
  position: [number, number, number];
  label: string;
  description: string;
};

export type GalleryModel = {
  slug: string;
  name: string;
  tagline: string;
  /** Path under /public to the .glb, served at a public HTTPS URL in prod. */
  glbUrl: string;
  /** Pre-generated USDZ for iOS Quick Look — required for gallery models. */
  usdzUrl: string;
  posterUrl: string;
  posterAlt: string;
  hotspots?: Hotspot[];
  /**
   * Honest material notes shown in the UI — e.g. approximated shaders that
   * can't be reproduced exactly in three.js. Never hidden from the user.
   */
  materialNotes?: string[];
};

/**
 * The gallery. Launches with CHIARA only — add a new model by dropping a
 * .glb (and pre-generated .usdz, see scripts/build-usdz.mjs) into
 * public/models/ and adding one entry here. See README.md.
 */
export const galleryModels: GalleryModel[] = [
  {
    slug: "chiara",
    name: "CHIARA",
    tagline: "A cut-diamond jewelry piece — 54 facets, ~132K triangles.",
    glbUrl: "/models/chiara.glb",
    usdzUrl: "/models/chiara.usdz",
    posterUrl: "/posters/chiara-poster.webp",
    posterAlt:
      "A faceted diamond and gold jewelry piece named CHIARA, rendered in 3D against a dark background.",
    materialNotes: [
      "CHIARA's diamond was authored with a specialized WebGI shader (WEBGI_materials_diamond) that three.js doesn't natively support. In this viewer, it's rendered with real ray-traced refraction (drei's MeshRefractionMaterial, true diamond IOR) — close, not identical, to the original render.",
      "In AR (Quick Look / Scene Viewer), the diamond uses a different, simpler material — high reflectivity and a clearcoat highlight instead of refraction. Neither platform's AR renderer supports true glass/gem refraction, so matching the live viewer's look isn't possible there regardless of what's exported.",
    ],
  },
];

export function getGalleryModel(slug: string): GalleryModel | undefined {
  return galleryModels.find((model) => model.slug === slug);
}
