# Proyecto: HOLOGRAMA — Visor AR de modelos 3D (Level 05 del portafolio) — Guía para el agente

Esta guía es autocontenida. Trabajarás en un **repo nuevo**, separado del sitio del portafolio.

## Contexto

Jesus Bordones ("Chu") tiene un portafolio arcade en www.jabordones.com donde los proyectos son "Levels". Su Loadout declara la disciplina **Web**, hoy probada solo por el sitio mismo — ningún flagship externo demuestra WebGL/3D de producción. Este proyecto será el **Level 05**: un visor 3D/AR propio construido con three.js, no un embed de `<model-viewer>` ni de un servicio de terceros — el punto es el craft.

Hay un gancho físico: la **tarjeta de presentación de Chu lleva un QR** que abre la experiencia AR directa — recibes la tarjeta, escaneas, y el modelo aparece en tu mesa. El modelo por defecto es `CHIARA.glb` (glTF 2.0 binario, 659 KB, ya optimizado con glTF-Transform); se te entregará el archivo como asset del proyecto.

## Objetivo

Al terminar deben existir:
1. Un visor 3D web público: carga CHIARA por defecto, acepta **drag & drop de cualquier `.glb`/`.gltf` propio** con panel de stats, y lanza **AR nativo** (Scene Viewer en Android, Quick Look en iOS).
2. La **experiencia de tarjeta**: una ruta directa (destino del QR) que abre el modelo listo para AR, más el **diseño imprimible de la tarjeta** (PDF/PNG con QR y arte que sirve de marcador).
3. Repo público en GitHub bajo **Chu13**.

## Especificación funcional

1. **Visor propio (three.js + React Three Fiber + drei):** órbita/zoom/pan con inercia, iluminación por environment map, suelo con sombra de contacto suave (render, no box-shadow CSS), y poster estático como fallback/carga.
2. **Drag & drop con inspección real:** al soltar un `.glb`, un panel de stats vía glTF-Transform en el browser: triángulos/vértices, materiales, texturas (cantidad, resolución, formato), tamaño de archivo, animaciones, y extensiones detectadas (Draco, Meshopt, KTX2). Con aviso honesto si el modelo excede el presupuesto de rendimiento móvil, en vez de fingir que todo va bien. Herramienta real, no solo demo.
3. **Materiales/variantes en vivo:** soporte de `KHR_materials_variants` si el modelo las trae, más toggles básicos (wireframe, normales, canal UV) para cualquier modelo.
4. **Hotspots/anotaciones:** puntos anclados a posiciones 3D del modelo (para CHIARA, definidos en data), que se atenúan cuando quedan detrás de la geometría; contenido accesible también como lista de texto.
5. **Animaciones + exploded view:** lista de clips con play/pausa/scrub; exploded view por jerarquía de meshes con slider, si el modelo lo permite.
6. **AR nativo (el corazón del nivel):**
   - **Android — Scene Viewer** vía intent URL con el GLB servido desde URL pública HTTPS. Limitación real: Scene Viewer **no acepta `blob:`**, así que para modelos drag & drop el AR en Android usa **WebXR** (sesión `immersive-ar` con hit-test) o declara la limitación en la UI tal cual.
   - **iOS — Quick Look** requiere **USDZ**: para CHIARA, USDZ **pre-generado en build** y versionado en el repo; para modelos drag & drop, conversión en runtime con el `USDZExporter` de three.js (en un worker) **con nota honesta de límites**: PBR simplificado, sin animaciones ni variantes — la UI lo dice, no lo esconde.
7. **Tarjeta AR:** la ruta del QR abre directo la experiencia (sin pasos intermedios); **modo marcador experimental** con MindAR (image tracking): apuntas la cámara a la tarjeta y el modelo sale de ella. Etiquetado `EXPERIMENTAL` en la UI — honestidad como personalidad. Entregable: el arte imprimible de la tarjeta (85×55 mm + sangrado, PDF/PNG) con QR integrado y diseño rico en features para que trackee bien.

## Stack

- **Frontend:** Vite + React 19 + TypeScript (o Next standalone si simplifica el deploy) + `three` + `@react-three/fiber` + `@react-three/drei`. Deploy en Vercel.
- **Inspección:** `@gltf-transform/core` + `@gltf-transform/functions` (inspect) corriendo en el browser.
- **AR:** Scene Viewer (intent URL), Quick Look (`<a rel="ar">` + USDZ; `USDZExporter` de three para runtime), `@react-three/xr` para el fallback WebXR, MindAR para el modo marcador. QR con una lib mínima (`qrcode`).
- **Tests:** lógica pura con Vitest — parser/formateo de stats, construcción de las URLs/intents de AR, detección de capacidades (iOS/Android/WebXR), cálculo del presupuesto de polígonos.

