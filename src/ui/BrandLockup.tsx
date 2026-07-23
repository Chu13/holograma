// Inlined from public/brand/lockup.svg (Brand Guardian's "Prism Aperture"
// mark) rather than referenced via <img src>, so the wordmark's Unbounded
// font — already loaded globally in styles/globals.css — actually applies.
// An <img>-referenced SVG renders in an isolated context that can't see
// the parent page's webfonts, so it would silently fall back to a generic
// sans-serif instead. See public/brand/USAGE.md for the mark's usage rules.
//
// viewBox is 350 (not the source file's 300): the build-card pipeline
// found that "HOLOGRAMA" set in the real, web-loaded Unbounded 800 runs
// to ~345 units wide, past the original 300-unit viewBox, so the default
// overflow:hidden silently clipped the final "A". Widened here rather
// than patching public/brand/lockup.svg itself (out of scope for this
// component, and the source file's own consumers may crop differently).
export type BrandLockupProps = {
  className?: string;
  width?: number;
};

const VIEW_BOX_WIDTH = 350;
const VIEW_BOX_HEIGHT = 64;

export function BrandLockup({ className, width = 220 }: BrandLockupProps) {
  return (
    <svg
      viewBox={`0 0 ${VIEW_BOX_WIDTH} ${VIEW_BOX_HEIGHT}`}
      width={width}
      height={(width * VIEW_BOX_HEIGHT) / VIEW_BOX_WIDTH}
      role="img"
      aria-label="HOLOGRAMA"
      className={className}
    >
      <defs>
        <linearGradient id="holoFacet" gradientUnits="userSpaceOnUse" x1="12.95" y1="10" x2="51.05" y2="54">
          <stop offset="0%" stopColor="#D63BD6" />
          <stop offset="35%" stopColor="#FFC100" />
          <stop offset="70%" stopColor="#00C1E5" />
          <stop offset="100%" stopColor="#D63BD6" />
        </linearGradient>
        <linearGradient id="holoText" x1="0" y1="0" x2="1" y2="0.6">
          <stop offset="0%" stopColor="#D63BD6" />
          <stop offset="35%" stopColor="#FFC100" />
          <stop offset="70%" stopColor="#00C1E5" />
          <stop offset="100%" stopColor="#D63BD6" />
        </linearGradient>
      </defs>

      <g fill="url(#holoFacet)" stroke="#0E0814" strokeWidth={1} strokeLinejoin="round">
        <polygon points="32,32 32,10 51.05,21" />
        <polygon points="32,32 51.05,21 51.05,43" />
        <polygon points="32,32 51.05,43 32,54" />
        <polygon points="32,32 32,54 12.95,43" />
        <polygon points="32,32 12.95,43 12.95,21" />
        <polygon points="32,32 12.95,21 32,10" />
      </g>

      <text
        x="88"
        y="44"
        fontFamily="Unbounded, ui-sans-serif, sans-serif"
        fontWeight={800}
        fontSize={30}
        style={{ letterSpacing: "-0.01em" }}
        fill="url(#holoText)"
      >
        HOLOGRAMA
      </text>
    </svg>
  );
}
