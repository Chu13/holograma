import { Html } from "@react-three/drei";
import type { Hotspot } from "@/data/models";
import "@/three/Hotspots.css";

export type HotspotsProps = {
  hotspots: Hotspot[];
  activeId: string | null;
  onSelect: (id: string) => void;
};

/**
 * 3D-anchored hotspot markers. `occlude="blending"` dims a marker when
 * scene geometry sits in front of it (tested against the real WebGL depth
 * buffer) instead of always drawing on top — per spec, hotspots must
 * visually respect occlusion, not float through the model. A parallel
 * accessible text list (src/ui/HotspotList.tsx) carries the same content
 * for screen readers, since these are positioned via CSS transforms.
 */
export function Hotspots({ hotspots, activeId, onSelect }: HotspotsProps) {
  return (
    <>
      {hotspots.map((hotspot) => (
        <Html
          key={hotspot.id}
          position={hotspot.position}
          occlude="blending"
          zIndexRange={[10, 0]}
        >
          <button
            type="button"
            className="hotspot-marker"
            data-active={hotspot.id === activeId}
            onClick={() => onSelect(hotspot.id)}
            aria-label={hotspot.label}
            aria-pressed={hotspot.id === activeId}
          >
            <span aria-hidden="true" className="hotspot-marker__dot" />
          </button>
        </Html>
      ))}
    </>
  );
}
