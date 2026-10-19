"use client";

// สัญลักษณ์น้ำขึ้น–น้ำลง กลางทะเลอันดามันหน้าเมืองสตูล (ใช้ข้อมูลเดียวกับการ์ดระดับน้ำทะเล /api/public/sea-level)
// - ไอคอนคลื่น + ลูกศรขึ้น/ลง + ระดับตอนนี้ · สีขอบตามสถานะน้ำหนุน
// - ชี้/แตะ: บอกน้ำขึ้นสูงสุด–ลงต่ำสุดรอบถัดไป
import L from "leaflet";
import { Marker, Tooltip } from "react-leaflet";

// จุดในทะเลอันดามันหน้าสตูล (เลือกให้อยู่ในน้ำ ไม่ทับแผ่นดิน)
export const TIDE_MARKER_POSITION = [6.705131, 99.789906];

const TREND = {
  rising: { arrow: "↑", label: "น้ำกำลังขึ้น" },
  falling: { arrow: "↓", label: "น้ำกำลังลง" },
  slack: { arrow: "→", label: "น้ำนิ่ง" }
};

const timeText = (value, now) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const day = date.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const today = new Date(now).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const prefix = day === today ? "" : "พรุ่งนี้ ";
  return `${prefix}${date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" })} น.`;
};

const levelText = (value) => (Number.isFinite(Number(value)) ? `${Number(value) >= 0 ? "+" : ""}${Number(value).toFixed(2)} ม.` : "-");

/** สรุปข้อมูลสำหรับสัญลักษณ์ (แยกออกมาเพื่อทดสอบ) */
export function tideSummary(data, now = Date.now()) {
  if (!data || data.level === null || data.level === undefined || !Number.isFinite(Number(data.level))) return null;
  const trend = TREND[data.trend?.key] || TREND.slack;
  const after = (item) => Date.parse(item?.at) > now;
  const nextHigh = (data.next_highs || []).find(after) || null;
  const nextLow = (data.lows || []).find(after) || null;
  return {
    key: data.trend?.key || "slack",
    arrow: trend.arrow,
    label: trend.label,
    level: levelText(data.level),
    color: data.status?.color || "#0ea5e9",
    statusLabel: data.status?.key && data.status.key !== "normal" ? data.status.label : "ปกติ",
    nextHigh: nextHigh ? { time: timeText(nextHigh.at, now), level: levelText(nextHigh.est_level) } : null,
    nextLow: nextLow ? { time: timeText(nextLow.at, now), level: levelText(nextLow.level) } : null
  };
}

const WAVE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M2 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M2 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/></svg>';

function tideIcon(summary) {
  return L.divIcon({
    className: "tide-marker",
    iconSize: [112, 34],
    iconAnchor: [56, 17],
    html: `<div class="tide-pill" style="--tide-ring:${summary.color}">
      <span class="tide-wave">${WAVE}</span>
      <span class="tide-arrow tide-arrow--${summary.key}">${summary.arrow}</span>
      <span class="tide-text"><b>${summary.key === "falling" ? "น้ำลง" : summary.key === "rising" ? "น้ำขึ้น" : "น้ำนิ่ง"}</b><small>${summary.level}</small></span>
    </div>`
  });
}

const STYLE = `
.tide-marker { background: none; border: 0; }
.tide-pill { display:flex; align-items:center; gap:4px; height:34px; padding:0 9px 0 4px; border-radius:999px; background:rgba(8,47,73,.82); color:#fff; box-shadow:0 0 0 2px var(--tide-ring), 0 10px 22px -12px rgba(2,6,23,.8); backdrop-filter:blur(6px); font-family:var(--font-kanit), sans-serif; white-space:nowrap; }
.tide-wave { display:flex; align-items:center; justify-content:center; width:26px; height:26px; border-radius:999px; background:rgba(56,189,248,.25); color:#7dd3fc; overflow:hidden; }
.tide-wave svg { animation: tide-wave 2.6s ease-in-out infinite; }
.tide-arrow { font-weight:900; font-size:15px; line-height:1; color:#7dd3fc; }
.tide-arrow--rising { animation: tide-up 1.6s ease-in-out infinite; }
.tide-arrow--falling { animation: tide-down 1.6s ease-in-out infinite; color:#fcd34d; }
.tide-text { display:flex; flex-direction:column; line-height:1.05; }
.tide-text b { font-size:12px; font-weight:700; }
.tide-text small { font-size:10px; color:rgba(255,255,255,.75); font-variant-numeric:tabular-nums; }
@keyframes tide-wave { 0%,100% { transform:translateX(-2px); } 50% { transform:translateX(2px); } }
@keyframes tide-up { 0%,100% { transform:translateY(2px); opacity:.6; } 50% { transform:translateY(-2px); opacity:1; } }
@keyframes tide-down { 0%,100% { transform:translateY(-2px); opacity:.6; } 50% { transform:translateY(2px); opacity:1; } }
@media (prefers-reduced-motion: reduce) { .tide-wave svg, .tide-arrow { animation:none !important; } }
`;

export default function TideMarker({ data }) {
  // เวลาอ้างอิง = เวลาที่ API คำนวณข้อมูล (โหลดใหม่ทุก 10 นาที)
  const reference = Number.isFinite(data?.now_minute) ? data.now_minute * 60000 : Date.parse(data?.fetched_at || "");
  const summary = Number.isFinite(reference) ? tideSummary(data, reference) : null;
  if (!summary) return null;
  return (
    <>
      <style>{STYLE}</style>
      <Marker position={TIDE_MARKER_POSITION} icon={tideIcon(summary)} keyboard alt={`ทะเลอันดามันหน้าสตูล ${summary.label}`}>
        <Tooltip direction="top" offset={[0, -18]}>
          <div className="font-[family-name:var(--font-kanit)] text-xs leading-5">
            <p className="font-semibold">ทะเลอันดามันหน้าสตูล · {summary.label}</p>
            <p>ระดับตอนนี้ {summary.level} · น้ำหนุน{summary.statusLabel}</p>
            {summary.nextHigh ? <p>น้ำขึ้นสูงสุดรอบถัดไป {summary.nextHigh.time} ({summary.nextHigh.level})</p> : null}
            {summary.nextLow ? <p>น้ำลงต่ำสุดรอบถัดไป {summary.nextLow.time} ({summary.nextLow.level})</p> : null}
            <p className="text-[10px] text-slate-500">เทียบระดับทะเลปานกลาง · ค่าพยากรณ์</p>
          </div>
        </Tooltip>
      </Marker>
    </>
  );
}
