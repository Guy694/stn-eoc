"use client";

// การ์ด "น้ำทะเลหนุน" ในแผงซ้ายของหน้าพยากรณ์และความเสี่ยง (ธีมกระจกเข้ม)
// หลัก: พยากรณ์ระดับน้ำทะเลหน้าเมืองสตูล (Open-Meteo Marine / Météo-France SMOC) เทียบ รทก. ปานกลาง
// ตรวจสอบ: ระดับจริงที่สถานี IOC ลังกาวี เทียบพยากรณ์ที่จุดเดียวกัน
import TideAnimation from "@/components/weather/TideAnimation";
import { SEA_STATUS } from "@/lib/seaLevel";

const timeText = (value) => {
  try {
    return new Date(value).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
  } catch {
    return "";
  }
};
const dayTime = (value) => {
  const date = new Date(value);
  const day = date.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const diff = Math.round((Date.parse(day) - Date.parse(today)) / 864e5);
  const dayText = diff === 0 ? "วันนี้" : diff === 1 ? "พรุ่งนี้" : date.toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Bangkok" });
  return `${dayText} ${timeText(value)} น.`;
};
const signed = (value) => (value === null || value === undefined ? "-" : `${value > 0 ? "+" : ""}${Number(value).toFixed(2)}`);
const statusMeta = (key) => SEA_STATUS[key] || null;

function StatusChip({ statusKey, className = "" }) {
  const meta = statusMeta(statusKey);
  if (!meta) return null;
  return <span className={`rounded px-1.5 py-0.5 text-[10.5px] font-bold ${className}`} style={{ backgroundColor: meta.color, color: meta.text }}>{meta.label}</span>;
}

