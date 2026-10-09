"use client";

// ภาพเคลื่อนไหว "น้ำทะเลหนุน": ภาพตัดชายฝั่งหน้าเมืองสตูล ระดับน้ำขึ้นลงตามข้อมูลพยากรณ์จริงรายชั่วโมง (−24 ถึง +72 ชม.)
// - ปากคลอง: ถ้าน้ำทะเลสูงกว่าน้ำในคลอง → ลูกศรน้ำทะเลดันเข้าคลอง (คลองระบายไม่ได้) ไม่งั้นน้ำในคลองไหลลงทะเล
// - ระดับเกินเกณฑ์ "หนุนสูง" → น้ำเอ่อข้ามคันเข้าที่ลุ่มริมคลอง
// - เล่น/หยุด/เลื่อนดูเวลาได้ • ผู้ใช้ที่ตั้งค่าลดการเคลื่อนไหว: ไม่เล่นอัตโนมัติ คลื่นนิ่ง
import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { SEA_STATUS } from "@/lib/seaLevel";

const W = 320;
const H = 168;
const Y_TOP = 26;
const Y_BOTTOM = 150;
const LEVEL_MIN = -1.3;
const LEVEL_MAX = 2.7;
const RIVER_BASE = 0.9; // ระดับน้ำในคลองช่วงปกติ (ม.) — ภาพประกอบ ไม่ใช่ค่าวัด
const SPEED_MS = 140;