## Requisitos no funcionales

- **Móvil-first:** el AR es móvil por definición. Objetivo 60 fps con CHIARA en un teléfono de gama media; presupuesto documentado (p. ej. ≤150K triángulos recomendados para modelos dropeados, con warning al excederlo).
- **Lazy load del 3D:** el bundle de three solo se carga al entrar el visor al viewport; primero un poster estático. First load de la página sin el visor debe ser liviano.
- **Accesibilidad:** sin WebGL (o con `prefers-reduced-data`), el visor degrada a imagen/poster con alt; órbita operable por teclado; sin autorrotación con `prefers-reduced-motion`; anotaciones legibles por screen reader; el modo cámara siempre es opt-in explícito.
- **Privacidad total de modelos:** los `.glb` dropeados **nunca salen del navegador** — no existe endpoint de upload; se parsean con la File API en memoria. La UI lo declara visiblemente ("tu modelo no se sube a ningún servidor").

## Contrato con el sitio del portafolio (Chu-Website)

El sitio renderiza cada proyecto desde un objeto `Project` en `src/data/projects.ts` y embebe la demo en un **iframe sandboxeado**. Al terminar, entrega:

1. **`demoUrl`** — URL pública del visor. **Requisito crítico: embebible en iframe** — sin `X-Frame-Options` ni `frame-ancestors` que bloqueen a www.jabordones.com. **Nota de coordinación:** para que el modo marcador/WebXR funcione embebido, `CaseStudy.tsx` deberá añadir `allow="camera; xr-spatial-tracking"` al iframe (cambio del lado del sitio, avisar al integrar). Los lanzamientos de Quick Look/Scene Viewer desde dentro del iframe deben abrir la página completa en pestaña nueva — la experiencia de tarjeta/QR vive como página completa: **el QR apunta a la URL directa del proyecto, nunca al iframe del case study**.
2. **`githubUrl`** — repo público bajo Chu13, con README (arquitectura, decisiones de AR por plataforma, cómo se generó el USDZ, presupuesto de rendimiento).
3. **Cover 16:9** — screenshot PNG real del visor con CHIARA y el panel de stats en pantalla (~1600×900) + alt text descriptivo.
4. **5 highlights honestos** — p. ej.: visor three.js propio, no un embed; drag & drop con stats reales vía glTF-Transform, 100% client-side; AR nativo dual (Scene Viewer + Quick Look con USDZ pre-generado); conversión USDZ en runtime con límites declarados; la tarjeta física con QR y modo marcador experimental.
5. **Un párrafo "problem"** (ver un `.glb` en condiciones exige instalar software; las herramientas online suben tu modelo a servidores opacos; y una tarjeta de presentación normal no demuestra nada — esta lanza el trabajo en 3D sobre tu mesa) **y un párrafo "architectureNote"** (cómo un solo pipeline glTF alimenta visor, stats, USDZ y marcador, y por qué cada plataforma AR exige un camino distinto).
6. Una entrada para el `/log` del sitio anunciando el nivel.
7. **El arte de la tarjeta** (PDF imprimible + PNG) como asset del repo — el sitio podrá mostrarla en el case study.

## Criterios de aceptación

- [ ] CHIARA carga y se mueve fluida en un móvil de gama media; sin WebGL aparece el poster con alt.
- [ ] Soltar un `.glb` arbitrario muestra stats correctos (contrastados con `gltf-transform inspect` de CLI) sin que el archivo salga del navegador (verificable en la pestaña Network: cero uploads).
- [ ] En Android, "Ver en AR" abre Scene Viewer con CHIARA; en iOS, Quick Look abre el USDZ pre-generado.
- [ ] Para un modelo dropeado: iOS genera USDZ en runtime con sus límites declarados en la UI; Android ofrece WebXR o declara la limitación.
- [ ] El QR impreso lleva del escaneo a la experiencia AR en menos de ~5 s en 4G.
- [ ] El modo marcador reconoce la tarjeta impresa y ancla el modelo sobre ella (etiquetado EXPERIMENTAL).
- [ ] El visor es embebible en iframe desde otro dominio y funciona con `allow="camera; xr-spatial-tracking"`.
- [ ] Hotspots, variantes, animaciones y exploded view funcionan con CHIARA; tests de lógica pura pasan; README completo.
