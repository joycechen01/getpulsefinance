import { useCallback, useRef } from "react";

/**
 * Fades an element in (300ms) once it scrolls into view by adding `is-visible`
 * to it and any `.reveal` descendants. Pair with the `.reveal` class; `index`
 * staggers siblings by 100ms each. Uses a callback ref so it still works when
 * the element renders after async data arrives. The global
 * prefers-reduced-motion rule disables the transition.
 */
export function useReveal(index = 0) {
  const observer = useRef<IntersectionObserver | null>(null);
  const ref = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.classList.add("is-visible");
          el.querySelectorAll(".reveal").forEach((c) => c.classList.add("is-visible"));
          io.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    io.observe(el);
    observer.current = io;
  }, []);
  return { ref, delay: index * 100 };
}
