"use client";

// การ์ด "น้ำทะเลหนุน" ในแผงซ้ายของหน้าพยากรณ์และความเสี่ยง (ธีมกระจกเข้ม)
// กราฟ 48 ชม. + ช่วงคาดการณ์ 14 ชม.: เส้นประ = เกณฑ์หนุนสูงกว่าปกติ/หนุนสูง จุด = น้ำขึ้นสูงสุดแต่ละรอบ
import { SEA_STATUS } from "@/lib/seaLevel";

const W = 320;
const H = 116;
const PAD = { l: 30, r: 8, t: 8, b: 18 };
const FUTURE_MIN = 14 * 60;

const timeText = (value) => {
  try {
    return new Date(value).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
  } catch {
    return "";
  }
};
const dayTime = (value) => {
  const date = new Date(value);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const day = date.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  return `${day === today ? "วันนี้" : "พรุ่งนี้"} ${timeText(value)} น.`;
};
const signed = (value) => (value === null || value === undefined ? "-" : `${value > 0 ? "+" : ""}${value.toFixed(2)}`);
const statusMeta = (key) => SEA_STATUS[key] || null;

function TideChart({ data }) {
  const series = data.series || [];
  if (series.length < 2) return null;
  const minuteOf = (iso) => Math.round(new Date(iso).getTime() / 60000);
  const x0 = series[0][0];
  const lastMinute = series[series.length - 1][0];
  const x1 = lastMinute + FUTURE_MIN;
  const nexts = (data.next_highs || []).filter((item) => minuteOf(item.at) <= x1);
  const values = [...series.map((point) => point[1]), data.thresholds?.high, ...nexts.map((item) => item.est_level)].filter(Number.isFinite);
  const yMin = Math.min(...values) - 0.1;
  const yMax = Math.max(...values) + 0.15;
  const sx = (minute) => PAD.l + ((minute - x0) / (x1 - x0)) * (W - PAD.l - PAD.r);
  const sy = (level) => PAD.t + (1 - (level - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);
  const line = series.map(([m, v], i) => `${i ? "L" : "M"}${sx(m).toFixed(1)},${sy(v).toFixed(1)}`).join("");
  const area = `${line}L${sx(lastMinute).toFixed(1)},${H - PAD.b}L${sx(x0).toFixed(1)},${H - PAD.b}Z`;
  const ticks = [];
  for (let m = Math.ceil(x0 / 360) * 360; m <= x1; m += 360) ticks.push(m); // ทุก 6 ชม.
  const threshold = (value, color) => (Number.isFinite(value) ? (
    <line x1={PAD.l} x2={W - PAD.r} y1={sy(value)} y2={sy(value)} stroke={color} strokeDasharray="4 3" strokeWidth="1.1" opacity="0.95" />
  ) : null);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-auto w-full" role="img" aria-label={`กราฟระดับน้ำทะเล 48 ชั่วโมง ระดับล่าสุด ${signed(data.level)} เมตร`}>
      <defs>
        <linearGradient id="sea-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* ช่วงอนาคต */}
      <rect x={sx(lastMinute)} y={PAD.t} width={sx(x1) - sx(lastMinute)} height={H - PAD.t - PAD.b} fill="#ffffff" opacity="0.05" />
      {[0].filter((v) => v > yMin && v < yMax).map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={sy(v)} y2={sy(v)} stroke="#ffffff" opacity="0.18" />
          <text x={PAD.l - 4} y={sy(v) + 3} textAnchor="end" fontSize="8.5" fill="#ffffff" opacity="0.6">เฉลี่ย</text>
        </g>
      ))}
      {threshold(data.thresholds?.elevated, SEA_STATUS.elevated.color)}
      {threshold(data.thresholds?.high, SEA_STATUS.high.color)}
      <path d={area} fill="url(#sea-fill)" />
      <path d={line} fill="none" stroke="#7dd3fc" strokeWidth="1.8" strokeLinejoin="round" />
      {(data.highs || []).map((high) => (
        <circle key={high.at} cx={sx(minuteOf(high.at))} cy={sy(high.level)} r="3.2" fill={statusMeta(high.status)?.color || "#7dd3fc"} stroke="#0c2f4a" strokeWidth="1" />
      ))}
      {nexts.map((item) => (
        <g key={item.at}>
          <line x1={sx(minuteOf(item.at))} x2={sx(minuteOf(item.at))} y1={PAD.t} y2={H - PAD.b} stroke="#ffffff" strokeDasharray="2 3" opacity="0.45" />
          {Number.isFinite(item.est_level) ? (
            <circle cx={sx(minuteOf(item.at))} cy={sy(item.est_level)} r="3.2" fill="none" stroke={statusMeta(item.status)?.color || "#ffffff"} strokeWidth="1.6" />
          ) : null}
        </g>
      ))}
      <circle cx={sx(lastMinute)} cy={sy(series[series.length - 1][1])} r="3.6" fill="#ffffff" stroke="#38bdf8" strokeWidth="1.5" />
      <text x={sx(lastMinute)} y={H - 4} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#ffffff">ตอนนี้</text>
      {ticks.filter((m) => Math.abs(sx(m) - sx(lastMinute)) > 18).map((m) => (
        <text key={m} x={sx(m)} y={H - 4} textAnchor="middle" fontSize="8" fill="#ffffff" opacity="0.55">{timeText(m * 60000)}</text>
      ))}
    </svg>
  );
}

