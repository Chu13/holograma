import { useState } from "react";
import { Viewer } from "@/three/Viewer";
import { ARButton } from "@/ui/ARButton";
import { BrandLockup } from "@/ui/BrandLockup";
import { MarkerExperience } from "@/ar/MarkerExperience";
import { galleryModels } from "@/data/models";
import "@/routes/CardAR.css";

const cardModel = galleryModels[0]; // CHIARA — the card always launches the flagship model.

function absoluteUrl(path: string): string {
  return new URL(path, window.location.origin).toString();
}

/**
 * The QR destination. Always a full page — never rendered inside the
 * portfolio's case-study iframe (see App.tsx's route comment and
 * README.md's iframe section). Opens straight into an AR-ready view of
 * CHIARA, no gallery browsing first.
 */
export function CardAR() {
  const [markerMode, setMarkerMode] = useState(false);

  return (
    <main className="card-ar">
      <header className="card-ar__header">
        <BrandLockup width={180} />
      </header>

      <div className="card-ar__content">
        <h1 className="card-ar__title">CHIARA</h1>
        <p className="card-ar__tagline">Scanned from Chu's card. This is Level 05.</p>

        <Viewer
          glbUrl={cardModel.glbUrl}
          posterUrl={cardModel.posterUrl}
          posterAlt={cardModel.posterAlt}
        />

        <div className="card-ar__actions">
          <ARButton
            title={cardModel.name}
            glbUrl={absoluteUrl(cardModel.glbUrl)}
            usdzUrl={absoluteUrl(cardModel.usdzUrl)}
          />
          <button type="button" className="card-ar__marker-button" onClick={() => setMarkerMode(true)}>
            Try marker mode <span className="label">Experimental</span>
          </button>
        </div>

        <p className="card-ar__note">
          Marker mode points your camera at the printed card itself and anchors CHIARA directly
          to it — no scan needed once it's running. It's new and hasn't been tested across every
          device; "View in AR" above is the reliable path.
        </p>
      </div>

      {markerMode && (
        <MarkerExperience
          mindTargetUrl="/card/card.mind"
          glbUrl={cardModel.glbUrl}
          onClose={() => setMarkerMode(false)}
        />
      )}
    </main>
  );
}
