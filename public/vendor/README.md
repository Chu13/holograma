Same MindAR files as `src/vendor/mindar/`, duplicated here on purpose.

`scripts/build-card-target.mjs` serves `public/` as plain static files (no
Vite bundling) to compile `public/card/card.mind` — it needs a real copy on
disk under `public/`, not `src/`. The app itself imports from
`src/vendor/mindar/` instead, because that bundle's three.js-dependent
variant (`mindar-image-three.prod.js`) imports the bare specifier `"three"`,
which only resolves through Vite's bundler — see the main README's AR
section and `src/vendor/mindar/mindar-image-three.prod.js`'s header comment.

This directory only needs the `Compiler`-only bundle (`mindar-image.prod.js`
+ its two chunk files) — not `mindar-image-three.prod.js`, which the build
script never imports.
