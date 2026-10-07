"use client";

// ชั้นข้อมูลความสูงพื้นที่: ระบายสีตามช่วงความสูง + กล่องบอกความสูง ณ จุดที่ชี้/แตะ (มุมขวาล่าง)
// ต้องอยู่ใน MapContainer ของ react-leaflet
import { useEffect } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";
import {
  ELEVATION_ATTRIBUTION, ELEVATION_MAX_ZOOM, ELEVATION_TILE_URL,
  bandFor, colorizeTerrarium, elevationText, tilePixelAt
} from "@/lib/elevation";

export default function ElevationLayer({ opacity = 1 }) {
  const map = useMap();

  useEffect(() => {
    const heights = new Map(); // "z/x/y" → Float32Array(256*256)

    const Layer = L.GridLayer.extend({
      createTile(coords, done) {
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 256;
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => {
          try {
            const context = canvas.getContext("2d", { willReadFrequently: true });
            context.drawImage(image, 0, 0);
            const { rgba, heights: values } = colorizeTerrarium(context.getImageData(0, 0, 256, 256).data);
            context.putImageData(new ImageData(rgba, 256, 256), 0, 0);
            heights.set(`${coords.z}/${coords.x}/${coords.y}`, values);
            done(null, canvas);
          } catch (error) {
            done(error, canvas);
          }
        };
        image.onerror = () => done(new Error("elevation tile failed"), canvas);
        image.src = ELEVATION_TILE_URL.replace("{z}", coords.z).replace("{x}", coords.x).replace("{y}", coords.y);
        return canvas;
      }
    });

    const layer = new Layer({ maxNativeZoom: ELEVATION_MAX_ZOOM, maxZoom: 19, opacity, attribution: ELEVATION_ATTRIBUTION, zIndex: 250 });
    layer.addTo(map);

    // ป้ายบอกความสูงที่ตามเมาส์ (มือถือ: แตะ) — ไม่ใช้กล่องมุมจอเพราะถูกเมนูชั้นข้อมูลบัง
    const tip = L.tooltip({ permanent: false, direction: "top", offset: [0, -10], className: "elevation-readout", opacity: 0.95 });
    let frame = 0;
    const show = (latlng) => {
      const zoom = Math.min(Math.round(map.getZoom()), ELEVATION_MAX_ZOOM);
      const { key, px, py } = tilePixelAt(latlng.lat, latlng.lng, zoom);
      const values = heights.get(key);
      if (!values) return;
      const meters = values[py * 256 + px];
      const band = bandFor(meters);
      tip
        .setLatLng(latlng)
        .setContent(`<div style="font:700 13px/1.3 var(--font-kanit,sans-serif)">${elevationText(meters)}</div>${band ? `<div style="font:500 11px/1.3 var(--font-kanit,sans-serif);opacity:.75">${band.meaning}</div>` : ""}`);
      if (!map.hasLayer(tip)) tip.addTo(map);
    };
    const onMove = (event) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => show(event.latlng));
    };
    const onLeave = () => {
      cancelAnimationFrame(frame);
      tip.remove();
    };
    map.on("mousemove", onMove);
    map.on("click", onMove);
    map.on("mouseout", onLeave);

    return () => {
      cancelAnimationFrame(frame);
      map.off("mousemove", onMove);
      map.off("click", onMove);
      map.off("mouseout", onLeave);
      tip.remove();
      layer.remove();
      heights.clear();
    };
  }, [map, opacity]);

  return null;
}
