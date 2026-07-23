import type { ModelStats } from "@/inspect/stats";
import { formatBytes, formatCount } from "@/lib/format";
import { checkTriangleBudget } from "@/lib/budget";
import "@/ui/StatsPanel.css";

export type StatsPanelProps = {
  stats: ModelStats;
};

/**
 * The real inspection payoff — every number here comes straight from
 * gltf-transform's own inspect() output (src/inspect/stats.ts), not a
 * fabricated summary. An over-budget model gets an honest warning here
 * instead of a silently-fine panel.
 */
export function StatsPanel({ stats }: StatsPanelProps) {
  const budget = checkTriangleBudget(stats.triangles);

  return (
    <div className="stats-panel">
      <h3 className="stats-panel__title label">Model stats</h3>

      <dl className="stats-panel__grid">
        <div>
          <dt className="label">Triangles</dt>
          <dd>{formatCount(stats.triangles)}</dd>
        </div>
        <div>
          <dt className="label">Vertices</dt>
          <dd>{formatCount(stats.vertices)}</dd>
        </div>
        <div>
          <dt className="label">Materials</dt>
          <dd>{formatCount(stats.materialCount)}</dd>
        </div>
        <div>
          <dt className="label">File size</dt>
          <dd>{formatBytes(stats.fileSizeBytes)}</dd>
        </div>
      </dl>

      {budget.severity !== "ok" && (
        <p className={`stats-panel__budget stats-panel__budget--${budget.severity}`} role="status">
          {budget.message}
        </p>
      )}

      <div className="stats-panel__section">
        <h4 className="label">Textures ({stats.textures.length})</h4>
        {stats.textures.length === 0 ? (
          <p className="stats-panel__empty">No textures.</p>
        ) : (
          <ul className="stats-panel__list">
            {stats.textures.map((texture) => (
              <li key={texture.name || texture.resolution}>
                {texture.name || "(unnamed)"} — {texture.resolution} · {texture.format} ·{" "}
                {formatBytes(texture.sizeBytes)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="stats-panel__section">
        <h4 className="label">Animations ({stats.animationNames.length})</h4>
        {stats.animationNames.length === 0 ? (
          <p className="stats-panel__empty">No animations.</p>
        ) : (
          <ul className="stats-panel__list">
            {stats.animationNames.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="stats-panel__section">
        <h4 className="label">Extensions</h4>
        {stats.extensionsUsed.length === 0 ? (
          <p className="stats-panel__empty">None detected.</p>
        ) : (
          <ul className="stats-panel__list stats-panel__list--tags">
            {stats.extensionsUsed.map((extension) => (
              <li key={extension}>{extension}</li>
            ))}
          </ul>
        )}
        <p className="stats-panel__empty">
          Compression: Draco {stats.detectedCompression.draco ? "yes" : "no"} · Meshopt{" "}
          {stats.detectedCompression.meshopt ? "yes" : "no"} · KTX2{" "}
          {stats.detectedCompression.ktx2 ? "yes" : "no"}
        </p>
      </div>
    </div>
  );
}