function Comparison({ data }) {
  const c = data.comparison;
  if (!c) return <p className="text-[11px] text-white/60">ยังเทียบกับค่าวัดจริงไม่ได้ (สถานีลังกาวีไม่มีข้อมูลล่าสุด)</p>;
  if (!c.usable) return <p className="text-[11px] text-white/60">ค่าวัดจริงที่ลังกาวีเทียบกับพยากรณ์ได้ไม่ดีช่วงนี้ (คลาดเคลื่อน {Math.round(c.fit_rmse_m * 100)} ซม.) ใช้พยากรณ์อย่างเดียว</p>;
  const cm = Math.round(c.anomaly_m * 100);
  const text = Math.abs(cm) < 15 ? `ตรงกับพยากรณ์ (ต่าง ${cm > 0 ? "+" : ""}${cm} ซม.)` : cm > 0 ? `สูงกว่าพยากรณ์ +${cm} ซม. — มีลม/คลื่นพายุดันน้ำ` : `ต่ำกว่าพยากรณ์ ${cm} ซม.`;
  return (
    <p className="text-[11px] text-white/75">
      <span className={`mr-1 inline-block h-2 w-2 rounded-full ${Math.abs(cm) < 15 ? "bg-emerald-400" : cm > 0 ? "bg-amber-400" : "bg-sky-300"}`} aria-hidden="true" />
      ระดับจริงที่สถานีลังกาวี {timeText(data.observed_at)} น.: {text}
    </p>
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
  if (!data) return <div className="h-56 animate-pulse rounded-xl bg-white/5 ring-1 ring-white/10" aria-label="กำลังโหลดข้อมูลระดับน้ำทะเล" />;

  const modelMode = data.source_mode === "model+observed";
  const status = data.status;
  const upcoming = (data.next_highs || []).slice(0, 4);

  return (
    <section className="overflow-hidden rounded-xl ring-1 ring-white/10" aria-label="ระดับน้ำทะเลและน้ำทะเลหนุน">
      <div className="p-3" style={{ background: `linear-gradient(135deg, ${status.color}38, ${status.color}0d 70%)` }}>
        <p className="flex flex-wrap items-center gap-1.5 text-xs font-black text-white/70">
          น้ำทะเลหนุน • {modelMode ? "หน้าเมืองสตูล" : `สถานี${data.station?.name}`}
          {data.stale ? <span className="rounded bg-amber-400/90 px-1.5 py-0.5 text-[10px] font-bold text-slate-900">ข้อมูลเก่า</span> : null}
        </p>
        <div className="mt-1.5 flex items-end justify-between gap-3">
          <p className="leading-none">
            <span className="font-[family-name:var(--font-kanit)] text-[2.2rem] font-semibold tabular-nums">{signed(data.level)}</span>
            <span className="ml-1 text-xs font-bold text-white/70">ม.{modelMode ? " รทก." : ""}</span>
            {data.trend ? <span className="ml-2 text-sm font-bold text-white/85">{data.trend.arrow} {data.trend.label}</span> : null}
          </p>
          <span className="mb-1 shrink-0 rounded-full px-3 py-1 text-[13px] font-black" style={{ backgroundColor: status.color, color: status.text }} title="สถานะช่วง 24 ชม. นี้">{status.label}</span>
        </div>
        <p className="mt-1.5 text-[11px] text-white/70">
          ตอนนี้{data.phase ? ` • ${data.phase.label}` : ""}{data.range_24h ? ` • ขึ้น-ลงต่างกัน ${data.range_24h} ม.` : ""}
        </p>

        {modelMode ? <TideAnimation series={data.series} thresholds={data.thresholds} nowMinute={data.now_minute} /> : null}

        {upcoming.length ? (
          <div className="mt-2">
            <p className="text-[11px] font-black text-white/65">น้ำขึ้นสูงสุดรอบถัดไป{modelMode ? "" : " (ประมาณ)"}</p>
            <ul className="mt-1 space-y-0.5 text-[12px]">
              {upcoming.map((item) => (
                <li key={item.at} className="flex items-center justify-between gap-2">
                  <span className="text-white/85">{dayTime(item.at)}</span>
                  <span className="flex items-center gap-1.5">
                    <b className="tabular-nums">{signed(item.est_level)} ม.</b>
                    <StatusChip statusKey={item.status} />
                  </span>
                </li>
              ))}
            </ul>
            {data.week_peak && ["high", "record"].includes(data.week_peak.status) ? (
              <p className="mt-1 text-[11px] text-amber-200">สูงสุดใน 7 วัน: {dayTime(data.week_peak.at)} {signed(data.week_peak.level)} ม.</p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-2 space-y-1">
          {modelMode ? <Comparison data={data} /> : null}
          {status.reasons?.map((reason) => <p key={reason} className="text-[11px] font-bold text-amber-200">{reason}</p>)}
        </div>
        <p className="mt-2 text-[12.5px] font-semibold leading-snug text-white/90">{status.advice}</p>
      </div>
      <p className="border-t border-white/10 px-3 py-2 text-[10.5px] leading-4 text-white/55">
        {modelMode ? (
          <>
            พยากรณ์ระดับน้ำทะเลรายชั่วโมงหน้าเมืองสตูลจากแบบจำลอง Météo-France SMOC (Open-Meteo) เทียบระดับทะเลปานกลาง •
            &quot;หนุน&quot; = น้ำขึ้นสูงกว่ารอบน้ำขึ้น 75% / 90% ใน 92 วันที่ผ่านมา ({data.thresholds?.cycles || "-"} รอบ: เกณฑ์ {signed(data.thresholds?.elevated)} / {signed(data.thresholds?.high)} ม.) •
            ตรวจกับค่าวัดจริงที่สถานี IOC ลังกาวี ({data.station?.operator || "UHSLC"}) CC-BY 4.0 • ภาพจำลองเป็นภาพประกอบ ความสูงคันดิน/ที่ลุ่มไม่ใช่ค่าสำรวจจริง
          </>
        ) : (
          <>ใช้ค่าวัดจริงที่สถานี{data.station?.name} (พยากรณ์ไม่พร้อมชั่วคราว) ระดับเทียบเฉลี่ย 30 วันของสถานี • ข้อมูล IOC CC-BY 4.0</>
        )}
      </p>
    </section>
  );
}

/** ป้ายเล็กบนแถบด้านบน */
export function SeaLevelPill({ data }) {
  if (!data?.status) return null;
  return (
    <span className="flex items-center gap-1.5 px-1.5 font-semibold text-white/85" title={`น้ำทะเลหน้าสตูล: ${data.status.label}`}>
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: data.status.color }} aria-hidden="true" />
      น้ำทะเล {data.status.key === "normal" ? "ปกติ" : data.status.label} {data.trend?.arrow || ""}
    </span>
  );
}
