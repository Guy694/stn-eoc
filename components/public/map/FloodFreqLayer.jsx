"use client";

// ชั้นข้อมูล "พื้นที่น้ำท่วมซ้ำซาก" (GISTDA, ภาพดาวเทียม พ.ศ. 2554–2567) — ต้องอยู่ใน MapContainer ของ react-leaflet
// วาดด้วย canvas เพราะมีหลายพันแปลง (SVG จะหน่วงบนมือถือ)
import { useEffect, useState } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";
import { FLOOD_FREQ_TOTAL_YEARS, REPEATED_MIN_FREQ, floodFreqClass, thaiYear } from "@/lib/floodFreq";

const PANE = "flood-freq";
let request = null; // ใช้ข้อมูลชุดเดียวทั้งหน้า แม้เปิด/ปิดชั้นซ้ำ

function loadFloodFreq() {
  if (!request) {
    request = fetch(`/stn-eoc/api/public/flood-freq?min=${REPEATED_MIN_FREQ}`)
      .then((response) => response.json())
      .then((json) => {
        if (!json?.success) throw new Error(json?.error || "โหลดข้อมูลไม่สำเร็จ");
        return json;
      })
      .catch((error) => {
        request = null; // ให้ลองใหม่ได้เมื่อเปิดชั้นอีกครั้ง
        throw error;
      });
  }
  return request;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function popupHtml(props) {
  const freqClass = floodFreqClass(props.freq);
  const years = (props.years || []).map(thaiYear).join(", ");
  const area = Number(props.area_rai) >= 1 ? `ประมาณ ${Math.round(props.area_rai).toLocaleString("th-TH")} ไร่` : "น้อยกว่า 1 ไร่";
  return `<div style="font-family:var(--font-kanit,sans-serif);min-width:200px;max-width:240px">
    <div style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:#475569">
      <span style="width:10px;height:10px;border-radius:3px;background:${freqClass?.color || "#94a3b8"}"></span>พื้นที่น้ำท่วมซ้ำซาก
    </div>
    <div style="margin-top:2px;font-size:17px;font-weight:700;color:#0c2f4a">ท่วม ${props.freq} ใน ${FLOOD_FREQ_TOTAL_YEARS} ปี</div>
    ${years ? `<div style="margin-top:2px;font-size:13px;color:#334155">ปีที่ท่วม: ${escapeHtml(years)}</div>` : ""}
    <div style="margin-top:4px;font-size:13px;color:#334155">ต.${escapeHtml(props.tambon || "-")} อ.${escapeHtml(props.district || "-")} • ${area}</div>
    <div style="margin-top:6px;border-top:1px solid #e2e8f0;padding-top:6px;font-size:11px;line-height:1.45;color:#64748b">
      สถิติจากภาพดาวเทียม GISTDA พ.ศ. 2554–2567 ใช้ประกอบการเตรียมรับมือ ไม่ใช่สถานการณ์น้ำตอนนี้
    </div>
  </div>`;
}

export default function FloodFreqLayer({ onStatus }) {
  const map = useMap();
  const [data, setData] = useState(null);

  useEffect(() => {
    let active = true;
    onStatus?.({ state: "loading" });
    loadFloodFreq()
      .then((json) => {
        if (!active) return;
        setData(json);
        onStatus?.({ state: "ready", count: json.geojson?.features?.length || 0 });
      })
      .catch((error) => {
        if (active) onStatus?.({ state: "error", message: error.message });
      });
    return () => { active = false; };
  }, [onStatus]);

  useEffect(() => {
    if (!data?.geojson) return undefined;
    if (!map.getPane(PANE)) {
      const pane = map.createPane(PANE);
      // เหนือขอบเขตอำเภอ/ตำบล (overlay 400 ซึ่งรับการแตะทั้งพื้นที่) เพื่อให้แตะแปลงได้ แต่ใต้หมุดและป้าย (600+)
      pane.style.zIndex = 420;
    }
    const renderer = L.canvas({ pane: PANE, padding: 0.2 });
    // แปลงส่วนใหญ่กว้างไม่กี่สิบเมตร: ซูมออกแล้วจะหายไป จึงใช้ขอบหนาตอนซูมออกให้เห็นเป็นจุด แล้วบางลงเมื่อซูมเข้า
    const strokeFor = (zoom) => (zoom <= 10 ? 3 : zoom <= 12 ? 2 : zoom <= 14 ? 1.2 : 0.6);
    const styleFor = (feature) => {
      const color = floodFreqClass(feature.properties.freq)?.color || "#94a3b8";
      return { color, weight: strokeFor(map.getZoom()), opacity: 0.95, fillColor: color, fillOpacity: 0.6 };
    };
    const layer = L.geoJSON(data.geojson, {
      pane: PANE,
      renderer,
      style: styleFor,
      onEachFeature: (feature, item) => {
        // เว้นระยะซ้ายให้พ้นแผงข้อมูลของแผนที่สถานการณ์ (เหมือน popup อื่นใน PublicIncidentMap)
        const wide = window.innerWidth >= 768;
        item.bindPopup(popupHtml(feature.properties), {
          maxWidth: 260,
          autoPanPaddingTopLeft: wide ? [400, 90] : [16, 120],
          autoPanPaddingBottomRight: wide ? [280, 90] : [72, 90] // เมนูชั้นข้อมูลด้านขวากว้าง ~250 px
        });
        item.on("mouseover", () => item.setStyle({ weight: strokeFor(map.getZoom()) + 1.5, fillOpacity: 0.8 }));
        item.on("mouseout", () => layer.resetStyle(item));
      }
    });
    layer.addTo(map);
    const restyle = () => layer.setStyle(styleFor);
    map.on("zoomend", restyle);
    return () => {
      map.off("zoomend", restyle);
      layer.remove();
    };
  }, [data, map]);

  return null;
}
