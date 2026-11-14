import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

interface AsciiWaveProps {
  className?: string;
  /** Canvas fill. Defaults to the theme primary color. */
  color?: string;
  speed?: number;
}

const CHARS = " .:+x*#".split("");
const FONT_SIZE = 12;
const COLUMN_WIDTH = 10;

/**
 * Standing ASCII wave drawn on canvas.
 * Adapted from Lightswind UI's ascii-wave (MIT).
 */
export function AsciiWave({ className, color, speed = 1 }: AsciiWaveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let animationId = 0;
    let time = 0;
    let running = true;
    let width = 0;
    let height = 0;

    const fill = color || getComputedStyle(container).color || "currentColor";

    const resize = () => {
      width = container.clientWidth;
      height = container.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.font = `${FONT_SIZE}px "IBM Plex Mono", ui-monospace, monospace`;
      ctx.fillStyle = fill;

      const columns = Math.ceil(width / COLUMN_WIDTH);
      const rows = Math.ceil(height / FONT_SIZE);

      for (let x = 0; x < columns; x++) {
        const shapeBase = Math.sin(x * 0.1) * 0.6 + Math.cos(x * 0.25) * 0.4;
        const breath = Math.sin(time * 0.002 * speed) * 0.1;
        const flicker = Math.sin(time * 0.008 * speed + x * 100) * 0.05;
        const columnHeight = Math.max(0.15, ((shapeBase + breath + flicker + 1) / 2) * 0.6 + 0.15);
        const activeRows = Math.floor(columnHeight * rows);
        const flowShift = time * 0.005 * speed;

        for (let y = 0; y < activeRows; y++) {
          const charNoise = Math.sin(y * 0.2 + flowShift + x * 10);
          const distFromTip = activeRows - y;
          const fade = Math.min(1, 0.45 + distFromTip / 8);
          const charIndex = Math.min(CHARS.length - 1, Math.floor(((charNoise + 1) / 2) * CHARS.length));

          if (Math.random() > 0.985) continue;

          ctx.globalAlpha = fade;
          ctx.fillText(CHARS[charIndex]!, x * COLUMN_WIDTH, (y + 1) * FONT_SIZE);
        }
      }

      ctx.globalAlpha = 1;
    };

    const frame = () => {
      if (!running) return;
      draw();
      time += 16;
      animationId = requestAnimationFrame(frame);
    };

    const start = () => {
      if (running) return;
      running = true;
      animationId = requestAnimationFrame(frame);
    };

    const stop = () => {
      running = false;
      cancelAnimationFrame(animationId);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    if (reduceMotion) {
      draw();
    } else {
      running = false;
      start();
    }

    const onVisibility = () => {
      if (reduceMotion) return;
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [color, speed]);

  return (
    <div ref={containerRef} className={cn("h-full w-full overflow-hidden text-primary", className)}>
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
