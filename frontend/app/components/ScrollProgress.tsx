"use client";

import { useEffect, useState } from "react";

export default function ScrollProgress() {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const totalHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        const currentProgress = (window.scrollY / totalHeight) * 100;
        setScrollProgress(Math.min(100, Math.max(0, currentProgress)));
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        height: "3px",
        width: `${scrollProgress}%`,
        background: "linear-gradient(90deg, #087F73 0%, #13A89E 50%, #d96b43 100%)",
        zIndex: 9999,
        transition: "width 80ms ease-out",
        boxShadow: "0 0 8px rgba(19, 168, 158, 0.6)",
        pointerEvents: "none",
      }}
      aria-hidden="true"
    />
  );
}
