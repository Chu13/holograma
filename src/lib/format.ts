const BYTE_UNITS = ["B", "KB", "MB", "GB"] as const;

/** Human-readable file size, e.g. `674608` -> `"659.0 KB"`. */
export function formatBytes(bytes: number): string {
  if (bytes < 0) {
    throw new RangeError("formatBytes: bytes must be >= 0");
  }
  if (bytes === 0) {
    return "0 B";
  }

  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  const decimals = unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(decimals)} ${BYTE_UNITS[unitIndex]}`;
}

/** Human-readable integer count with thousands separators, e.g. `132316` -> `"132,316"`. */
export function formatCount(count: number): string {
  return count.toLocaleString("en-US");
}
