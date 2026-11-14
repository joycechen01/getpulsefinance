import { useEffect, useRef } from "react";

/**
 * Fades an element in (300ms) once it scrolls into view by adding `is-visible`.
 * Pair with the `.reveal` class; `index` staggers siblings by 100ms each.
 * The global prefers-reduced-motion rule disables the transition.
 */
export function useReveal(index = 0) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.classList.add("is-visible");
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, delay: index * 100 };
}
