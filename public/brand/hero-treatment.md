# HOLOGRAMA — Hero Treatment Concept

How the Prism Aperture mark's iridescent treatment extends from a static logo into the landing-page hero moment, without breaking the parent system's flat-by-design rule.

## The idea in one sentence

The mark doesn't just sit in the corner as a logo — a single large, softly-blurred instance of it sits *behind* the 3D viewer canvas, like the hologram's own light source, while the wordmark in front of it carries the same gradient. Everything else on the page stays flat neutral surfaces, exactly like the parent system.

## Layers, back to front

1. **Canvas.** `#0E0814` (`--color-bg`), full bleed. No change from the parent system.

2. **Ambient glow (reuse, don't reinvent).** One instance of the parent site's existing `AmbientGlow` primitive — `70vmin` square, `blur(80px)`, `border-radius: 50%` — centered behind the hero content, colored primary magenta (`#D63BD6` / `oklch(64% 0.25 328)`), opacity `0.3`. This is the *only* non-mark visual effect in the hero; it's the same component/CSS the parent site already ships, just placed here. Do not invent a second glow primitive.

3. **Facet shard field (new, mark-derived, optional/progressive enhancement).** Behind or beside the 3D canvas, 3–5 large, mostly-transparent triangles echoing the mark's own facet geometry (reuse the exact triangle shapes from `mark.svg`, scaled up 4–8x, rotated/repositioned individually — not the whole hexagon, just 1 or 2 facets at a time so it reads as "shards of the mark," not a stray copy of the logo). Each shard fill is the same `holoFacet` linear-gradient (`#D63BD6 → #FFC100 → #00C1E5 → #D63BD6`), but at 6–12% opacity so it reads as light-catching glass, not a decal. No stroke, no blur, no drop-shadow on the shard edges themselves — they stay flat-cut, exactly like the mark. This is a CSS/SVG background layer, not a 3D object; it sits in the DOM behind the `<canvas>`, not inside the three.js scene.

4. **The 3D canvas.** CHIARA (or whatever `.glb` is loaded) rendered normally, unchanged by any of the above — the hero effect frames the viewer, it never touches its lighting or materials.

5. **Wordmark.** The `lockup.svg` (or its React equivalent) at hero scale, gradient-filled per `USAGE.md`. This is one of the two sanctioned places the iridescent gradient is allowed to touch actual UI (the other being the mark itself) — it does not extend to the tagline, which stays plain `ink`/`muted`.

## Exact values to implement

```css
:root {
  --holo-magenta: #D63BD6; /* 0%  stop, oklch(64% 0.25 328) */
  --holo-amber:   #FFC100; /* 35% stop, oklch(85% 0.19 85)  */
  --holo-cyan:    #00C1E5; /* 70% stop, oklch(74% 0.15 215) */
  --holo-gradient: linear-gradient(
    135deg,
    var(--holo-magenta) 0%,
    var(--holo-amber) 35%,
    var(--holo-cyan) 70%,
    var(--holo-magenta) 100%
  );
}

.hologram-hero {
  position: relative;
  background: #0E0814;
  overflow: hidden; /* clip shard field to hero bounds */
}

.hologram-hero__glow {
  /* the existing AmbientGlow component, unchanged */
  position: absolute;
  inset: 0;
  margin: auto;
  width: 70vmin;
  height: 70vmin;
  border-radius: 50%;
  background: radial-gradient(circle, var(--holo-magenta) 0%, transparent 70%);
  filter: blur(80px);
  opacity: 0.3;
  pointer-events: none;
}

.hologram-hero__shard {
  position: absolute;
  background: var(--holo-gradient);
  opacity: 0.08;              /* 6-12% range; 8% is the default */
  clip-path: polygon(50% 0%, 100% 38%, 50% 100%); /* one mark facet, reused */
  pointer-events: none;
  /* no filter, no box-shadow — flat by design */
}

.hologram-wordmark {
  background: var(--holo-gradient);
  background-size: 200% 200%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
```

## Motion (respecting `prefers-reduced-motion`)

- **Default motion:** the `--holo-gradient` on the wordmark and shard field drifts slowly — animate `background-position` from `0% 50%` to `100% 50%` and back, `12s` `ease-in-out` `infinite alternate`. This is the "holographic foil catching light" effect: the same three hues, just shifting which one is dominant where, never introducing motion blur, glow pulsing, or scale/rotation.
- **The ambient glow** drifts exactly like the parent site's existing glow keyframe (slow positional drift via `transform: translate(...)`, kept separate from any centering transform) — reuse that keyframe, don't add a second one.
- **`prefers-reduced-motion: reduce`:** freeze `background-position` at `50% 50%` (the visual midpoint of the sweep — roughly the amber-to-cyan transition) and stop the glow drift entirely. Nothing disappears or jumps; it just holds the mid-animation frame, matching the parent site's rule that every choreographed sequence "renders the end-state instantly — never a missing or stuck-hidden transition."

## Rough sketch

```
┌───────────────────────────────────────────────────────────┐
│  #0E0814                                                   │
│              (soft magenta AmbientGlow, centered,          │
│               70vmin, blur 80px, opacity 0.3)              │
│     ◺shard              ┌─────────────────┐                │
│         ◹shard          │                 │    ◺shard      │
│                          │   3D CANVAS     │                │
│   HOLOGRAMA ← gradient   │   (CHIARA)      │                │
│   text, wordmark scale   │                 │                │
│                          └─────────────────┘                │
│   Your work. On your table.  ← plain ink, no gradient       │
└───────────────────────────────────────────────────────────┘
```

## Implementation notes for the frontend dev

- The shard field and glow are both `position: absolute`, `pointer-events: none`, `z-index` below the canvas and below any interactive UI — they're atmosphere, never hit-testable.
- Reuse the *same* `holoFacet`/`--holo-gradient` stop values everywhere (mark, wordmark, shards, and any future AR CTA button or loading shimmer) — one gradient definition, referenced, not redefined per component.
- Do not add `box-shadow`, `filter: drop-shadow`, or any bevel/inner-shadow to the mark, wordmark, or shard shapes themselves. The only `blur()` in this whole treatment is the ambient glow, exactly as in the parent system.
- If a loading/skeleton state is needed while the `.glb` streams in, use the same `--holo-gradient` as a shimmer sweep (`background-size: 200% 100%`, animating `background-position`) on the poster/skeleton block — this keeps the "loading" moment visually part of the same holographic language instead of a generic gray shimmer.
