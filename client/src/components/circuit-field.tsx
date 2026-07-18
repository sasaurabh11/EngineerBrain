import { useEffect, useRef } from "react";

interface Point {
  x: number;
  y: number;
}

interface Trace {
  points: Point[];
  segLengths: number[];
  totalLength: number;
  offset: number;
  speed: number;
}

const GRID = 28;

function snap(v: number) {
  return Math.round(v / GRID) * GRID;
}

function buildTrace(width: number, height: number): Trace {
  const x1 = snap(Math.random() * width);
  const y1 = snap(Math.random() * height);
  const x2 = snap(Math.random() * width);
  const y2 = snap(Math.random() * height);
  const points: Point[] = Math.random() < 0.5 ? [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }] : [{ x: x1, y: y1 }, { x: x1, y: y2 }, { x: x2, y: y2 }];

  const segLengths: number[] = [];
  let totalLength = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const d = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    segLengths.push(d);
    totalLength += d;
  }

  return { points, segLengths, totalLength, offset: Math.random(), speed: 0.12 + Math.random() * 0.1 };
}

function pointAt(trace: Trace, t: number): Point {
  const target = t * trace.totalLength;
  let covered = 0;
  for (let i = 0; i < trace.segLengths.length; i++) {
    const segLen = trace.segLengths[i];
    if (target <= covered + segLen || i === trace.segLengths.length - 1) {
      const localT = segLen === 0 ? 0 : (target - covered) / segLen;
      const a = trace.points[i];
      const b = trace.points[i + 1];
      return { x: a.x + (b.x - a.x) * localT, y: a.y + (b.y - a.y) * localT };
    }
    covered += segLen;
  }
  return trace.points[trace.points.length - 1];
}

/** Ambient background: a rectilinear circuit-board trace pattern with small
 * signal pulses travelling along it - standing in for the way the product
 * moves through a codebase, and echoing the brand mark's circuit motif,
 * rather than a generic decorative gradient. Static (first frame only) under
 * reduced-motion, paused while the tab is hidden. Reads --primary so it
 * tracks the active theme automatically. */
export function CircuitField({ className, density = 1 }: { className?: string; density?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let traces: Trace[] = [];
    let frame = 0;
    let hidden = document.hidden;

    function seed() {
      const area = width * height;
      const count = Math.min(60, Math.max(10, Math.round((area / 26000) * density)));
      traces = Array.from({ length: count }, () => buildTrace(width, height));
    }

    function resize() {
      if (!canvas || !ctx) return;
      const rect = canvas.parentElement?.getBoundingClientRect();
      width = rect?.width ?? window.innerWidth;
      height = rect?.height ?? window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }

    function draw() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, width, height);
      const style = getComputedStyle(canvas);
      const primary = style.getPropertyValue("--primary").trim() || "#2ec4b6";

      ctx.lineWidth = 1;
      ctx.strokeStyle = primary;
      for (const trace of traces) {
        ctx.globalAlpha = 0.16;
        ctx.beginPath();
        ctx.moveTo(trace.points[0].x, trace.points[0].y);
        for (let i = 1; i < trace.points.length; i++) ctx.lineTo(trace.points[i].x, trace.points[i].y);
        ctx.stroke();

        ctx.globalAlpha = 0.3;
        ctx.fillStyle = primary;
        for (const p of trace.points) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (!reduceMotion) {
        for (const trace of traces) {
          const t = (frame * 0.0032 * trace.speed + trace.offset) % 1;
          const p = pointAt(trace, t);
          const fade = Math.sin(t * Math.PI);
          ctx.globalAlpha = 0.55 + fade * 0.4;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    function loop() {
      if (!hidden) {
        frame++;
        if (reduceMotion) {
          if (frame === 1) draw();
        } else {
          draw();
        }
      }
      raf = requestAnimationFrame(loop);
    }

    function handleVisibility() {
      hidden = document.hidden;
    }

    let raf = requestAnimationFrame(loop);
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    resize();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [density]);

  return (
    <div className={className} aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
