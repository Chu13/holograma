// Minimal ambient declaration for the vendored, minified MindAR bundle
// (no upstream .d.ts ships with it — see README's AR section for how this
// file got here and why it lives under src/, not public/).
declare module "@/vendor/mindar/mindar-image-three.prod.js" {
  export class MindARThree {
    constructor(options: { container: HTMLElement; imageTargetSrc: string });
  }
}
