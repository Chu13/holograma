import type { Hotspot } from "@/data/models";
import "@/ui/HotspotList.css";

export type HotspotListProps = {
  hotspots: Hotspot[];
  activeId: string | null;
  onSelect: (id: string) => void;
};

/**
 * The same hotspot content as three/Hotspots.tsx, as a real DOM list.
 * The 3D markers are positioned via CSS transforms tied to camera
 * projection, which screen readers can't meaningfully parse — this list is
 * how that content stays accessible, not an afterthought bolted on.
 */
export function HotspotList({ hotspots, activeId, onSelect }: HotspotListProps) {
  if (hotspots.length === 0) {
    return null;
  }

  return (
    <div className="hotspot-list">
      <h3 className="label hotspot-list__title">Hotspots</h3>
      <ul>
        {hotspots.map((hotspot) => (
          <li key={hotspot.id}>
            <button
              type="button"
              className="hotspot-list__item"
              data-active={hotspot.id === activeId}
              aria-pressed={hotspot.id === activeId}
              onClick={() => onSelect(hotspot.id)}
            >
              <span className="hotspot-list__label">{hotspot.label}</span>
              <span className="hotspot-list__description">{hotspot.description}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
