"use client";

import { useEffect, useState } from "react";

export default function CursorBlob() {
  const [position, setPosition] = useState({ x: -100, y: -100 });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only enable on desktop pointer devices
    if (typeof window === "undefined" || window.matchMedia("(pointer: coarse)").matches) {
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
      if (!isVisible) setIsVisible(true);
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "480px",
        height: "480px",
        borderRadius: "50%",
        pointerEvents: "none",
        zIndex: 0,
        opacity: 0.07,
        background: "radial-gradient(circle, #0f766e 0%, rgba(217, 107, 67, 0.4) 45%, transparent 70%)",
        transform: `translate3d(${position.x - 240}px, ${position.y - 240}px, 0)`,
        transition: "transform 180ms cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease",
        willChange: "transform",
      }}
      aria-hidden="true"
    />
  );
}
