"use client";
import { useState, useRef, useEffect } from "react";
import { useMap } from "react-leaflet";

/** Drop this inside <MapContainer> to auto-invalidate size after fullscreen transitions */
export function MapResizer({ trigger }) {
  const map = useMap();
  useEffect(() => {
    const tid = setTimeout(() => map.invalidateSize(), 120);
    return () => clearTimeout(tid);
  }, [trigger, map]);
  return null;
}

/**
 * Wrap any map content with this to get a fullscreen toggle button.
 *
 * Usage:
 *   <FullscreenMapWrapper height="500px">
 *     <MapContainer ...>
 *       <MapResizer trigger={isFullscreen} />   ← put inside MapContainer
 *       ...
 *     </MapContainer>
 *   </FullscreenMapWrapper>
 *
 * Or use the convenience hook:
 *   const { isFullscreen, toggle, containerProps, buttonEl } = useFullscreenMap();
 */
export function useFullscreenMap() {
  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setIsFullscreen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggle = () => {
    if (!isFullscreen) {
      if (containerRef.current?.requestFullscreen) containerRef.current.requestFullscreen();
      else setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      else setIsFullscreen(false);
    }
  };

  const buttonEl = (
    <button
      onClick={toggle}
      title={isFullscreen ? "ออกจากเต็มจอ (Esc)" : "ดูแบบเต็มจอ"}
      className="absolute top-3 right-3 z-[9999] bg-white hover:bg-gray-100 border border-gray-300 shadow-md rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-700 flex items-center gap-1.5 transition"
    >
      {isFullscreen ? "✕ ออกจากเต็มจอ" : "⛶ เต็มจอ"}
    </button>
  );

  return { isFullscreen, toggle, containerRef, buttonEl };
}

export default function FullscreenMapWrapper({ children, height = "500px", className = "" }) {
  const { isFullscreen, containerRef, buttonEl } = useFullscreenMap();

  return (
    <div
      ref={containerRef}
      className={isFullscreen
        ? `fixed inset-0 z-[99999] bg-black ${className}`
        : `relative w-full rounded-xl overflow-hidden shadow-md border border-gray-200 ${className}`}
      style={{ height: isFullscreen ? "100vh" : height }}
    >
      {buttonEl}
      {children}
    </div>
  );
}
