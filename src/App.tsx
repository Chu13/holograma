import { Suspense, lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Landing } from "@/routes/Landing";

// The 3D/AR-heavy routes are code-split from the landing page — first
// load of the site should never pull in three.js, @react-three/fiber, or
// the (much larger) vendored MindAR/tfjs bundle just to render the
// gallery grid. Landing itself stays a normal import: it's the entry
// route, so there's nothing to gain by making it lazy too.
const ModelViewerPage = lazy(() =>
  import("@/routes/ModelViewer").then((m) => ({ default: m.ModelViewerPage })),
);
const CardAR = lazy(() => import("@/routes/CardAR").then((m) => ({ default: m.CardAR })));
const NotFound = lazy(() => import("@/routes/NotFound").then((m) => ({ default: m.NotFound })));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/model/:slug" element={<ModelViewerPage />} />
          {/* The QR on the physical card points here directly — a full
              page, never embedded in the portfolio's case-study iframe. */}
          <Route path="/card" element={<CardAR />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
