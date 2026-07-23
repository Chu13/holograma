import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type * as THREE from "three";
import { Viewer } from "@/three/Viewer";
import { ViewControls } from "@/ui/ViewControls";
import { StatsPanel } from "@/ui/StatsPanel";
import { HotspotList } from "@/ui/HotspotList";
import { Dropzone } from "@/ui/Dropzone";
import { ARButton } from "@/ui/ARButton";
import { BrandLockup } from "@/ui/BrandLockup";
import { getGalleryModel } from "@/data/models";
import { chiaraHotspots } from "@/data/chiara-hotspots";
import { inspectModelBuffer } from "@/inspect/inspectModel";
import type { ModelStats } from "@/inspect/stats";
import type { ViewMode } from "@/three/Model";
import "@/routes/ModelViewer.css";

type Source =
  | { kind: "gallery"; slug: string }
  | { kind: "dropped"; file: File; objectUrl: string };

function absoluteUrl(path: string): string {
  return new URL(path, window.location.origin).toString();
}

export function ModelViewerPage() {
  const { slug = "" } = useParams();
  const galleryModel = getGalleryModel(slug);

  const [source, setSource] = useState<Source>({ kind: "gallery", slug });
  const [stats, setStats] = useState<ModelStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("solid");
  const [explodeAmount, setExplodeAmount] = useState(0);
  const [activeHotspotId, setActiveHotspotId] = useState<string | null>(null);
  const [liveRoot, setLiveRoot] = useState<THREE.Object3D | null>(null);

  useEffect(() => {
    setSource({ kind: "gallery", slug });
  }, [slug]);

  // Revoke dropped-file object URLs on cleanup — nothing should leak.
  useEffect(() => {
    if (source.kind !== "dropped") return;
    return () => URL.revokeObjectURL(source.objectUrl);
  }, [source]);

  const glbUrl = source.kind === "gallery" ? galleryModel?.glbUrl : source.objectUrl;

  // Inspect whatever's currently loaded — gallery model or dropped file —
  // entirely client-side. See inspect/inspectModel.ts.
  useEffect(() => {
    let cancelled = false;
    setStats(null);
    setStatsError(null);

    async function run() {
      try {
        const buffer =
          source.kind === "gallery"
            ? await fetch(galleryModel!.glbUrl).then((r) => r.arrayBuffer())
            : await source.file.arrayBuffer();
        const result = await inspectModelBuffer(buffer);
        if (!cancelled) setStats(result);
      } catch {
        if (!cancelled) setStatsError("Couldn't inspect this model — the file may be malformed.");
      }
    }

    if (glbUrl) run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  const hotspots = useMemo(
    () => (source.kind === "gallery" && slug === "chiara" ? chiaraHotspots : []),
    [source, slug],
  );

  if (source.kind === "gallery" && !galleryModel) {
    return (
      <main className="model-viewer model-viewer--missing">
        <p>No model named "{slug}" in the gallery.</p>
        <Link to="/" className="label">
          ← Back to HOLOGRAMA
        </Link>
      </main>
    );
  }

  const title = source.kind === "gallery" ? galleryModel!.name : source.file.name;

  return (
    <main className="model-viewer">
      <header className="model-viewer__header">
        <Link to="/" aria-label="HOLOGRAMA home">
          <BrandLockup width={160} />
        </Link>
        <Link to="/" className="label model-viewer__back">
          ← Gallery
        </Link>
      </header>

      <div className="model-viewer__layout">
        <div className="model-viewer__main">
          <h1 className="model-viewer__title">{title}</h1>
          {source.kind === "gallery" && galleryModel && (
            <p className="model-viewer__tagline">{galleryModel.tagline}</p>
          )}

          {glbUrl && (
            <Viewer
              glbUrl={glbUrl}
              posterUrl={source.kind === "gallery" ? galleryModel?.posterUrl : undefined}
              posterAlt={
                source.kind === "gallery" ? galleryModel!.posterAlt : `A 3D preview of ${title}`
              }
              viewMode={viewMode}
              explodeAmount={explodeAmount}
              hotspots={hotspots}
              activeHotspotId={activeHotspotId}
              onHotspotSelect={setActiveHotspotId}
              onModelReady={setLiveRoot}
            />
          )}

          <ViewControls
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            explodeAmount={explodeAmount}
            onExplodeChange={setExplodeAmount}
          />

          {source.kind === "gallery" && galleryModel?.materialNotes && (
            <div className="model-viewer__notes">
              {galleryModel.materialNotes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          )}

          <div className="model-viewer__ar">
            <ARButton
              title={title}
              glbUrl={source.kind === "gallery" ? absoluteUrl(galleryModel!.glbUrl) : glbUrl}
              usdzUrl={source.kind === "gallery" ? absoluteUrl(galleryModel!.usdzUrl) : undefined}
              liveRoot={liveRoot}
            />
          </div>

          <section className="model-viewer__dropzone-section">
            <h2 className="label">Try your own model</h2>
            <Dropzone
              onFile={(file) => {
                const objectUrl = URL.createObjectURL(file);
                setLiveRoot(null);
                setActiveHotspotId(null);
                setSource({ kind: "dropped", file, objectUrl });
              }}
            />
          </section>
        </div>

        <aside className="model-viewer__sidebar">
          {stats && <StatsPanel stats={stats} />}
          {statsError && <p className="model-viewer__stats-error">{statsError}</p>}
          {hotspots.length > 0 && (
            <HotspotList hotspots={hotspots} activeId={activeHotspotId} onSelect={setActiveHotspotId} />
          )}
        </aside>
      </div>
    </main>
  );
}