const yOf = (level) => Y_BOTTOM - ((level - LEVEL_MIN) / (LEVEL_MAX - LEVEL_MIN)) * (Y_BOTTOM - Y_TOP);
const statusOf = (level, thresholds) => {
  if (!thresholds) return SEA_STATUS.normal;
  if (level >= thresholds.max) return SEA_STATUS.record;
  if (level >= thresholds.high) return SEA_STATUS.high;
  if (level >= thresholds.elevated) return SEA_STATUS.elevated;
  return SEA_STATUS.normal;
};
const frameTime = (minute) => {
  const date = new Date(minute * 60000);
  const day = date.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const diffDays = Math.round((Date.parse(day) - Date.parse(today)) / 864e5);
  const dayText = diffDays === 0 ? "วันนี้" : diffDays === 1 ? "พรุ่งนี้" : diffDays === -1 ? "เมื่อวาน" : date.toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Bangkok" });
  return `${dayText} ${date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" })} น.`;
};
const hourOf = (minute) => Number(new Date(minute * 60000).toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Bangkok" }));

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = (event) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export default function TideAnimation({ series = [], thresholds = null, nowMinute }) {
  const reduced = usePrefersReducedMotion();
  const nowIndex = useMemo(() => {
    const index = series.findIndex(([minute]) => minute >= nowMinute);
    return index === -1 ? series.length - 1 : Math.max(0, index);
  }, [series, nowMinute]);
  const [index, setIndex] = useState(nowIndex);
  const [playing, setPlaying] = useState(false);
  const started = useRef(false);

  // เริ่มที่ "ตอนนี้" แล้วเล่นไปข้างหน้าอัตโนมัติหนึ่งครั้ง (ยกเว้นผู้ใช้ตั้งค่าลดการเคลื่อนไหว)
  useEffect(() => {
    setIndex(nowIndex);
    if (!started.current && !reduced && series.length) {
      started.current = true;
      setPlaying(true);
    }
  }, [nowIndex, reduced, series.length]);

  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1 >= series.length ? 0 : current + 1));
    }, SPEED_MS);
    return () => window.clearInterval(timer);
  }, [playing, series.length]);

  if (series.length < 2) return null;
  const [minute, level] = series[Math.min(index, series.length - 1)];
  const status = statusOf(level, thresholds);
  const seaY = yOf(level);
  const bankLevel = thresholds?.high ?? 2.0;
  const lowlandLevel = (thresholds?.elevated ?? 1.8) - 0.15;
  const bankY = yOf(bankLevel);
  const lowY = yOf(lowlandLevel);
  const riverLevel = Math.max(RIVER_BASE, level - 0.05);
  const riverY = yOf(riverLevel);
  const pushingIn = level > RIVER_BASE + 0.05;
  const overtopping = level >= bankLevel;
  const hour = hourOf(minute);
  const night = hour < 6 || hour >= 18;
  const isFuture = minute > nowMinute;

  // พื้นที่: ทะเล (0–150) | ชายหาด/คันดิน (150–190) | ปากคลอง (190–228) | ที่ลุ่มและบ้าน (228–320)
  const land = `M150,${Y_BOTTOM + 18} L150,${yOf(-0.2)} Q165,${yOf(1.2)} 178,${bankY} L190,${bankY} L190,${yOf(-0.6)} L228,${yOf(-0.6)} L228,${bankY} L240,${bankY} L246,${lowY} L320,${lowY} L320,${Y_BOTTOM + 18} Z`;

  return (
    <div className="mt-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-hidden rounded-lg" role="img"
        aria-label={`ภาพจำลองน้ำทะเลหนุน ${frameTime(minute)} ระดับ ${level.toFixed(2)} เมตร ${status.label}`}>
        <defs>
          <linearGradient id="tide-sky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={night ? "#0b1d3a" : "#7cc4ef"} />
            <stop offset="100%" stopColor={night ? "#1d3a63" : "#d6eefb"} />
          </linearGradient>
          <linearGradient id="tide-sea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={night ? "#1f6fa8" : "#2d9cdb"} />
            <stop offset="100%" stopColor={night ? "#0a2e52" : "#0b4c86"} />
          </linearGradient>
          <clipPath id="tide-clip"><rect x="0" y="0" width={W} height={H} rx="8" /></clipPath>
        </defs>
        <g clipPath="url(#tide-clip)">
          <rect width={W} height={H} fill="url(#tide-sky)" />
          {night ? <circle cx="40" cy="16" r="6" fill="#f8fafc" opacity="0.9" /> : <circle cx="40" cy="16" r="8" fill="#fde68a" />}
          {/* เกาะหินปูนไกล ๆ */}
          <path d={`M60,${yOf(0.4)} q10,-34 24,-30 q8,-4 12,30 Z`} fill={night ? "#1e3a5f" : "#5f8f7a"} opacity="0.7" />

          {/* ทะเล + คลื่น */}
          <rect x="0" y={seaY} width="200" height={H - seaY} fill="url(#tide-sea)" />
          <g className="tide-waves">
            <path d={`M-40,${seaY} q10,-3 20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 v6 h-260 Z`} fill="#ffffff" opacity="0.18" />
          </g>

          {/* น้ำในคลอง (ด้านหลังปากคลอง) */}
          <rect x="190" y={riverY} width="38" height={H - riverY} fill={pushingIn ? "#3b82c4" : "#4f9fc9"} />

          {/* น้ำเอ่อเข้าที่ลุ่มเมื่อเกินคัน */}
          {overtopping ? <rect x="228" y={Math.min(seaY, lowY)} width={W - 228} height={Math.max(0, lowY - seaY) + 4} fill="#3b82c4" opacity="0.75" /> : null}

          <path d={land} fill={night ? "#3b4a3f" : "#8a7a55"} />
          <path d={`M150,${yOf(-0.2)} Q165,${yOf(1.2)} 178,${bankY}`} fill="none" stroke="#e7d7a8" strokeWidth="3" opacity="0.8" />
          {/* บ้านใต้ถุนสูงในที่ลุ่ม */}
          {[252, 286].map((x) => (
            <g key={x} transform={`translate(${x},${lowY})`}>
              <rect x="-1" y="-10" width="2" height="10" fill="#5b4636" />
              <rect x="13" y="-10" width="2" height="10" fill="#5b4636" />
              <rect x="-3" y="-24" width="20" height="14" fill={night ? "#cbd5e1" : "#f8fafc"} />
              <path d="M-5,-24 L7,-33 L19,-24 Z" fill="#b45309" />
              {night ? <rect x="4" y="-20" width="5" height="5" fill="#fde047" /> : null}
            </g>
          ))}
          <g transform={`translate(${Math.round(256 + 12)},${lowY - 40})`}>
            <path d="M0,0 q3,-12 0,-22 M0,-10 q-7,-4 -10,-2 M0,-14 q7,-5 11,-1" stroke="#166534" strokeWidth="2" fill="none" />
          </g>

          {/* เส้นเกณฑ์ */}
          {thresholds ? (
            <g fontSize="8" fontWeight="700">
              <line x1="0" x2={W} y1={yOf(thresholds.high)} y2={yOf(thresholds.high)} stroke={SEA_STATUS.high.color} strokeDasharray="4 3" />
              <line x1="0" x2={W} y1={yOf(thresholds.elevated)} y2={yOf(thresholds.elevated)} stroke={SEA_STATUS.elevated.color} strokeDasharray="4 3" />
            </g>
          ) : null}
          <line x1="0" x2="148" y1={yOf(0)} y2={yOf(0)} stroke="#ffffff" strokeOpacity="0.35" strokeDasharray="2 3" />
          <text x="4" y={yOf(0) - 2} fontSize="7.5" fill="#ffffff" opacity="0.75">รทก. 0 ม.</text>

          {/* ลูกศรทิศทางน้ำที่ปากคลอง */}
          <g transform={`translate(209,${Math.min(seaY, riverY) - 10})`}>
            <path d={pushingIn ? "M-14,0 H10 M4,-5 L10,0 L4,5" : "M14,0 H-10 M-4,-5 L-10,0 L-4,5"} stroke={pushingIn ? "#fbbf24" : "#a7f3d0"} strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </g>

          {/* ป้ายเวลา/ระดับ */}
          <rect x="6" y="6" width="150" height="34" rx="6" fill="#0c2f4a" opacity="0.72" />
          <text x="12" y="19" fontSize="9.5" fill="#ffffff" fontWeight="700">{frameTime(minute)}{isFuture ? " (คาดการณ์)" : ""}</text>
          <text x="12" y="33" fontSize="11" fill="#ffffff" fontWeight="800">{level > 0 ? "+" : ""}{level.toFixed(2)} ม.</text>
          <rect x="70" y="24" width={status.label.length * 6.2 + 10} height="13" rx="6.5" fill={status.color} />
          <text x="75" y="33.5" fontSize="8.5" fill={status.text} fontWeight="800">{status.label}</text>
          <text x={W - 6} y={H - 6} textAnchor="end" fontSize="8" fill="#ffffff" fontWeight="700" opacity="0.9">
            {overtopping ? "น้ำเอ่อข้ามคันเข้าที่ลุ่ม" : pushingIn ? "น้ำทะเลดันเข้าคลอง คลองระบายช้า" : "น้ำในคลองไหลลงทะเลได้"}
          </text>
        </g>
      </svg>

      <div className="mt-1.5 flex items-center gap-2">
        <button type="button" onClick={() => setPlaying((value) => !value)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15 hover:bg-white/25" aria-label={playing ? "หยุดภาพเคลื่อนไหว" : "เล่นภาพเคลื่อนไหว"}>
          {playing ? <Pause className="h-3.5 w-3.5" aria-hidden="true" /> : <Play className="h-3.5 w-3.5" aria-hidden="true" />}
        </button>
        <input
          type="range"
          min={0}
          max={series.length - 1}
          value={index}
          onChange={(event) => { setPlaying(false); setIndex(Number(event.target.value)); }}
          className="h-1.5 min-w-0 flex-1 cursor-pointer accent-sky-300"
          aria-label="เลื่อนดูระดับน้ำทะเลตามเวลา"
          aria-valuetext={`${frameTime(minute)} ${level.toFixed(2)} เมตร`}
        />
        <button type="button" onClick={() => { setPlaying(false); setIndex(nowIndex); }} className="flex h-7 shrink-0 items-center gap-1 rounded-full bg-white/15 px-2 text-[11px] font-bold hover:bg-white/25">
          <RotateCcw className="h-3 w-3" aria-hidden="true" />ตอนนี้
        </button>
      </div>
      <style>{`
        .tide-waves { animation: tide-wave 3.2s linear infinite; }
        @keyframes tide-wave { from { transform: translateX(0); } to { transform: translateX(40px); } }
        @media (prefers-reduced-motion: reduce) { .tide-waves { animation: none; } }
      `}</style>
    </div>
  );
}
