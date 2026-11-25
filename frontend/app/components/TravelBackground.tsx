"use client";

import React from "react";

/**
 * TravelBackground: A multi-layered, travel-inspired ambient background.
 *
 * Designed with:
 * - Soft botanical gradient regions (#123F35, #087F73, #13A89E, #DDF3E9, #F8DCCB, #FFF8EF, #E2F0F2)
 * - Subtle geographical contour-line patterns (SVG topographic elevation curves)
 * - Abstract organic shapes with very slow ambient drifting CSS animations
 * - Minimal travel-route dashed illustrations with waypoint pins
 * - Decorative compass rose and geographical coordinate marks in lateral spaces
 *
 * 100% independent of mouse movement: zero event listeners, zero requestAnimationFrame,
 * zero CPU lag, pure hardware-accelerated CSS and SVGs.
 */
export default function TravelBackground() {
  return (
    <div className="travel-bg-wrapper" aria-hidden="true">
      {/* Layer 1: Ambient Botanical Colour Fields */}
      <div className="travel-bg-gradient-mesh">
        <div className="travel-orb travel-orb-teal" />
        <div className="travel-orb travel-orb-peach" />
        <div className="travel-orb travel-orb-mint" />
        <div className="travel-orb travel-orb-sky" />
      </div>

      {/* Layer 2: Subtle Geographical Topographic Elevation Curves (SVG) */}
      <svg
        className="travel-bg-contours"
        viewBox="0 0 1600 1000"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="contourGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#087F73" stopOpacity="0.08" />
            <stop offset="50%" stopColor="#13A89E" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#087F73" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="contourGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#123F35" stopOpacity="0.06" />
            <stop offset="60%" stopColor="#087F73" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#13A89E" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Top-left elevation contours */}
        <g stroke="url(#contourGrad1)" fill="none" strokeWidth="1.2">
          <path d="M-100,120 C180,90 280,240 420,180 C560,120 620,290 850,220" />
          <path d="M-120,180 C160,150 260,300 400,240 C540,180 600,350 870,270" />
          <path d="M-140,240 C140,210 240,360 380,300 C520,240 580,410 890,320" />
          <path d="M-160,300 C120,270 220,420 360,360 C500,300 560,470 910,370" />
          <path d="M-180,360 C100,330 200,480 340,420 C480,360 540,530 930,420" />
        </g>

        {/* Bottom-right elevation contours */}
        <g stroke="url(#contourGrad2)" fill="none" strokeWidth="1.2">
          <path d="M750,780 C920,720 1080,880 1250,810 C1420,740 1520,900 1750,830" />
          <path d="M730,840 C900,780 1060,940 1230,870 C1400,800 1500,960 1770,890" />
          <path d="M710,900 C880,840 1040,1000 1210,930 C1380,860 1480,1020 1790,950" />
          <path d="M690,960 C860,900 1020,1060 1190,990 C1360,920 1460,1080 1810,1010" />
        </g>

        {/* Ambient Topographic Index Isolines */}
        <g stroke="#087F73" strokeOpacity="0.04" fill="none" strokeWidth="1">
          <circle cx="180" cy="190" r="140" strokeDasharray="3 4" />
          <circle cx="180" cy="190" r="220" />
          <circle cx="1420" cy="820" r="180" strokeDasharray="4 6" />
          <circle cx="1420" cy="820" r="280" />
        </g>
      </svg>

      {/* Layer 3: Minimal Travel Route Illustrations & Waypoint Pins (SVG) */}
      <svg
        className="travel-bg-routes"
        viewBox="0 0 1600 1000"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#087F73" stopOpacity="0.55" />
            <stop offset="50%" stopColor="#13A89E" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#087F73" stopOpacity="0.25" />
          </linearGradient>
        </defs>

        {/* Left Peripheral Travel Route */}
        <g className="travel-route-group">
          {/* Animated Dashed Route Path */}
          <path
            d="M 60,180 C 130,280 90,440 160,560 C 210,650 170,780 230,890"
            fill="none"
            stroke="url(#routeGradient)"
            strokeWidth="2"
            strokeDasharray="6 8"
            className="travel-animated-path"
          />

          {/* Waypoint 1: Origin */}
          <circle cx="60" cy="180" r="5" fill="#087F73" opacity="0.6" />
          <circle cx="60" cy="180" r="12" fill="none" stroke="#087F73" strokeWidth="1.5" opacity="0.3" className="travel-ping" />

          {/* Waypoint 2: Midpoint stop */}
          <circle cx="160" cy="560" r="4" fill="#13A89E" opacity="0.5" />
          <circle cx="160" cy="560" r="9" fill="none" stroke="#13A89E" strokeWidth="1" opacity="0.3" />

          {/* Waypoint 3: Destination pin */}
          <g transform="translate(225, 876) scale(0.85)">
            <path
              d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
              fill="#087F73"
              opacity="0.65"
            />
          </g>
        </g>

        {/* Right Peripheral Travel Route */}
        <g className="travel-route-group-right">
          <path
            d="M 1540,240 C 1460,340 1510,480 1430,620 C 1370,720 1420,840 1360,940"
            fill="none"
            stroke="url(#routeGradient)"
            strokeWidth="1.8"
            strokeDasharray="5 7"
            className="travel-animated-path-reverse"
          />

          {/* Waypoint on right */}
          <circle cx="1540" cy="240" r="5" fill="#13A89E" opacity="0.6" />
          <circle cx="1430" cy="620" r="4" fill="#087F73" opacity="0.5" />
          <g transform="translate(1354, 926) scale(0.85)">
            <path
              d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
              fill="#13A89E"
              opacity="0.65"
            />
          </g>
        </g>
      </svg>

      {/* Layer 4: Cartographic Coordinates & Compass Rose in Lateral Spaces */}
      <div className="travel-bg-annotations">
        {/* Top-Right Decorative Compass Rose */}
        <div className="travel-compass-rose" aria-hidden="true">
          <svg width="68" height="68" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="46" stroke="#087F73" strokeWidth="1" strokeOpacity="0.18" />
            <circle cx="50" cy="50" r="38" stroke="#087F73" strokeWidth="0.8" strokeOpacity="0.12" strokeDasharray="2 3" />
            <line x1="50" y1="2" x2="50" y2="98" stroke="#087F73" strokeWidth="0.8" strokeOpacity="0.2" />
            <line x1="2" y1="50" x2="98" y2="50" stroke="#087F73" strokeWidth="0.8" strokeOpacity="0.2" />
            {/* North pointer */}
            <polygon points="50,14 54,46 50,42" fill="#087F73" fillOpacity="0.4" />
            <polygon points="50,14 46,46 50,42" fill="#087F73" fillOpacity="0.2" />
            {/* South pointer */}
            <polygon points="50,86 54,54 50,58" fill="#13A89E" fillOpacity="0.25" />
            <polygon points="50,86 46,54 50,58" fill="#13A89E" fillOpacity="0.15" />
            {/* East & West pointers */}
            <polygon points="86,50 54,46 58,50" fill="#087F73" fillOpacity="0.25" />
            <polygon points="14,50 46,54 42,50" fill="#087F73" fillOpacity="0.25" />
            <text x="50" y="10" textAnchor="middle" fill="#087F73" fillOpacity="0.55" fontSize="8" fontFamily="var(--font-mono)" fontWeight="700">N</text>
            <text x="50" y="97" textAnchor="middle" fill="#087F73" fillOpacity="0.35" fontSize="7" fontFamily="var(--font-mono)">S</text>
            <text x="96" y="52" textAnchor="middle" fill="#087F73" fillOpacity="0.35" fontSize="7" fontFamily="var(--font-mono)">E</text>
            <text x="5" y="52" textAnchor="middle" fill="#087F73" fillOpacity="0.35" fontSize="7" fontFamily="var(--font-mono)">W</text>
          </svg>
        </div>

        {/* Subtle Lateral Geographic Coordinates (Monospace) */}
        <div className="travel-coord-mark travel-coord-left">
          <span>12° 58&apos; 23&quot; N · 77° 35&apos; 45&quot; E</span>
          <span className="travel-coord-sub">INDEX ELEV 920m</span>
        </div>

        <div className="travel-coord-mark travel-coord-right">
          <span>LAT 12.9716 · LNG 77.5946</span>
          <span className="travel-coord-sub">TERRAIN SECTOR B-04</span>
        </div>
      </div>
    </div>
  );
}
