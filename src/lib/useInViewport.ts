import { useEffect, useRef, useState } from "react";

/**
 * True once the ref'd element has entered the viewport, and stays true
 * after (the observer disconnects on first intersection). Used to defer
 * mounting the three.js/WebGL bundle until the viewer is actually about to
 * be seen — first paint is just the poster image.
 */
export function useInViewport<T extends HTMLElement>(rootMargin = "200px") {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [rootMargin]);

  return { ref, inView };
}
