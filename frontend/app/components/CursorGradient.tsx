"use client";

import { useEffect, useRef } from "react";

/**
 * Signature Cursor-Following Gradient for Nearby & Co.
 *
 * Smooth, mouse-responsive multi-colour radial glow that flows seamlessly
 * behind application content. Features hardware-accelerated transforms, natural
 * easing (lerp interpolation), idle dimming, content-sensitive contrast,
 * and graceful window-exit fadeout with zero React state overhead.
 */
export default function CursorGradient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const primaryOrbRef = useRef<HTMLDivElement>(null);
  const secondaryOrbRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check for touch device or reduced motion preferences
    const isTouch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (isTouch || prefersReducedMotion) {
      if (containerRef.current) {
        containerRef.current.classList.add("cursor-gradient-static");
      }
      return;
    }

    let rafId: number | null = null;
    let idleTimer: NodeJS.Timeout | null = null;

    // Viewport mouse tracking
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currX1 = targetX;
    let currY1 = targetY;
    let currX2 = targetX;
    let currY2 = targetY;

    let isInside = true;
    let isIdle = false;
    let isOverContent = false;

    let currOpacity = 0.85;
    let isRunning = false;

    function animate() {
      // Primary orb follows with smooth inertia (lerp factor 0.08)
      currX1 += (targetX - currX1) * 0.08;
      currY1 += (targetY - currY1) * 0.08;

      // Secondary companion orb follows with slightly looser inertia (lerp factor 0.05)
      // for an organic, liquid-like multi-tonal trail
      currX2 += (targetX - currX2) * 0.05;
      currY2 += (targetY - currY2) * 0.05;

      // Determine target opacity based on presence, activity & content proximity
      let targetOpacity = 0.85;
      if (!isInside) {
        targetOpacity = 0;
      } else if (isIdle) {
        targetOpacity = 0.28;
      } else if (isOverContent) {
        // Subtle dimming over dense form/map cards to preserve maximum readability
        targetOpacity = 0.42;
      }

      currOpacity += (targetOpacity - currOpacity) * 0.06;

      // Apply GPU transforms and container opacity directly without triggering React renders
      if (primaryOrbRef.current) {
        primaryOrbRef.current.style.transform = `translate3d(${currX1.toFixed(2)}px, ${currY1.toFixed(2)}px, 0)`;
      }
      if (secondaryOrbRef.current) {
        secondaryOrbRef.current.style.transform = `translate3d(${currX2.toFixed(2)}px, ${currY2.toFixed(2)}px, 0)`;
      }
      if (containerRef.current) {
        containerRef.current.style.opacity = currOpacity.toFixed(3);
      }

      // Check if settled to save CPU cycles
      const dist1 = Math.hypot(targetX - currX1, targetY - currY1);
      const dist2 = Math.hypot(targetX - currX2, targetY - currY2);
      const opDiff = Math.abs(targetOpacity - currOpacity);

      if (dist1 < 0.15 && dist2 < 0.15 && opDiff < 0.005) {
        isRunning = false;
        rafId = null;
        return;
      }

      rafId = requestAnimationFrame(animate);
    }

    function wakeLoop() {
      if (!isRunning) {
        isRunning = true;
        rafId = requestAnimationFrame(animate);
      }
    }

    function handleMouseMove(e: MouseEvent) {
      targetX = e.clientX;
      targetY = e.clientY;
      isInside = true;

      // Detect if hovering over dense cards or interactive map
      const targetEl = e.target as HTMLElement | null;
      isOverContent = Boolean(
        targetEl?.closest(".card, .planner-sidebar, .place-card, .leaflet-container, .top-row")
      );

      // Reset idle timer
      isIdle = false;
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        isIdle = true;
        wakeLoop();
      }, 1600);

      wakeLoop();
    }

    function handleMouseLeave() {
      isInside = false;
      wakeLoop();
    }

    function handleMouseEnter() {
      isInside = true;
      isIdle = false;
      wakeLoop();
    }

    // Initial wake
    wakeLoop();

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", handleMouseLeave);
    document.documentElement.addEventListener("mouseenter", handleMouseEnter);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.documentElement.removeEventListener("mouseleave", handleMouseLeave);
      document.documentElement.removeEventListener("mouseenter", handleMouseEnter);
      if (idleTimer) clearTimeout(idleTimer);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className="cursor-gradient-container" ref={containerRef} aria-hidden="true">
      {/* Ambient static backdrop for warm cream tone */}
      <div className="cursor-gradient-ambient" />

      {/* Primary Botanical Teal & Mint Orb */}
      <div className="cursor-gradient-orb cursor-gradient-primary" ref={primaryOrbRef} />

      {/* Secondary Companion Warm Peach & Vibrant Teal Orb */}
      <div className="cursor-gradient-orb cursor-gradient-secondary" ref={secondaryOrbRef} />
    </div>
  );
}
