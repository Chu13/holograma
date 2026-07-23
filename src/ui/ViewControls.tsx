import type { ViewMode } from "@/three/Model";
import "@/ui/ViewControls.css";

export type ViewControlsProps = {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  explodeAmount: number;
  onExplodeChange: (amount: number) => void;
};

const MODES: { value: ViewMode; label: string }[] = [
  { value: "solid", label: "Solid" },
  { value: "wireframe", label: "Wireframe" },
  { value: "normals", label: "Normals" },
  { value: "uv", label: "UV" },
];

export function ViewControls({
  viewMode,
  onViewModeChange,
  explodeAmount,
  onExplodeChange,
}: ViewControlsProps) {
  return (
    <div className="view-controls">
      <div className="view-controls__group" role="group" aria-label="Material view mode">
        {MODES.map((mode) => (
          <button
            key={mode.value}
            type="button"
            className="view-controls__button"
            data-active={mode.value === viewMode}
            onClick={() => onViewModeChange(mode.value)}
            aria-pressed={mode.value === viewMode}
          >
            {mode.label}
          </button>
        ))}
      </div>

      <label className="view-controls__slider">
        <span className="label">Exploded view</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={explodeAmount}
          onChange={(event) => onExplodeChange(Number(event.target.value))}
        />
      </label>
    </div>
  );
}
