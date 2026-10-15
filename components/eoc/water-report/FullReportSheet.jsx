"use client";

// รายงานระดับน้ำแบบ 4 หัวข้อ (การประเมินความเสี่ยงสถานการณ์อุทกภัย จังหวัดสตูล) ขนาด A4
// 1 ระดับน้ำสถานีเฝ้าระวัง ปภ. หลายช่วงเวลา · 2 ระดับลุ่มน้ำหลัก (ThaiWater) · 3 ฝนสะสม 24 ชม. และคาดการณ์ · 4 พื้นที่เฝ้าระวังสำคัญ
import { formatLevel } from "@/lib/dpmWater";
import { thaiShortDate } from "@/lib/waterReportExtras";
import { Arrow, BRAND, DEFAULT_FOOTER, DOWN, NAVY, SectionHead, StatusFlag, STEADY, UP } from "@/components/eoc/water-report/sheetParts";

const BORDER = "#c9dcee";
const ZEBRA = "#f7fbfe";
const BANK_RED = "#d32f2f";
const WARN_ORANGE = "#e08a00";
const WATER = "#5aa9e6";
const EARTH = "#a0703f";

const diffColor = (direction) => (direction === "up" ? UP : direction === "down" ? DOWN : STEADY);

function bangkokTime(iso) {
  const time = new Date(iso || 0);
  if (!Number.isFinite(time.getTime()) || time.getTime() <= 0) return "";
  return time.toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" }).replace(":", ".");
}

function hourText(hourKey) {
  const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2})/.exec(String(hourKey || ""));
  return match ? `${thaiShortDate(match[1])} เวลา ${match[2]}.${match[3]} น.` : "";
}

function isoText(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  const local = new Date(date.getTime() + 7 * 3600 * 1000).toISOString();
  return `${thaiShortDate(local.slice(0, 10))} เวลา ${bangkokTime(iso)} น.`;
}

