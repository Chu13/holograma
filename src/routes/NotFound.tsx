import { Link } from "react-router-dom";
import { BrandLockup } from "@/ui/BrandLockup";

export function NotFound() {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "2rem" }}>
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "1.5rem", alignItems: "center" }}>
        <BrandLockup width={200} />
        <h1 style={{ fontSize: "1.5rem" }}>Page not found</h1>
        <Link to="/" className="label" style={{ color: "var(--hex-tertiary)" }}>
          ← Back to HOLOGRAMA
        </Link>
      </div>
    </main>
  );
}
