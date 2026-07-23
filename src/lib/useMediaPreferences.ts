import { useState } from "react";

function matches(query: string): boolean {
  return typeof window !== "undefined" && (window.matchMedia?.(query).matches ?? false);
}

/** Snapshotted once at mount — good enough for a viewer that mounts fresh per model. */
export function usePrefersReducedMotion(): boolean {
  const [reduced] = useState(() => matches("(prefers-reduced-motion: reduce)"));
  return reduced;
}

export function usePrefersReducedData(): boolean {
  const [reduced] = useState(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection;
    return Boolean(connection?.saveData) || matches("(prefers-reduced-data: reduce)");
  });
  return reduced;
}

export function useWebglSupported(): boolean {
  const [supported] = useState(() => {
    try {
      const canvas = document.createElement("canvas");
      return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
    } catch {
      return false;
    }
  });
  return supported;
}
