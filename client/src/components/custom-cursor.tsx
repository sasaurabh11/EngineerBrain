import { useEffect, useRef } from "react";

const INTERACTIVE_SELECTOR = 'a, button, [role="button"], input, select, textarea, label, [data-cursor-interactive]';
const TEXT_SELECTOR = 'input, textarea, [contenteditable="true"]';

export function CustomCursor() {
  const ringRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canHover = window.matchMedia("(pointer: fine)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!canHover || reducedMotion) return;

    document.documentElement.classList.add("custom-cursor-active");

    const ring = ringRef.current;
    const dot = dotRef.current;
    if (!ring || !dot) return;

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let ringX = targetX;
    let ringY = targetY;
    let hovering = false;
    let visible = false;
    let rafId = 0;

    function onMove(e: MouseEvent) {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!visible) {
        visible = true;
        ring!.style.opacity = "1";
        dot!.style.opacity = "1";
      }
      dot!.style.transform = `translate3d(${targetX - 2}px, ${targetY - 2}px, 0)`;

      const target = e.target as Element | null;
      const isInteractive = Boolean(target?.closest(INTERACTIVE_SELECTOR));
      const isText = Boolean(target?.closest(TEXT_SELECTOR));
      if (isText) {
        ring!.style.opacity = "0";
      } else if (!visible || ring!.style.opacity !== "1") {
        ring!.style.opacity = "1";
      }
      if (isInteractive !== hovering) {
        hovering = isInteractive;
        ring!.classList.toggle("cursor-ring--active", hovering);
      }
    }

    function onLeave() {
      visible = false;
      ring!.style.opacity = "0";
      dot!.style.opacity = "0";
    }

    function tick() {
      ringX += (targetX - ringX) * 0.2;
      ringY += (targetY - ringY) * 0.2;
      ring!.style.transform = `translate3d(${ringX - 16}px, ${ringY - 16}px, 0)`;
      rafId = requestAnimationFrame(tick);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    rafId = requestAnimationFrame(tick);

    return () => {
      document.documentElement.classList.remove("custom-cursor-active");
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <>
      <div ref={ringRef} className="cursor-ring" aria-hidden="true" />
      <div ref={dotRef} className="cursor-dot" aria-hidden="true" />
    </>
  );
}
