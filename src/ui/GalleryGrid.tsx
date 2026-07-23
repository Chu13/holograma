import { Link } from "react-router-dom";
import type { GalleryModel } from "@/data/models";
import "@/ui/GalleryGrid.css";

export type GalleryGridProps = {
  models: GalleryModel[];
};

export function GalleryGrid({ models }: GalleryGridProps) {
  return (
    <div className="gallery-grid">
      {models.map((model) => (
        <Link key={model.slug} to={`/model/${model.slug}`} className="gallery-card">
          <img src={model.posterUrl} alt={model.posterAlt} loading="lazy" />
          <div className="gallery-card__body">
            <h3>{model.name}</h3>
            <p>{model.tagline}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
