# brown_photostudio_02_2k.hdr

Source: [Poly Haven](https://polyhaven.com/a/brown_photostudio_02) — CC0 (public domain), no
attribution legally required, credited here anyway.

- Resolution: 2K (2048×1024), plain `.hdr` (Radiance RGBE), ~6.2MB.
- Downloaded from `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/brown_photostudio_02_2k.hdr`,
  verified against Poly Haven's own published MD5 (`15f9d0a5bde4a67e0b7d266f07bc166c`) after download.
- Why this one: a neutral studio environment with several distinct bright softbox light sources —
  CHIARA (the default gallery model) has zero texture maps, so all of its surface detail comes from
  IBL reflections on bare PBR material factors. A flat/evenly-lit HDRI would produce a dull, detail-
  less render; the separated bright sources here are what produce real facet sparkle and metal "pop."
- Why 2K, not 1K or 4K: 1K visibly pixelates reflections on smooth polished metal/gem facets; 2K→4K
  is a much smaller perceptual gain for 4x the file size. See `HOLOGRAMA-PROJECT.md`/README for the
  fuller reasoning (this was researched, not guessed).
- Why plain `.hdr`, not a gainmap `.webp`: `.hdr` loads via three's built-in `RGBELoader` (used by
  drei's `<Environment files>`) with zero extra build tooling. A gainmap `.webp` would be smaller but
  needs an encoding step and the `@monogrid/gainmap-js` package — not worth the added complexity
  given the model itself is only ~660KB. Worth revisiting only if HDRI fetch time proves to be a real
  mobile load-time problem in practice.

Self-hosted, not loaded from a CDN — consistent with this project's Draco-decoder precedent
(`public/draco/`) and `src/three/ProceduralEnvironment.tsx`'s existing no-CDN-dependency principle.
