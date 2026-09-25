"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";

export function Atmosphere() {
  return (
    <>
      <div className="atmosphere" aria-hidden />
      <div className="noise" aria-hidden />
      <CursorGlow />
    </>
  );
}

function CursorGlow() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduce || !window.matchMedia("(pointer: fine)").matches) return;
    const el = ref.current;
    if (!el) return;
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 3;
    let tx = x;
    let ty = y;
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
    };
    const tick = () => {
      x += (tx - x) * 0.08;
      y += (ty - y) * 0.08;
      el.style.transform = `translate(${x - 280}px, ${y - 280}px)`;
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [reduce]);

  if (reduce) return null;
  return <div ref={ref} className="cursor-glow" aria-hidden />;
}