/* ---------- 1 ตารางสถานีเฝ้าระวัง ---------- */
function StationTable({ data }) {
  const { report } = data;
  const columns = data.columns || [];
  const compareColumn = columns.find((column) => column.hour === data.compare) || null;
  const changeLabel = compareColumn ? `เปลี่ยนจาก ${compareColumn.label.replace(" น.", "")} น.` : "เปลี่ยนจากชั่วโมงก่อน";
  const counts = report.counts;
  const allBelow = report.stationsWithData > 0 && report.rows.every((row) => row.belowBank === null || row.belowBank >= 0);
  return (
    <section className="rounded-[10px] border" style={{ borderColor: BORDER }}>
      <SectionHead
        number="1"
        title={`ระดับน้ำสถานีเฝ้าระวัง ${report.rows.length} สถานี`}
        aside={<span className="inline-block rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold" style={{ color: allBelow ? "#15803d" : UP }}>{allBelow ? "✓ ทุกสถานีที่มีข้อมูลต่ำกว่าตลิ่ง" : report.headline}</span>}
      />
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr style={{ background: "#e3eff9", color: NAVY }}>
            <th className="px-2 py-1 text-left font-semibold">รหัส</th>
            <th className="px-2 py-1 text-left font-semibold">สถานี</th>
            {columns.map((column) => <th key={column.hour} className="px-2 py-1 text-right font-semibold">{column.label}</th>)}
            <th className="px-2 py-1 text-right font-semibold">{report.dataLabel.time}</th>
            <th className="px-2 py-1 text-right font-semibold">{changeLabel}</th>
            <th className="px-2 py-1 text-right font-semibold">ต่ำกว่าตลิ่ง</th>
            <th className="px-2 py-1 text-right font-semibold">ตลิ่ง</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row, index) => (
            <tr key={row.code} style={{ background: index % 2 ? ZEBRA : "#ffffff", borderTop: "1px solid #e3edf6" }}>
              <td className="px-2 py-[3px] font-medium">{row.code}</td>
              <td className="px-2 py-[3px] leading-snug">{row.name}</td>
              {columns.map((column) => <td key={column.hour} className="px-2 py-[3px] text-right tabular-nums">{formatLevel(column.levels?.[row.code] ?? null)}</td>)}
              <td className="px-2 py-[3px] text-right font-semibold tabular-nums">{row.malfunction || row.level === null ? <span className="font-normal text-slate-500">ไม่มีข้อมูล</span> : formatLevel(row.level)}</td>
              <td className="px-2 py-[3px] text-right tabular-nums">
                <span className="inline-flex items-center justify-end gap-1 font-semibold" style={{ color: diffColor(row.direction) }}>
                  <Arrow direction={row.direction} />
                  {row.diff === null ? "" : row.direction === "steady" ? "คงที่" : Math.abs(row.diff).toFixed(2)}
                </span>
              </td>
              <td className="px-2 py-[3px] text-right tabular-nums" style={row.belowBank !== null && row.belowBank < 1 ? { color: UP, fontWeight: 700 } : undefined}>
                {row.belowBank === null ? "–" : row.belowBank < 0 ? `ล้น ${Math.abs(row.belowBank).toFixed(2)}` : row.belowBank.toFixed(2)}
              </td>
              <td className="px-2 py-[3px] text-right tabular-nums">{formatLevel(row.bank)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="flex flex-wrap justify-between gap-x-4 border-t px-3 py-1 text-[10.5px] text-slate-600" style={{ borderColor: "#e3edf6" }}>
        <span><b style={{ color: NAVY }}>หมายเหตุ:</b> มีข้อมูลล่าสุด {report.stationsWithData} สถานี : เพิ่มขึ้น {counts.up} ลดลง {counts.down}{counts.steady ? ` คงที่ ${counts.steady}` : ""} สถานี</span>
        <span>หน่วย: เมตร · ต่ำกว่าตลิ่ง = ตลิ่ง − ระดับน้ำ {report.dataLabel.time}</span>
      </p>
    </section>
  );
}

/* ---------- 2 ลุ่มน้ำหลัก: ภาพตัดขวางลำน้ำ ---------- */
function CrossSection({ card }) {
  const { level, bank, warning } = card;
  const W = 230;
  const H = 104;
  const values = [level, bank, warning].filter((value) => value !== null && value !== undefined);
  if (!values.length) return <div className="grid h-[104px] place-items-center text-[11px] text-slate-500">ไม่มีข้อมูลระดับน้ำ</div>;
  const high = Math.max(...values);
  const low = Math.min(...values);
  const span = Math.max(high - low, 1.5);
  const top = high + span * 0.18;
  const bottom = low - span * 0.55;
  const y = (value) => 8 + ((top - value) / (top - bottom)) * (H - 14);
  const bedY = H - 4;
  const bankY = bank !== null ? y(bank) : 14;
  const leftTop = 34;
  const rightTop = W - 58;
  const slope = 30;
  const waterY = level !== null ? y(level) : null;
  // ขอบน้ำบนตลิ่งที่ลาดเอียง (ตำแหน่ง x ตามความสูงของผิวน้ำ)
  const xOnLeft = (yy) => leftTop + ((yy - bankY) / (bedY - bankY)) * slope;
  const xOnRight = (yy) => rightTop - ((yy - bankY) / (bedY - bankY)) * slope;
  const marker = level !== null ? (leftTop + rightTop) / 2 - 22 : 0;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-[104px] w-full" role="img" aria-label={`${card.label} ระดับน้ำ ${formatLevel(level)} ม. ตลิ่ง ${formatLevel(bank)} ม.`}>
      <rect x="0" y="0" width={W} height={H} fill="#eef6fc" />
      {waterY !== null ? (
        <polygon points={`${xOnLeft(waterY)},${waterY} ${xOnRight(waterY)},${waterY} ${rightTop - slope},${bedY} ${leftTop + slope},${bedY}`} fill={WATER} opacity="0.85" />
      ) : null}
      <polygon points={`0,${bankY} ${leftTop},${bankY} ${leftTop + slope},${bedY} 0,${bedY}`} fill={EARTH} />
      <polygon points={`${rightTop},${bankY} ${W - 40},${bankY} ${W - 40},${bedY} ${rightTop - slope},${bedY}`} fill={EARTH} />
      <rect x="0" y={bedY} width={W - 40} height={H - bedY} fill="#7a5530" />
      {bank !== null ? (
        <>
          <line x1="2" x2={W - 42} y1={bankY} y2={bankY} stroke={BANK_RED} strokeWidth="1.4" strokeDasharray="5 3" />
          <text x={(W - 40) / 2} y={bankY - 2.5} textAnchor="middle" fontSize="9.5" fontWeight="700" fill={BANK_RED}>ตลิ่ง {formatLevel(bank)} ม.</text>
        </>
      ) : null}
      {warning !== null ? (
        <>
          <line x1="2" x2={W - 42} y1={y(warning)} y2={y(warning)} stroke={WARN_ORANGE} strokeWidth="1.3" strokeDasharray="4 3" />
          <text x={(W - 40) / 2} y={y(warning) - 2.5} textAnchor="middle" fontSize="9" fontWeight="600" fill={WARN_ORANGE}>เฝ้าระวัง {formatLevel(warning)} ม.</text>
        </>
      ) : null}
      {waterY !== null ? (
        <>
          <circle cx={marker} cy={waterY} r="3" fill="#ffffff" stroke="#0f172a" strokeWidth="1.2" />
          <text x={marker + 6} y={Math.min(bedY - 4, waterY + 11)} fontSize="10.5" fontWeight="700" fill="#0f172a">{formatLevel(level)} ม.</text>
        </>
      ) : null}
      {card.belowBank !== null && waterY !== null ? (
        <>
          <line x1={W - 32} x2={W - 32} y1={Math.min(bankY, waterY)} y2={Math.max(bankY, waterY)} stroke="#0f172a" strokeWidth="1" />
          <line x1={W - 36} x2={W - 28} y1={bankY} y2={bankY} stroke="#0f172a" strokeWidth="1" />
          <line x1={W - 36} x2={W - 28} y1={waterY} y2={waterY} stroke="#0f172a" strokeWidth="1" />
          <text x={W - 2} y={(bankY + waterY) / 2 - 3} textAnchor="end" fontSize="8.5" fill="#0f172a">{card.belowBank < 0 ? "สูงกว่า" : "ต่ำกว่า"}</text>
          <text x={W - 2} y={(bankY + waterY) / 2 + 9} textAnchor="end" fontSize="10" fontWeight="700" fill={card.belowBank < 0 ? BANK_RED : "#0f172a"}>{Math.abs(card.belowBank).toFixed(2)}</text>
        </>
      ) : null}
    </svg>
  );
}

