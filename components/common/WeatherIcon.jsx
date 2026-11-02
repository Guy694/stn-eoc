// ภาพสภาพอากาศแบบสี (แดด เมฆ ฝน ฟ้าคะนอง หมอก) วาดด้วย SVG — ไม่ต้องโหลดไฟล์ภาพ ใช้ได้ตอนสัญญาณแย่
import { WEATHER_KINDS, weatherKind } from "@/lib/weatherIcon";

const SUN = "#f5b301";
const CLOUD = "#e2e8f0";
const CLOUD_DARK = "#94a3b8";
const RAIN = "#2f80ed";
const BOLT = "#facc15";
const CLOUD_PATH = "M18 46h28a10 10 0 0 0 1.5-19.9A14 14 0 0 0 20.3 23 11.5 11.5 0 0 0 18 46z";

function Sun({ cx = 32, cy = 32, r = 11 }) {
  const rays = Array.from({ length: 8 }, (_, index) => {
    const angle = (index * Math.PI) / 4;
    return { x1: cx + Math.cos(angle) * (r + 4), y1: cy + Math.sin(angle) * (r + 4), x2: cx + Math.cos(angle) * (r + 9), y2: cy + Math.sin(angle) * (r + 9) };
  });
  return (
    <g className="wx-sun">
      {rays.map((ray, index) => <line key={index} {...ray} stroke={SUN} strokeWidth="3.5" strokeLinecap="round" />)}
      <circle cx={cx} cy={cy} r={r} fill={SUN} />
    </g>
  );
}

function Cloud({ dark = false, dy = 0 }) {
  return <path d={CLOUD_PATH} transform={`translate(0 ${dy})`} fill={dark ? CLOUD_DARK : CLOUD} stroke={dark ? "#64748b" : "#cbd5e1"} strokeWidth="1.5" />;
}

function Drops({ count = 3, long = false }) {
  const xs = count === 2 ? [26, 38] : [22, 32, 42];
  return (
    <g className="wx-rain" stroke={RAIN} strokeWidth="3.2" strokeLinecap="round">
      {xs.map((x, index) => <line key={x} x1={x} y1={51 + (index % 2) * 2} x2={x - 3} y2={(long ? 61 : 58) + (index % 2) * 2} />)}
    </g>
  );
}

export default function WeatherIcon({ code, text, className = "h-12 w-12", title }) {
  const kind = weatherKind(code, text);
  const label = title || text || WEATHER_KINDS[kind];
  return (
    <svg viewBox="0 0 64 64" className={`wx wx--${kind} ${className}`} role="img" aria-label={label}>
      {kind === "sun" ? <Sun /> : null}
      {kind === "partly" ? <><Sun cx={24} cy={24} r={9} /><Cloud dy={4} /></> : null}
      {kind === "cloud" ? <><Cloud dark dy={-6} /><Cloud dy={2} /></> : null}
      {kind === "fog" ? (
        <>
          <Cloud dy={-8} />
          <g stroke={CLOUD_DARK} strokeWidth="3" strokeLinecap="round"><line x1="14" y1="46" x2="50" y2="46" /><line x1="18" y1="53" x2="46" y2="53" /></g>
        </>
      ) : null}
      {kind === "drizzle" ? <><Cloud dy={-4} /><Drops count={2} /></> : null}
      {kind === "showers" ? <><Sun cx={22} cy={20} r={8} /><Cloud dy={-2} /><Drops count={2} /></> : null}
      {kind === "rain" ? <><Cloud dark dy={-4} /><Drops /></> : null}
      {kind === "heavy" ? <><Cloud dark dy={-4} /><Drops long /></> : null}
      {kind === "storm" ? (
        <>
          <Cloud dark dy={-6} />
          <path className="wx-bolt" d="M34 40l-8 12h6l-3 10 10-14h-6l4-8z" fill={BOLT} stroke="#ca8a04" strokeWidth="1" strokeLinejoin="round" />
          <g stroke={RAIN} strokeWidth="3" strokeLinecap="round"><line x1="20" y1="48" x2="17" y2="56" /><line x1="46" y1="48" x2="43" y2="56" /></g>
        </>
      ) : null}
      <style>{`
        .wx-sun { transform-origin: center; transform-box: fill-box; animation: wx-spin 24s linear infinite; }
        .wx-rain line { animation: wx-drop 1.4s ease-in infinite; }
        .wx-rain line:nth-child(2) { animation-delay: .35s; }
        .wx-rain line:nth-child(3) { animation-delay: .7s; }
        .wx-bolt { animation: wx-flash 3s ease-in-out infinite; }
        @keyframes wx-spin { to { transform: rotate(360deg); } }
        @keyframes wx-drop { 0% { opacity: 0; transform: translateY(-3px); } 30% { opacity: 1; } 100% { opacity: 0; transform: translateY(3px); } }
        @keyframes wx-flash { 0%, 70%, 100% { opacity: 1; } 75%, 85% { opacity: .3; } }
        @media (prefers-reduced-motion: reduce) { .wx-sun, .wx-rain line, .wx-bolt { animation: none; } }
      `}</style>
    </svg>
  );
}
