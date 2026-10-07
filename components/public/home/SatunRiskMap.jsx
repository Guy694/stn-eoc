"use client";

import { useEffect, useState } from "react";
import { RISK_META } from "@/lib/weatherRiskConfig";

// แผนที่ 7 อำเภอของสตูลแบบ SVG (ไฟล์ย่อจากขอบเขตอำเภอทางการ ~10 KB)
// สีแต่ละอำเภอ = ระดับความเสี่ยงจากสภาพอากาศวันนี้ / แตะเพื่อเลือกเป็นพื้นที่ของฉัน

const OUTLINE_URL = "/stn-eoc/geo/satun-districts.json";

function normalize(value) {
  return String(value || "").replace(/^อ(\.|ำเภอ)\s*/, "").replace(/\s+/g, "");
}

export default function SatunRiskMap({ districts = [], selectedName, onSelect, userPoint }) {
  const [outline, setOutline] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(OUTLINE_URL, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then(setOutline)
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const byName = new Map(districts.map((district) => [normalize(district.district_name), district]));

  if (!outline) {
    return <div className="h-[22rem] w-full animate-pulse sm:h-[30rem] rounded-[2rem] bg-white/5" aria-hidden="true" />;
  }

  const projected = userPoint && outline.bounds
    ? [
        (userPoint.longitude - outline.bounds.minLon) * outline.projection.kx * outline.projection.scale,
        (outline.bounds.maxLat - userPoint.latitude) * outline.projection.scale
      ]
    : null;

  return (
    <svg viewBox={outline.viewBox} className="satun-map mx-auto block h-auto max-h-[22rem] w-full sm:max-h-[30rem] lg:max-h-[34rem]" role="group" aria-label="แผนที่ความเสี่ยงน้ำท่วมรายอำเภอ จังหวัดสตูล พร้อมฝนที่วัดได้ 24 ชั่วโมง">
      {outline.districts.map((shape, index) => {
        const district = byName.get(normalize(shape.name));
        const meta = RISK_META[district?.risk_level] || null;
        const selected = normalize(shape.name) === normalize(selectedName);
        const label = `อำเภอ${shape.name}${meta ? ` ความเสี่ยง${meta.label}` : ""}`;
        return (
          <path
            key={shape.code}
            d={shape.d}
            fillRule="evenodd"
            role="button"
            tabIndex={0}
            aria-label={label}
            aria-pressed={selected}
            onClick={() => district && onSelect?.(district.district_name)}
            onKeyDown={(event) => {
              if ((event.key === "Enter" || event.key === " ") && district) {
                event.preventDefault();
                onSelect?.(district.district_name);
              }
            }}
            className="satun-map__district"
            style={{
              "--fill": meta?.color || "#5b7a8c",
              animationDelay: `${index * 90}ms`,
              stroke: selected ? "#ffffff" : "#0c2f4a",
              strokeWidth: selected ? 5 : 2
            }}
          >
            <title>{label}</title>
          </path>
        );
      })}

      {/* อำเภอเสี่ยงสูง/วิกฤต: เส้นขอบเต้นช้า ๆ ดึงสายตาไปก่อน */}
      {outline.districts.map((shape) => {
        const district = byName.get(normalize(shape.name));
        if (!district || !["high", "critical"].includes(district.risk_level)) return null;
        return (
          <path
            key={`alert-${shape.code}`}
            d={shape.d}
            fill="none"
            pointerEvents="none"
            className={`satun-map__alert ${district.risk_level === "critical" ? "is-critical" : ""}`}
            style={{ stroke: RISK_META[district.risk_level].color }}
          />
        );
      })}

      {/* ป้ายชื่ออำเภอ (ไม่รับการคลิก เพื่อให้แตะผ่านไปยังพื้นที่ได้) */}
      {outline.districts.map((shape) => {
        const district = byName.get(normalize(shape.name));
        const selected = normalize(shape.name) === normalize(selectedName);
        return (
          <g key={`label-${shape.code}`} transform={`translate(${shape.label[0]} ${shape.label[1]})`} pointerEvents="none">
            <text textAnchor="middle" className={`satun-map__label ${selected ? "is-selected" : ""}`} y="-4">{shape.name}</text>
            {district && (
              <text textAnchor="middle" className="satun-map__temp" y="40">{`ฝน ${Number(district.rainfall_24h || 0).toLocaleString("th-TH", { maximumFractionDigits: 1 })} มม.`}</text>
            )}
          </g>
        );
      })}

      {projected && (
        <g transform={`translate(${projected[0]} ${projected[1]})`} pointerEvents="none">
          <circle r="16" fill="#ffffff" opacity="0.35" className="satun-map__pulse" />
          <circle r="8" fill="#ffffff" stroke="#0c2f4a" strokeWidth="3" />
        </g>
      )}

      <style>{`
        .satun-map__district {
          fill: var(--fill);
          fill-opacity: .9;
          cursor: pointer;
          transition: fill-opacity .15s ease, stroke-width .15s ease;
          animation: satun-district-in .6s ease-out both;
        }
        .satun-map__district:hover { fill-opacity: 1; }
        .satun-map__district:focus-visible { outline: none; stroke: #ffd166 !important; stroke-width: 6px !important; }
        .satun-map__label {
          font: 700 40px var(--font-kanit), sans-serif;
          fill: #ffffff;
          paint-order: stroke;
          stroke: rgba(12, 47, 74, .85);
          stroke-width: 8px;
        }
        .satun-map__label.is-selected { font-size: 48px; }
        .satun-map__temp {
          font: 600 28px var(--font-kanit), sans-serif;
          fill: #e6f4f1;
          paint-order: stroke;
          stroke: rgba(12, 47, 74, .85);
          stroke-width: 5px;
        }
        .satun-map__pulse { animation: satun-pulse 2s ease-out infinite; transform-origin: center; }
        .satun-map__alert { stroke-width: 10px; stroke-linejoin: round; animation: satun-alert 2.4s ease-in-out infinite; }
        .satun-map__alert.is-critical { animation-duration: 1.6s; }
        @keyframes satun-alert { 0%, 100% { stroke-opacity: .15; stroke-width: 6px; } 50% { stroke-opacity: .9; stroke-width: 14px; } }
        @keyframes satun-district-in { from { fill: #5b7a8c; fill-opacity: .35; } }
        @keyframes satun-pulse { from { transform: scale(.6); opacity: .6; } to { transform: scale(2.2); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) {
          .satun-map__district, .satun-map__pulse { animation: none; }
          .satun-map__alert { animation: none; stroke-opacity: .8; }
        }
      `}</style>
    </svg>
  );
}