function BasinCard({ card }) {
  const changeText = card.diff === null ? "–" : card.direction === "steady" ? "คงที่" : Math.abs(card.diff).toFixed(2);
  return (
    <div className="overflow-hidden rounded-lg border" style={{ borderColor: BORDER }}>
      <p className="flex items-center justify-center gap-1 px-2 py-1 text-[13.5px] font-semibold text-white" style={{ background: NAVY }}>
        <svg width="11" height="14" viewBox="0 0 12 16" aria-hidden="true"><path d="M6 0a6 6 0 0 0-6 6c0 4.5 6 10 6 10s6-5.5 6-10a6 6 0 0 0-6-6zm0 8.4A2.4 2.4 0 1 1 6 3.6a2.4 2.4 0 0 1 0 4.8z" fill="#fff" /></svg>
        {card.label}
      </p>
      {card.station ? <CrossSection card={card} /> : (
        <div className="grid h-[104px] place-items-center px-3 text-center text-[11px] text-slate-500">ยังไม่พบสถานีวัดของ{card.label} เลือกสถานีได้ที่ “ตั้งค่ารายงาน”</div>
      )}
      <table className="w-full border-collapse text-center text-[11.5px]">
        <thead>
          <tr style={{ background: "#e3eff9", color: NAVY }}>
            <th className="py-0.5 font-semibold">{card.previousSource === "previous" ? "ครั้งก่อน" : "เมื่อวาน"}</th>
            <th className="py-0.5 font-semibold">ล่าสุด</th>
            <th className="py-0.5 font-semibold">เปลี่ยนแปลง</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="py-0.5 tabular-nums">{formatLevel(card.previous)}</td>
            <td className="py-0.5 font-semibold tabular-nums">{formatLevel(card.level)}</td>
            <td className="py-0.5 tabular-nums">
              <span className="inline-flex items-center gap-1 font-semibold" style={{ color: diffColor(card.direction) }}><Arrow direction={card.direction} size={12} />{changeText}</span>
            </td>
          </tr>
        </tbody>
      </table>
      {card.station ? <p className="truncate border-t px-2 py-0.5 text-[9px] text-slate-500" style={{ borderColor: "#e3edf6" }}>สถานี{card.station.name}{card.station.agency ? ` (${card.station.agency})` : ""}</p> : null}
    </div>
  );
}

