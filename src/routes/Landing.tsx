import { Link } from "react-router-dom";
import { BrandLockup } from "@/ui/BrandLockup";
import { GalleryGrid } from "@/ui/GalleryGrid";
import { HowItWorks } from "@/ui/HowItWorks";
import { galleryModels } from "@/data/models";
import "@/routes/Landing.css";

export function Landing() {
  return (
    <div className="landing">
      <header className="landing__nav">
        <BrandLockup width={160} />
        <a
          href="https://github.com/Chu13/holograma"
          target="_blank"
          rel="noopener noreferrer"
          className="label landing__github"
        >
          GitHub
        </a>
      </header>

      <section className="landing__hero">
        <h1 className="landing__hero-title">
          A 3D/AR viewer, <span className="landing__hero-accent">built from scratch</span>
        </h1>
        <p className="landing__hero-body">
          No embed, no third-party viewer — a hand-built three.js renderer with real glTF
          inspection, native AR on iOS and Android, and a physical card that drops a model onto
          your table. Level 05 of{" "}
          <a href="https://www.jabordones.com" target="_blank" rel="noopener noreferrer">
            Chu's portfolio
          </a>
          .
        </p>
        <a href="#gallery" className="landing__hero-cta">
          Explore the gallery
        </a>
      </section>

      <section id="gallery" className="landing__section">
        <h2 className="label landing__section-label">Gallery</h2>
        <GalleryGrid models={galleryModels} />
        <p className="landing__gallery-note">
          Every model here loads a real .glb — drop in your own on any model's page for a live,
          100% client-side inspection.
        </p>
      </section>

      <HowItWorks />

      <footer className="landing__footer">
        <p>
          Your dropped models never leave your browser — no upload endpoint exists in this app.
        </p>
        <div className="landing__footer-links">
          <a href="https://github.com/Chu13/holograma" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <Link to="/card">Card experience</Link>
        </div>
      </footer>
    </div>
  );
}
