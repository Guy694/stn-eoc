"use client";

import { useEffect, useState } from "react";
import { RISK_META } from "@/lib/weatherRiskConfig";
import { hourlyRainCategory } from "@/lib/thaiWaterRain";

// แผนที่ 7 อำเภอของสตูลแบบ SVG (ไฟล์ย่อจากขอบเขตอำเภอทางการ ~10 KB)
// สีแต่ละอำเภอ = ฝนใน 1 ชม. ล่าสุด (สถานีวัดฝน ไม่มีสถานีใช้ค่าประมาณ) — ไม่ใช้ฝน 24 ชม./ระดับความเสี่ยง เพื่อไม่ให้ตื่นตระหนก
// ระดับความเสี่ยงน้ำท่วมยังแสดงในการ์ดอำเภอเหมือนเดิม / แตะเพื่อเลือกเป็นพื้นที่ของฉัน

/** ฝน 1 ชม. ของอำเภอ: { mm, estimated } */
export function districtRain1h(district) {
  const mm = Number(district?.rainfall_1h);
  return { mm: Number.isFinite(mm) && mm > 0 ? mm : 0, estimated: !(district?.rain_now?.stations > 0) };
}

const mmText = (mm) => Number(mm || 0).toLocaleString("th-TH", { maximumFractionDigits: 1 });

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
    <svg viewBox={outline.viewBox} className="satun-map mx-auto block h-auto max-h-[22rem] w-full sm:max-h-[30rem] lg:max-h-[34rem]" role="group" aria-label="แผนที่ฝนใน 1 ชั่วโมงล่าสุดรายอำเภอ จังหวัดสตูล">
      {outline.districts.map((shape, index) => {
        const district = byName.get(normalize(shape.name));
        const rain = district ? districtRain1h(district) : null;
        const category = rain ? hourlyRainCategory(rain.mm) : null;
        const risk = RISK_META[district?.risk_level] || null;
        const selected = normalize(shape.name) === normalize(selectedName);
        const label = `อำเภอ${shape.name}${rain ? ` ฝน 1 ชม. ${rain.estimated ? "ประมาณ " : ""}${mmText(rain.mm)} มม. (${category.label})` : ""}${risk ? ` ความเสี่ยงน้ำท่วม${risk.label}` : ""}`;
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
              "--fill": category?.color || "#5b7a8c",
              animationDelay: `${index * 90}ms`,
              stroke: selected ? "#ffffff" : "#0c2f4a",
              strokeWidth: selected ? 5 : 2
            }}
          >
            <title>{label}</title>
          </path>
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
              <text textAnchor="middle" className="satun-map__temp" y="40">{`1 ชม. ${districtRain1h(district).estimated ? "~" : ""}${mmText(districtRain1h(district).mm)} มม.`}</text>
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
        @keyframes satun-district-in { from { fill: #5b7a8c; fill-opacity: .35; } }
        @keyframes satun-pulse { from { transform: scale(.6); opacity: .6; } to { transform: scale(2.2); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) {
          .satun-map__district, .satun-map__pulse { animation: none; }
        }
      `}</style>
    </svg>
  );
}