function BasinSection({ extras }) {
  const cards = extras?.basins || [];
  const latest = cards.map((card) => card.observedAt).filter(Boolean).sort().pop();
  const compareHour = cards.map((card) => card.compareHour).find(Boolean);
  const aside = latest ? `ข้อมูล ${isoText(latest)}${compareHour ? ` เทียบ ${hourText(compareHour)}` : ""}` : "";
  return (
    <section className="rounded-[10px] border" style={{ borderColor: BORDER }}>
      <SectionHead number="2" title="ระดับลุ่มน้ำหลัก" aside={aside ? <>{aside}<br />หน่วย: เมตร (รทก.)</> : "หน่วย: เมตร (รทก.)"} />
      {!extras ? <p className="px-4 py-6 text-center text-[12px] text-slate-500">กำลังโหลดข้อมูลลุ่มน้ำ…</p> : (
        <div className="grid grid-cols-3 gap-2 p-2">
          {cards.map((card) => <BasinCard key={card.key} card={card} />)}
        </div>
      )}
    </section>
  );
}

/* ---------- 3 ฝน ---------- */
function RainSection({ extras }) {
  const rain = extras?.rain;
  const media = extras?.rain_media || [];
  const forecast = extras?.forecast || [];
  return (
    <section className="rounded-[10px] border" style={{ borderColor: BORDER }}>
      <SectionHead number="3" title="ฝนสะสม 24 ชม. และแนวโน้มเฝ้าระวัง" />
      {!extras ? <p className="px-4 py-6 text-center text-[12px] text-slate-500">กำลังโหลดข้อมูลฝน…</p> : (
        <div className="grid grid-cols-[1fr_1.12fr] gap-2 p-2">
          <div>
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr style={{ background: "#e3eff9", color: NAVY }}>
                  <th className="px-1.5 py-0.5 text-left font-semibold">สถานี</th>
                  <th className="px-1.5 py-0.5 text-right font-semibold leading-tight">ฝน 24 ชม.<br /><span className="font-normal">(มม.)</span></th>
                  <th className="px-1.5 py-0.5 text-center font-semibold">ระดับ</th>
                  <th className="px-1.5 py-0.5 text-right font-semibold">เวลา</th>
                </tr>
              </thead>
              <tbody>
                {rain?.rows?.length ? rain.rows.map((row, index) => (
                  <tr key={row.id} style={{ background: index % 2 ? ZEBRA : "#ffffff", borderTop: "1px solid #e3edf6" }}>
                    <td className="px-1.5 py-[2px] leading-snug">{row.name}{row.amphoe ? <span className="text-[9.5px] text-slate-500"> อ.{row.amphoe}</span> : null}</td>
                    <td className="px-1.5 py-[2px] text-right font-semibold tabular-nums">{row.rain24h.toFixed(1)}</td>
                    <td className="px-1.5 py-[2px] text-center"><span className="inline-block min-w-[3.6rem] rounded px-1 text-[10.5px] font-semibold" style={{ background: row.color, color: row.textColor }}>{row.label}</span></td>
                    <td className="px-1.5 py-[2px] text-right tabular-nums text-slate-600">{row.time}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="px-2 py-4 text-center text-slate-500">ไม่มีสถานีที่วัดฝนได้ใน 24 ชม.ล่าสุด</td></tr>
                )}
              </tbody>
            </table>
            <p className="mt-1 text-[10px] text-slate-500">
              หน่วย: มม.{rain?.timeRange ? ` · เวลารายสถานี ${rain.timeRange}` : ""}{rain?.hidden ? ` · มีฝนอีก ${rain.hidden} สถานี` : ""} · เกณฑ์ฝนกรมอุตุนิยมวิทยา
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            {media.length ? (
              <div className="grid grid-cols-2 gap-1.5">
                {media.map((item, index) => (
                  <figure key={item.url} className="overflow-hidden rounded border" style={{ borderColor: BORDER }}>
                    <figcaption className="px-1 py-0.5 text-center text-[10.5px] font-semibold text-white" style={{ background: BRAND }}>
                      {index === 0 ? "วันนี้" : index === 1 ? "พรุ่งนี้" : ""} {item.datetime ? `(${thaiShortDate(item.datetime)})` : ""}
                    </figcaption>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.url} alt={`แผนที่คาดการณ์ฝน ${thaiShortDate(item.datetime)}`} className="block h-[118px] w-full bg-white object-cover object-left-bottom" crossOrigin="anonymous" />
                  </figure>
                ))}
              </div>
            ) : (
              <p className="rounded border px-2 py-3 text-center text-[11px] text-slate-500" style={{ borderColor: BORDER }}>ยังดึงภาพคาดการณ์ฝนจาก สสน. ไม่ได้</p>
            )}
            {forecast.length ? (
              <table className="w-full border-collapse text-center text-[10.5px]">
                <thead>
                  <tr style={{ background: NAVY, color: "#fff" }}>
                    <th className="px-1 py-0.5 text-left font-semibold">คาดการณ์ 7 วัน</th>
                    {forecast.map((day) => <th key={day.date} className="px-0.5 py-0.5 font-semibold leading-tight">{thaiShortDate(day.date).replace(/ \d{4}$/, "")}</th>)}
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderTop: "1px solid #e3edf6" }}>
                    <td className="px-1 py-0.5 text-left font-semibold" style={{ color: NAVY }}>ฝน</td>
                    {forecast.map((day) => <td key={day.date} className="px-0.5 py-0.5">{day.label}</td>)}
                  </tr>
                  <tr style={{ background: ZEBRA, borderTop: "1px solid #e3edf6" }}>
                    <td className="px-1 py-0.5 text-left font-semibold" style={{ color: NAVY }}>โอกาสฝน (%)</td>
                    {forecast.map((day) => <td key={day.date} className="px-0.5 py-0.5 font-semibold tabular-nums">{day.probability ?? "–"}</td>)}
                  </tr>
                </tbody>
              </table>
            ) : null}
            <p className="text-[9.5px] leading-tight text-slate-500">ภาพ: แบบจำลอง WRF-ROMS ของ สสน. (สตูลอยู่มุมล่างซ้าย) · ตาราง: แบบจำลอง ECMWF ฝนรวมรายวันและโอกาสฝนสูงสุดของวัน</p>
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------- 4 พื้นที่เฝ้าระวัง ---------- */
const AREA_ICONS = {
  drain: <path d="M2 7c3-3 5 3 8 0s5-3 8 0 5 3 8 0M2 14c3-3 5 3 8 0s5-3 8 0 5 3 8 0" stroke={BRAND} strokeWidth="2.4" fill="none" strokeLinecap="round" />,
  upland: <path d="M1 19 9 6l5 7 3-4 8 10z" fill={BRAND} />,
  lowland: <><path d="M7 3v8M4 6l3-3 3 3M17 3v8M14 6l3-3 3 3" stroke={BRAND} strokeWidth="2" fill="none" strokeLinecap="round" /><path d="M1 16c3-2.5 5 2.5 8 0s5-2.5 8 0 5 2.5 8 0" stroke={BRAND} strokeWidth="2" fill="none" strokeLinecap="round" /></>
};

function AreaSection({ areas }) {
  return (
    <section className="rounded-[10px] border" style={{ borderColor: BORDER }}>
      <SectionHead number="4" title="พื้นที่เฝ้าระวังสำคัญ" />
      <div className="grid grid-cols-3 gap-2 p-2">
        {areas.map((area) => (
          <div key={area.key} className="rounded-lg border px-2.5 py-1.5" style={{ borderColor: BORDER, background: ZEBRA }}>
            <p className="flex items-center gap-2 text-[12.5px] font-semibold" style={{ color: NAVY }}>
              <svg width="26" height="20" viewBox="0 0 26 20" aria-hidden="true">{AREA_ICONS[area.key]}</svg>
              {area.title}
            </p>
            <p className="mt-0.5 text-[12px] leading-snug text-slate-700">{area.text || "–"}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function FullReportSheet({ data, extras, config, flag, flagSource, compact = false }) {
  const { report } = data;
  const issuer = config?.issuer || {};
  return (
    <article className="water-sheet relative flex flex-col overflow-hidden bg-white text-slate-800" style={{ width: "210mm", minHeight: "297mm" }} data-a4 data-compact={compact ? "1" : undefined}>
      <header className="relative px-[10mm] pb-6 pt-[5mm]" style={{ background: "linear-gradient(180deg, #e6f1fb 0%, #f6fafe 100%)" }}>
        <div className="flex items-start gap-3">
          <div className="shrink-0 pt-1"><StatusFlag level={flag} source={flagSource} /></div>
          <div className="min-w-0 flex-1">
            <h1 className="text-[24px] font-bold leading-[1.18]" style={{ color: NAVY }}>การประเมินความเสี่ยงสถานการณ์อุทกภัย<br />จังหวัดสตูล</h1>
            <p className="mt-1.5 inline-block rounded-full border bg-white px-4 py-0.5 text-[14px] font-medium" style={{ borderColor: "#9cc2e5", color: NAVY }}>
              ข้อมูล ณ วันที่ {report.dataLabel.date} เวลา {report.dataLabel.time}
            </p>
          </div>
          {issuer.name || issuer.position ? (
            <div className="mt-1 shrink-0 rounded-lg px-3 py-1.5 text-center text-[12px] leading-snug text-white" style={{ background: NAVY }}>
              {issuer.name ? <p className="font-semibold">{issuer.name}</p> : null}
              {issuer.position ? <p className="text-white/85">{issuer.position}</p> : null}
            </div>
          ) : null}
        </div>
        <svg className="absolute inset-x-0 bottom-0 h-6 w-full" viewBox="0 0 800 24" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 14 C 80 4, 160 22, 240 12 S 400 2, 480 12 S 640 22, 720 10 S 790 8, 800 12 V24 H0 Z" fill="#cfe3f5" />
          <path d="M0 18 C 100 10, 180 26, 280 17 S 460 8, 560 17 S 720 25, 800 16 V24 H0 Z" fill="#a9cdee" />
        </svg>
      </header>

      <div className="flex flex-1 flex-col gap-[2.5mm] px-[8mm] pb-[2mm] pt-[2.5mm]">
        <StationTable data={data} />
        <BasinSection extras={extras} />
        <RainSection extras={extras} />
        <AreaSection areas={config?.areas || []} />
        <p className="mt-auto text-[9.5px] leading-tight text-slate-500">
          ที่มา: หัวข้อ 1 {data.source} · หัวข้อ 2–3 คลังข้อมูลน้ำแห่งชาติ (ThaiWater) สสน. และ ECMWF (Open-Meteo)
          {data.from_database ? " · ปภ. ไม่ตอบ ใช้ค่าล่าสุดที่ระบบเก็บไว้" : data.stale ? " · ปภ. ไม่ตอบ ใช้ข้อมูลล่าสุดที่มี" : ""}
        </p>
      </div>

      <footer className="relative px-[12mm] pb-[3mm] pt-4 text-center text-[10px] leading-[1.35]" style={{ background: "linear-gradient(0deg, #dbeaf8 0%, #f6fafe 100%)", color: NAVY }}>
        <svg className="absolute inset-x-0 top-0 h-4 w-full" viewBox="0 0 800 20" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 8 C 120 18, 220 0, 340 9 S 560 18, 680 7 S 780 4, 800 8 V0 H0 Z" fill="#ffffff" />
        </svg>
        {DEFAULT_FOOTER.map((line) => <p key={line} className={line === DEFAULT_FOOTER[0] ? "font-semibold" : ""}>{line}</p>)}
      </footer>
    </article>
  );
}
