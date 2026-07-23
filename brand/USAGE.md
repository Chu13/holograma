# HOLOGRAMA — Mark Usage Rules

HOLOGRAMA is Level 05 of the Chu portfolio system (jabordones.com) and extends the shared brand system — it does not fork it. Anything not covered here inherits the parent rules in `BRAND.md`/`DESIGN.md`. Full palette, typography, and Full Arcade Rule reference: `/Users/jesuspicoro/Desktop/Chuzzo/Coding/Chu-Website/BRAND.md`.

## Symbol: Prism Aperture

A faceted hexagonal gem/aperture — six flat triangular facets sharing one diagonal gradient field, so the shape reads as a cut gem (nodding to CHIARA, the jewelry piece the viewer ships with) and a projector aperture (nodding to the AR hologram itself) at once. Files: `mark.svg` (symbol alone), `favicon.svg` (simplified small-size fallback), `lockup.svg` (symbol + wordmark), `og-card.svg` (1200×630 social card).

### Backgrounds

Dark only. Every file ships with its own `#0E0814` (`--color-bg`, `oklch(15% 0.025 305)`) fill baked in — never place on white, light gray, or any surface lighter than `--color-surface`. Same rule as the parent Portal Ring mark.

### Clearspace

Minimum padding around the mark = 1/8 of its own size on every side (8 units on the 64-unit grid) — identical fraction to the parent system's rule. In the lockup, keep at least that same 8-unit gap between the mark and the wordmark; `lockup.svg` actually uses 24 units (3x the minimum) for visual balance. Never go below the 1/8 minimum in either direction.

### Minimum size

16px (favicon floor), same as the parent system. Below roughly 24px the six internal facet hairlines are the first detail to wash out — the fallback is the outer hexagon silhouette filled with the full gradient and no internal lines (`favicon.svg`), never a flattened/solid-color hexagon. Color *is* the identity here, so unlike the parent Portal Ring (which has a legible ink-only single-color fallback), the Prism Aperture mark has no single-color fallback — if a context can't render gradients at all, use the parent Portal Ring mark instead of a de-gradiented HOLOGRAMA mark.

### Color — where the iridescent gradient is and isn't allowed

The gradient (`#D63BD6` magenta-violet → `#FFC100` amber → `#00C1E5` cyan → back to `#D63BD6`, i.e. exactly the three brand accent hues, 328°/85°/215°, no others) is reserved for:

- The mark itself (`mark.svg`, `favicon.svg`).
- The "HOLOGRAMA" wordmark text (`lockup.svg`, `og-card.svg`, and any hero-scale wordmark treatment per `hero-treatment.md`).
- Hero-moment atmosphere that is explicitly mark-derived: the facet-shard background layer and the loading shimmer described in `hero-treatment.md`.

This is a deliberate, narrow exception to the parent system's explicit rejection of "gradient text as a crutch" — it's earned here because HOLOGRAMA is a literal hologram/AR product and the effect reinforces the name. It does not license gradient text or gradient chrome anywhere else.

**Everywhere else in the HOLOGRAMA product UI, the flat system applies exactly as in the parent brand:** buttons, panel backgrounds, stat readouts, hotspot markers, the annotation list, toggles (wireframe/normals/UV), the drag-and-drop zone, and all body copy use flat fills from the existing three accent roles (primary/secondary/tertiary) or the neutral surface scale — solid colors, not the gradient. An "AR" call-to-action button, for example, can use the gradient as its background *once, as a hero-level accent* (it is one of the highest-stakes single actions in the product), but a second gradient element on the same screen is a violation — the gradient stays rare enough to still read as a signature, not decoration.

### Construction

Flat, 1:1 square grid, no stretching/skewing. The six facets are separated by thin `#0E0814`-colored hairline strokes (`stroke-width: 1` at the mark's native 64-unit size) — the same "erase with a background-colored shape" technique the parent Portal Ring uses for its ring gap, applied here as a stroke instead of a polygon cutout. No drop shadow, no bevel, no outer glow baked into the shape itself. The soft ambient background glow behind the mark in hero contexts (parent site's existing `AmbientGlow` primitive: 70vmin, blur 80px) is fine and expected — that's atmosphere behind the mark, not an effect on the mark.

## Typography

Same three-face system as the parent brand, same jobs, no exceptions:

- **Unbounded**, weight 800 — the "HOLOGRAMA" wordmark only.
- **Hanken Grotesk** — all HOLOGRAMA body copy, taglines, descriptions (plain `ink`/`muted`, never gradient).
- **Martian Mono**, uppercase, tracked — labels/status/metadata only (stat panel numbers, "LEVEL 05," AR-availability badges, "EXPERIMENTAL" tags). Never a heading, never a body sentence — same System Voice Rule as the parent brand.

## Don't

- Don't apply the iridescent gradient to body text, UI chrome, buttons beyond the single AR CTA exception above, borders, or any repeated/list UI element (stat rows, hotspot pins, toggle buttons) — it stays reserved for the mark, the wordmark, and explicitly mark-derived hero atmosphere.
- Don't introduce hues outside the three existing accents (328° magenta-violet / 85° amber / 215° cyan) anywhere in the gradient — no teal, no green, no full rainbow. If it's not one of those three hex values (or a stop that repeats one of them), it doesn't belong in the sweep.
- Don't add a drop shadow, bevel, inner shadow, or outer glow to the mark or wordmark shapes themselves — the system is flat by design; the only permitted blur anywhere in this identity is the ambient background glow, which sits *behind* content, never applied to a shape's own edge.
- Don't stretch, skew, or rotate the mark — it's drawn on a square grid, orientation is fixed, same as the parent Portal Ring.
- Don't recolor the mark's gradient into a solid single color to "simplify" it for a constrained context — if gradients truly aren't renderable, use the parent Portal Ring mark instead (see Minimum size, above), don't ship a de-gradiented HOLOGRAMA mark.
- Don't add a fourth accent color anywhere in the HOLOGRAMA product UI outside the mark/wordmark gradient exception — the Full Arcade Rule (exactly three accent roles) still governs every flat UI surface.
- Don't use the mark/wordmark gradient as a repeating pattern, texture, or background fill behind unrelated content — it identifies HOLOGRAMA itself, it isn't decorative wallpaper.

## Reusable values

```
--holo-magenta: #D63BD6   /* oklch(64% 0.25 328) — primary accent */
--holo-amber:   #FFC100   /* oklch(85% 0.19 85)  — secondary accent */
--holo-cyan:    #00C1E5   /* oklch(74% 0.15 215) — tertiary accent */

Gradient stops (linear, ~135deg or diagonal bounding-box in SVG):
  0%   #D63BD6
  35%  #FFC100
  70%  #00C1E5
  100% #D63BD6
```

Use these exact stops everywhere the gradient legitimately appears (mark, wordmark, AR CTA, loading shimmer) so the effect stays recognizable as one signature, not a family of similar-but-different gradients.