export default function SeaLevelCard({ data, error }) {
  if (error && !data) {
    return (
      <div className="rounded-xl bg-white/5 p-3 text-[12px] text-white/70 ring-1 ring-white/10">
        <p className="text-xs font-black text-white/70">น้ำทะเลหนุน</p>
        <p className="mt-1">{error}</p>
      </div>
    );
  }
  if (!data) return <div className="h-40 animate-pulse rounded-xl bg-white/5 ring-1 ring-white/10" aria-label="กำลังโหลดข้อมูลระดับน้ำทะเล" />;

  const status = data.status;
  const next = (data.next_highs || []).find((item) => Number.isFinite(item.est_level)) || data.next_highs?.[0];
  const nextStatus = statusMeta(next?.status);

  return (
    <section className="overflow-hidden rounded-xl ring-1 ring-white/10" aria-label="ระดับน้ำทะเลและน้ำทะเลหนุน">
      <div className="p-3" style={{ background: `linear-gradient(135deg, ${status.color}38, ${status.color}0d 70%)` }}>
        <p className="flex flex-wrap items-center gap-1.5 text-xs font-black text-white/70">
          น้ำทะเลหนุน • สถานี{data.station?.name}
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-white/75">IOC</span>
          {data.stale ? <span className="rounded bg-amber-400/90 px-1.5 py-0.5 text-[10px] font-bold text-slate-900">ข้อมูลเก่า</span> : null}
        </p>
        <div className="mt-1.5 flex items-end justify-between gap-3">
          <p className="leading-none">
            <span className="font-[family-name:var(--font-kanit)] text-[2.2rem] font-semibold tabular-nums">{signed(data.level)}</span>
            <span className="ml-1 text-xs font-bold text-white/70">ม.</span>
            {data.trend ? <span className="ml-2 text-sm font-bold text-white/85" title={data.trend.label}>{data.trend.arrow} {data.trend.label}</span> : null}
          </p>
          <span className="mb-1 shrink-0 rounded-full px-3 py-1 text-[13px] font-black" style={{ backgroundColor: status.color, color: status.text }}>{status.label}</span>
        </div>
        <p className="mt-1.5 text-[11px] text-white/70">
          เทียบระดับเฉลี่ย 30 วัน ณ {timeText(data.observed_at)} น.{data.phase ? ` • ${data.phase.label}` : ""}
        </p>
        <TideChart data={data} />
        <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10.5px] text-white/65" aria-hidden="true">
          <span className="flex items-center gap-1"><span className="w-4 border-t border-dashed" style={{ borderColor: SEA_STATUS.elevated.color }} />หนุนสูงกว่าปกติ</span>
          <span className="flex items-center gap-1"><span className="w-4 border-t border-dashed" style={{ borderColor: SEA_STATUS.high.color }} />หนุนสูง</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#2a9db0]" />น้ำขึ้นแต่ละรอบ</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full border border-white" />คาดการณ์</span>
        </p>
        {next ? (
          <p className="mt-1 text-[12.5px] text-white/90">
            น้ำขึ้นครั้งถัดไป ~<b>{dayTime(next.at)}</b>
            {Number.isFinite(next.est_level) ? <> ระดับราว <b>{signed(next.est_level)} ม.</b></> : null}
            {nextStatus ? <span className="ml-1 rounded px-1.5 py-0.5 text-[11px] font-bold" style={{ backgroundColor: nextStatus.color, color: nextStatus.text }}>{nextStatus.label}</span> : null}
          </p>
        ) : null}
        <p className="mt-2 text-[12.5px] font-semibold leading-snug text-white/90">{status.advice}</p>
      </div>
      <p className="border-t border-white/10 px-3 py-2 text-[10.5px] leading-4 text-white/55">
        สตูลไม่มีสถานีวัดระดับน้ำทะเลแบบเรียลไทม์ ใช้สถานี{data.station?.name} ห่างเมืองสตูลราว {data.station?.distance_km} กม. (ทะเลอันดามันฝั่งเดียวกัน)
        ระดับเป็นค่าเทียบเฉลี่ย 30 วันของสถานี ไม่ใช่ รทก. • &quot;หนุน&quot; เทียบกับน้ำขึ้นสูงสุดแต่ละรอบใน 30 วัน • เวลาน้ำขึ้นครั้งถัดไปเป็นค่าประมาณจากรอบน้ำ
        <br />ข้อมูล: IOC Sea Level Station Monitoring Facility ({data.station?.operator}) CC-BY 4.0
      </p>
    </section>
  );
}

/** ป้ายเล็กบนแถบด้านบน */
export function SeaLevelPill({ data }) {
  if (!data?.status) return null;
  return (
    <span className="flex items-center gap-1.5 px-1.5 font-semibold text-white/85" title={`ระดับน้ำทะเล (สถานี${data.station?.name}) ${data.status.label}`}>
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: data.status.color }} aria-hidden="true" />
      น้ำทะเล {data.status.key === "normal" ? "ปกติ" : data.status.label} {data.trend?.arrow || ""}
    </span>
  );
}
