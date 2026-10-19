"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Download, FileDown, ImageDown, Pencil, RefreshCw, Settings2 } from "lucide-react";
import { Button } from "@/components/admin/crud";
import { apiRequest } from "@/lib/adminApi";
import { BANK_LEVELS, flagRecommendations, formatLevel, formatSigned, thaiHourLabel } from "@/lib/dpmWater";
import { FLOOD_FLAGS, flagMeta } from "@/lib/floodTriggers";
import FullReportSheet from "@/components/eoc/water-report/FullReportSheet";
import ReportConfigEditor from "@/components/eoc/water-report/ReportConfigEditor";
import { normalizeReportConfig } from "@/lib/waterReportExtras";
import { Arrow, BRAND, DEFAULT_FOOTER, DOWN, NAVY, SectionHead, StatusFlag, STEADY, UP } from "@/components/eoc/water-report/sheetParts";
import { notify } from "@/lib/notify";

const SHEET_WIDTH_PX = 794; // 210mm ที่ 96dpi
const A4_HEIGHT_PX = 1123; // 297mm ที่ 96dpi
const RECOMMENDATION_KEY = "stn-eoc:water-report:recommendations";
const LAYOUT_KEY = "stn-eoc:water-report:layout";

function readLayout() {
  try {
    return window.localStorage.getItem(LAYOUT_KEY) === "summary" ? "summary" : "full";
  } catch {
    return "full";
  }
}

function readSaved() {
  try {
    const value = JSON.parse(window.localStorage.getItem(RECOMMENDATION_KEY) || "null");
    return Array.isArray(value) && value.length ? value : null;
  } catch {
    return null;
  }
}

function writeSaved(lines) {
  try {
    if (lines) window.localStorage.setItem(RECOMMENDATION_KEY, JSON.stringify(lines));
    else window.localStorage.removeItem(RECOMMENDATION_KEY);
  } catch {
    // ไม่มีที่เก็บในเบราว์เซอร์ก็ใช้ค่าเริ่มต้นต่อ
  }
}

// html2canvas อ่านสีแบบ lab()/oklch() ของ Tailwind v4 ไม่ได้ — แปลงทุกสีในสำเนาเป็น rgb ก่อนวาด
// (วาดสีลง canvas 1 จุดแล้วอ่านค่า rgba กลับ ใช้ได้กับทุกรูปแบบสีที่เบราว์เซอร์รู้จัก)
const COLOR_PROPS = ["color", "backgroundColor", "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor", "outlineColor", "textDecorationColor", "webkitTextStrokeColor", "columnRuleColor", "caretColor", "fill", "stroke", "stopColor", "floodColor", "lightingColor"];
function makeRgbConverter() {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const cache = new Map();
  return (value) => {
    if (!value || value === "none" || /^rgba?\(/.test(value) || value === "transparent") return value;
    if (cache.has(value)) return cache.get(value);
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    const rgb = `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 1000) / 1000})`;
    cache.set(value, rgb);
    return rgb;
  };
}
function inlineRgbColors(doc) {
  const toRgb = makeRgbConverter();
  const view = doc.defaultView || window;
  for (const element of doc.querySelectorAll("*")) {
    if (!element.style) continue;
    const computed = view.getComputedStyle(element);
    for (const prop of COLOR_PROPS) {
      const value = computed[prop];
      if (value && !/^rgba?\(/.test(value) && value !== "none" && value !== "transparent") element.style[prop] = toRgb(value);
    }
    // เงา/วงแหวน (ring) และเงาตัวอักษรของ Tailwind เป็นสีรูปแบบใหม่ — ตัดออกในภาพ
    if (computed.boxShadow && computed.boxShadow !== "none") element.style.boxShadow = "none";
    if (computed.textShadow && computed.textShadow !== "none") element.style.textShadow = "none";
    if (/(lab|lch|oklab|oklch|color-mix)\(/.test(computed.backgroundImage || "")) element.style.backgroundImage = "none";
  }
}

function hourOptionLabel(hour, dataHour) {
  const label = thaiHourLabel(hour);
  const sameDay = hour.slice(0, 10) === String(dataHour || "").slice(0, 10);
  return sameDay ? label.time : `${label.date.replace(/ \d{4}$/, "")} ${label.time}`;
}

function TrendCard({ tone, title, rows }) {
  const color = tone === "up" ? UP : DOWN;
  const bg = tone === "up" ? "#fdeeee" : "#eef5fc";
  const border = tone === "up" ? "#f3c4c4" : "#c9dcee";
  return (
    <div className="flex items-center gap-3 rounded-lg border px-3 py-2" style={{ background: bg, borderColor: border }}>
      <Arrow direction={tone} size={34} />
      <div className="min-w-0">
        <p className="text-[14px] font-semibold" style={{ color: tone === "up" ? UP : NAVY }}>{title}</p>
        {rows.length ? rows.map((row) => (
          <p key={row.code} className="leading-tight">
            <span className="text-[13px] font-semibold text-slate-800">{row.code}</span>{" "}
            <span className="text-[20px] font-bold tabular-nums" style={{ color }}>{formatSigned(row.diff)} ม.</span>
          </p>
        )) : <p className="text-[13px] text-slate-500">ไม่มีสถานี</p>}
      </div>
    </div>
  );
}

function ReportSheet({ data, recommendations, flag, flagSource, compact = false }) {
  const { report } = data;
  const level = flag;
  const counts = report.counts;
  const compare = report.comparedWithBaseline ? `เทียบ ${report.compareLabel.replace(" น.", "")} น.` : "เทียบชั่วโมงก่อน";
  const rise = report.highlights.rise ? [report.highlights.rise] : [];
  const drop = report.highlights.drop ? [report.highlights.drop] : [];
  const next = report.highlights.next;
  const summaryParts = [
    { label: "ระดับน้ำเพิ่มขึ้น", value: counts.up },
    { label: "ลดลง", value: counts.down },
    { label: "คงที่", value: counts.steady }
  ];

  return (
    <article className="water-sheet relative flex flex-col overflow-hidden bg-white text-slate-800" style={{ width: "210mm", minHeight: "297mm" }} data-a4 data-compact={compact ? "1" : undefined}>
      {/* หัวรายงาน */}
      <header className="relative px-[12mm] pb-6 pt-[6mm]" style={{ background: "linear-gradient(180deg, #e6f1fb 0%, #f6fafe 100%)" }}>
        <div className="flex items-start gap-4">
          <div className="flex-1 text-center">
            <h1 className="text-[25px] font-bold leading-[1.2]" style={{ color: NAVY }}>การประเมินความเสี่ยงสถานการณ์อุทกภัย<br />จังหวัดสตูล</h1>
            <p className="mx-auto mt-1.5 inline-block rounded-full border bg-white px-5 py-0.5 text-[14.5px] font-medium" style={{ borderColor: "#9cc2e5", color: NAVY }}>
              ข้อมูล ณ วันที่ {report.dataLabel.date} เวลา {report.dataLabel.time}
            </p>
          </div>
          <div className="absolute right-[6mm] top-[4mm] z-10"><StatusFlag level={level} source={flagSource} /></div>
        </div>
        <svg className="absolute inset-x-0 bottom-0 h-6 w-full" viewBox="0 0 800 24" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 14 C 80 4, 160 22, 240 12 S 400 2, 480 12 S 640 22, 720 10 S 790 8, 800 12 V24 H0 Z" fill="#cfe3f5" />
          <path d="M0 18 C 100 10, 180 26, 280 17 S 460 8, 560 17 S 720 25, 800 16 V24 H0 Z" fill="#a9cdee" />
        </svg>
      </header>

      <div className="flex flex-1 flex-col gap-[3mm] px-[9mm] pb-[3mm] pt-[3mm]">
        {/* สรุปจำนวนสถานี */}
        <div>
          <div className="flex items-center justify-center gap-3 rounded-t-[10px] px-4 py-2 text-white" style={{ background: NAVY }}>
            <svg width="34" height="18" viewBox="0 0 34 18" aria-hidden="true"><path d="M1 5c5-4 9 4 16 0s11-4 16 0M1 12c5-4 9 4 16 0s11-4 16 0" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" /></svg>
            <p className="text-[18px] font-semibold">
              {summaryParts.map((part, index) => (
                <span key={part.label}>
                  {index ? <span className="mx-2 opacity-70">•</span> : null}
                  {part.label} <span className="text-[22px] font-bold leading-none text-[#9fd3ff]">{part.value}</span> สถานี
                </span>
              ))}
            </p>
          </div>
          <p className="rounded-b-[10px] px-4 py-1 text-center text-[14.5px] font-semibold" style={{ background: "#d6e8f7", color: NAVY }}>{report.headline}</p>
        </div>

        {/* 1 ตาราง */}
        <section className="rounded-[10px] border" style={{ borderColor: "#c9dcee" }}>
          <SectionHead number="1" title={`ระดับน้ำสถานีเฝ้าระวัง ${report.rows.length} สถานี`} aside={<>หน่วย: เมตร<br />ต่ำกว่าตลิ่ง = ระดับตลิ่ง − ระดับน้ำ</>} />
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr style={{ background: "#e3eff9", color: NAVY }}>
                <th className="px-2 py-1 text-left font-semibold">รหัส</th>
                <th className="px-2 py-1 text-left font-semibold">สถานี</th>
                <th className="px-2 py-1 text-right font-semibold">ระดับน้ำ</th>
                <th className="px-2 py-1 text-right font-semibold">ตลิ่ง</th>
                <th className="px-2 py-1 text-right font-semibold">ต่ำกว่าตลิ่ง</th>
                <th className="px-2 py-1 text-right font-semibold">{compare}</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row, index) => {
                const meta = BANK_LEVELS.find((item) => item.key === row.status);
                const diffColor = row.direction === "up" ? UP : row.direction === "down" ? DOWN : STEADY;
                return (
                  <tr key={row.code} style={{ background: index % 2 ? "#f7fbfe" : "#ffffff", borderTop: "1px solid #e3edf6" }}>
                    <td className="px-2 py-[3.5px] font-medium">{row.code}</td>
                    <td className="px-2 py-[3.5px] leading-snug">{row.name}</td>
                    <td className="px-2 py-[3.5px] text-right tabular-nums">{row.malfunction ? <span className="text-slate-500">ไม่มีข้อมูล</span> : formatLevel(row.level)}</td>
                    <td className="px-2 py-[3.5px] text-right tabular-nums">{formatLevel(row.bank)}</td>
                    <td className="px-2 py-[3.5px] text-right tabular-nums">
                      <span className="inline-flex items-center gap-1.5">
                        {meta ? <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: meta.color }} title={meta.label} /> : null}
                        {row.belowBank === null ? "–" : row.belowBank < 0 ? `ล้น ${Math.abs(row.belowBank).toFixed(2)}` : row.belowBank.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-2 py-[3.5px] text-right tabular-nums">
                      <span className="inline-flex items-center justify-end gap-1.5 font-semibold" style={{ color: diffColor }}>
                        <Arrow direction={row.direction} />
                        {row.diff === null ? "" : Math.abs(row.diff).toFixed(2)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-3 py-1 text-[10.5px] text-slate-600" style={{ borderColor: "#e3edf6" }}>
            {[...BANK_LEVELS].reverse().map((item) => (
              <span key={item.key} className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: item.color }} />
                {item.label} {item.key === "normal" ? "≥ 2 ม." : item.key === "watch" ? "1–2 ม." : item.key === "near" ? "< 1 ม." : "สูงกว่าตลิ่ง"}
              </span>
            ))}
          </div>
        </section>

        {/* 2 แนวโน้ม */}
        <section className="rounded-[10px] border" style={{ borderColor: "#c9dcee" }}>
          <SectionHead number="2" title={`สรุปแนวโน้ม${report.comparedWithBaseline ? `เทียบเวลา ${report.compareLabel}` : "เทียบชั่วโมงก่อนหน้า"}`} />
          <div className="grid grid-cols-3 gap-2 p-2">
            <TrendCard tone="up" title="เพิ่มขึ้น" rows={rise} />
            <TrendCard tone="down" title="ลดลงมากที่สุด" rows={drop} />
            <TrendCard tone="down" title="รองลงมา" rows={next} />
          </div>
        </section>

        {/* 3 ประเด็นเฝ้าระวัง */}
        <section className="rounded-[10px] border" style={{ borderColor: "#c9dcee" }}>
          <SectionHead number="3" title="ประเด็นเฝ้าระวัง" />
          <ul className="space-y-0.5 px-5 py-2 text-[13.5px]">
            {report.watch.map((item) => (
              <li key={item} className="flex gap-2.5"><span className="mt-[7px] inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: BRAND }} />{item}</li>
            ))}
            {data.declared?.areas?.length ? (
              <li className="flex gap-2.5"><span className="mt-[7px] inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: BRAND }} />
                <span>พื้นที่ที่ EOC ประกาศ: {data.declared.areas.map((item) => `${item.area} ${item.title}`).join(" · ")}</span>
              </li>
            ) : null}
          </ul>
        </section>

        {/* 4 ข้อเสนอ */}
        <section className="rounded-[10px] border" style={{ borderColor: "#c9dcee" }}>
          <SectionHead number="4" title="ข้อเสนอเพื่อการเตรียมพร้อม" />
          <ul className="space-y-0.5 px-5 py-2 text-[13.5px]">
            {recommendations.map((item, index) => (
              <li key={`${index}-${item}`} className="flex gap-2.5"><span className="mt-[7px] inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: BRAND }} />{item}</li>
            ))}
          </ul>
        </section>

        <p className="mt-auto text-[10px] text-slate-500">
          ที่มา: {data.source} ({data.source_url.replace(/^https:\/\//, "")}) · ดึงข้อมูล {new Date(data.fetched_at).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })} น.
          {data.from_database ? " · ปภ. ไม่ตอบ ใช้ค่าล่าสุดที่ระบบเก็บไว้" : data.stale ? " · ต้นทางไม่ตอบ ใช้ข้อมูลล่าสุดที่มี" : ""}
        </p>
      </div>

      <footer className="relative px-[12mm] pb-[4mm] pt-5 text-center text-[10.5px] leading-[1.4]" style={{ background: "linear-gradient(0deg, #dbeaf8 0%, #f6fafe 100%)", color: NAVY }}>
        <svg className="absolute inset-x-0 top-0 h-5 w-full" viewBox="0 0 800 20" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 8 C 120 18, 220 0, 340 9 S 560 18, 680 7 S 780 4, 800 8 V0 H0 Z" fill="#ffffff" />
        </svg>
        {DEFAULT_FOOTER.map((line) => <p key={line} className={line === DEFAULT_FOOTER[0] ? "font-semibold" : ""}>{line}</p>)}
      </footer>
    </article>
  );
}

export default function WaterReport() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [compare, setCompare] = useState("");
  const [custom, setCustom] = useState(null);
  const [flagChoice, setFlagChoice] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [scale, setScale] = useState(1);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [compact, setCompact] = useState(false);
  const [layout, setLayout] = useState("full");
  const [early, setEarly] = useState("");
  const [extras, setExtras] = useState(null);
  const [extrasError, setExtrasError] = useState("");
  const [configOpen, setConfigOpen] = useState(false);
  const frameRef = useRef(null);
  const sheetRef = useRef(null);

  useEffect(() => { setCustom(readSaved()); setLayout(readLayout()); }, []);

  const changeLayout = (value) => {
    setLayout(value);
    try { window.localStorage.setItem(LAYOUT_KEY, value); } catch { /* ไม่มีที่เก็บก็ไม่เป็นไร */ }
  };

  // หัวข้อ 2–4 (ThaiWater ฝน พยากรณ์) โหลดแยก ตารางหลักขึ้นได้ก่อน
  const loadExtras = useCallback(async (refresh = false) => {
    setExtrasError("");
    try {
      const json = await apiRequest(`/stn-eoc/api/eoc/water-report/extras/${refresh ? "?refresh=1" : ""}`);
      setExtras(json);
    } catch (err) {
      setExtrasError(err.message || "โหลดข้อมูลลุ่มน้ำและฝนไม่สำเร็จ");
    }
  }, []);

  useEffect(() => { loadExtras(false); }, [loadExtras]);

  const saveConfig = async (value) => {
    await apiRequest("/stn-eoc/api/eoc/water-report/config/", { method: "PUT", body: { config: value } });
    setConfigOpen(false);
    await loadExtras(false);
  };

  const load = useCallback(async (nextCompare = compare, refresh = false, nextEarly = early) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (nextCompare) params.set("compare", nextCompare);
      if (nextEarly) params.set("early", nextEarly);
      if (refresh) params.set("refresh", "1");
      const json = await apiRequest(`/stn-eoc/api/eoc/water-report/?${params.toString()}`);
      setData(json);
      setCompare(nextCompare);
      setEarly(nextEarly);
    } catch (err) {
      setError(err.message || "โหลดรายงานไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [compare, early]);

  useEffect(() => { load(""); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ย่อแผ่น A4 ให้พอดีจอ (มือถือ/จอแคบ) — ตอนพิมพ์และตอนบันทึกรูปใช้ขนาดจริง
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    const update = () => {
      setScale(Math.min(1, frame.clientWidth / SHEET_WIDTH_PX));
      const height = sheetRef.current?.offsetHeight || 0;
      setSheetHeight(height);
      // เนื้อหายาวเกิน A4 (สถานีมาก/ประเด็นเยอะ) → ใช้ตัวอักษรและระยะห่างแบบกระชับ ให้ยังพิมพ์ได้ 1 หน้า
      if (height > A4_HEIGHT_PX + 1) setCompact(true);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    if (sheetRef.current) observer.observe(sheetRef.current);
    return () => observer.disconnect();
  }, [data]);

  const suggested = data?.report.suggestedFlag || null;
  const declaredFlag = data?.declared?.flag || null;
  const shownFlagKey = flagChoice || declaredFlag || suggested?.key || "green";
  const shownFlag = flagMeta(shownFlagKey);
  const flagSource = flagChoice ? "" : declaredFlag ? "ตามประกาศ EOC" : "ประเมินจากระดับน้ำ";
  const recommendations = custom || (data ? flagRecommendations(shownFlagKey) : []);
  const contentKey = `${layout}|${data?.fetched_at || ""}|${extras?.fetched_at || ""}|${recommendations.join("|")}|${data?.report.rows.length || 0}`;
  const reportConfig = extras?.config || normalizeReportConfig(null);
  useEffect(() => { setCompact(false); }, [contentKey]);

  const startEdit = () => {
    setDraft(recommendations.join("\n"));
    setEditing(true);
  };
  const saveEdit = () => {
    const lines = draft.split("\n").map((line) => line.trim()).filter(Boolean);
    setCustom(lines.length ? lines : null);
    writeSaved(lines.length ? lines : null);
    setEditing(false);
  };
  const resetEdit = () => {
    setCustom(null);
    writeSaved(null);
    setEditing(false);
  };

  const fileStem = data ? `รายงานระดับน้ำ-${data.report.dataHour.slice(0, 13).replace(/[- :]/g, "")}00` : "รายงานระดับน้ำ";

  const saveImage = async () => {
    if (!sheetRef.current) return;
    setSaving(true);
    // html2canvas วัดตำแหน่งเส้นฐานตัวอักษรจากเอกสารหลัก แต่ Tailwind ตั้ง img เป็น display:block ทำให้วัดผิด
    // ข้อความในภาพเลื่อนลงต่ำกว่ากล่อง → ระหว่างบันทึกภาพให้ img เป็น inline-block ชั่วคราว
    const baselineFix = document.createElement("style");
    baselineFix.textContent = "img { display: inline-block !important; }";
    document.head.appendChild(baselineFix);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(sheetRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        onclone: (doc) => {
          const node = doc.querySelector("[data-sheet-scale]");
          if (node) node.style.transform = "none";
          inlineRgbColors(doc);
        }
      });
      const link = document.createElement("a");
      link.download = `${fileStem}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      notify.error(`บันทึกรูปไม่สำเร็จ: ${err.message}`);
    } finally {
      baselineFix.remove();
      setSaving(false);
    }
  };

  const printPdf = () => {
    const previous = document.title;
    document.title = fileStem; // ชื่อไฟล์ตั้งต้นตอนบันทึกเป็น PDF
    window.print();
    setTimeout(() => { document.title = previous; }, 1000);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 print:m-0 print:max-w-none print:space-y-0">
      <style>{`.water-sheet[data-compact] h1 { font-size: 22px !important; } .water-sheet[data-compact] td { padding-top: 1.5px !important; padding-bottom: 1.5px !important; font-size: 11.5px; } .water-sheet[data-compact] th { padding-top: 2px !important; padding-bottom: 2px !important; } .water-sheet[data-compact] ul { font-size: 12.5px !important; padding-top: 5px !important; padding-bottom: 5px !important; } .water-sheet[data-compact] h2 { font-size: 16px !important; } .water-sheet[data-compact] footer { padding-top: 14px !important; } @media print { @page { size: A4 portrait; margin: 0; } html, body { background: #fff !important; } .water-sheet { box-shadow: none !important; } [data-sheet-scale] { transform: none !important; } [data-sheet-frame] { height: auto !important; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}</style>

      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-[#083865]">รายงานระดับน้ำสถานีเฝ้าระวัง</h1>
          <p className="text-sm text-slate-600">สถานี STN ของ ปภ. จังหวัดสตูล สรุปเป็นแผ่น A4 พร้อมส่งต่อ ระบบเก็บค่าทุกชั่วโมงไว้เทียบย้อนหลัง</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            รูปแบบ
            <select value={layout} onChange={(event) => changeLayout(event.target.value)} className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm">
              <option value="full">ประเมินความเสี่ยง 4 หัวข้อ</option>
              <option value="summary">สรุปธงและข้อเสนอ</option>
            </select>
          </label>
          {layout === "full" ? (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              คอลัมน์แรก
              <select
                value={early}
                onChange={(event) => load(compare, false, event.target.value)}
                className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm"
                disabled={loading || !data?.hours?.length}
              >
                <option value="">อัตโนมัติ (6 ชม.ก่อนเวลาที่เทียบ)</option>
                {(data?.hours || []).map((item) => (
                  <option key={item.hour} value={item.hour}>{hourOptionLabel(item.hour, data.report.dataHour)}</option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="flex items-center gap-2 text-sm text-slate-700">
            เทียบกับ
            <select
              value={compare}
              onChange={(event) => { setCompare(event.target.value); load(event.target.value); }}
              className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm"
              disabled={loading}
            >
              <option value="">อัตโนมัติ (4 ชม.ก่อน)</option>
              <option value="prev">ชั่วโมงก่อนหน้า (จากต้นทาง)</option>
              {(data?.hours || []).map((item) => (
                <option key={item.hour} value={item.hour}>{hourOptionLabel(item.hour, data.report.dataHour)}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            ธง
            <select value={flagChoice} onChange={(event) => setFlagChoice(event.target.value)} className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm" disabled={!data}>
              <option value="">{declaredFlag ? `ตามประกาศ EOC (${flagMeta(declaredFlag)?.label})` : `ตามที่ระบบเสนอ (${suggested ? suggested.label : "-"})`}</option>
              {FLOOD_FLAGS.map((flag) => <option key={flag.key} value={flag.key}>{flag.label} {flag.meaning}</option>)}
            </select>
          </label>
          <Button variant="secondary" onClick={() => { load(compare, true); loadExtras(true); }} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />ดึงข้อมูลล่าสุด</Button>
          {layout === "full"
            ? <Button variant="secondary" onClick={() => setConfigOpen(true)}><Settings2 className="h-4 w-4" />ตั้งค่ารายงาน</Button>
            : <Button variant="secondary" onClick={startEdit} disabled={!data}><Pencil className="h-4 w-4" />แก้ข้อเสนอ</Button>}
          <Button variant="secondary" onClick={saveImage} disabled={!data || saving}><ImageDown className="h-4 w-4" />{saving ? "กำลังบันทึก…" : "บันทึกเป็นรูป"}</Button>
          <Button onClick={printPdf} disabled={!data}><FileDown className="h-4 w-4" />บันทึก PDF</Button>
        </div>
      </div>

      {data && !data.report.comparedWithBaseline && compare !== "prev" ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 print:hidden">
          {data.history_ready
            ? "ยังไม่มีค่าที่เก็บไว้ ณ เวลาที่เลือก รายงานนี้จึงเทียบกับชั่วโมงก่อนหน้าตามต้นทางแทน ระบบเริ่มเก็บค่าทุกชั่วโมงแล้ว รอบถัดไปจะเลือกเวลาเทียบได้"
            : "ยังไม่ได้สร้างตารางเก็บค่ารายชั่วโมง (รัน npm run db:migrate) รายงานนี้เทียบกับชั่วโมงก่อนหน้าตามต้นทางแทน"}
        </p>
      ) : null}

      {data && suggested ? (
        <p className="text-sm text-slate-600 print:hidden">
          ระบบเสนอ <b style={{ color: suggested.text }}>{suggested.label} {suggested.meaning}</b> เพราะ{suggested.reason}
          {declaredFlag ? <> · EOC ประกาศไว้ <b style={{ color: flagMeta(declaredFlag).text }}>{flagMeta(declaredFlag).label}</b></> : <> · ยังไม่มีการประกาศธง <a href="/stn-eoc/eoc/flood/triggers/" className="font-semibold text-[#0b4c86] underline">ไปหน้าประกาศธง/Trigger</a></>}
          {layout === "summary" ? " · ข้อเสนอในข้อ 4 เปลี่ยนตามธงอัตโนมัติ (ตามการดำเนินการ Trigger 1 ของ SAT)" : null}
        </p>
      ) : null}

      {configOpen ? (
        <ReportConfigEditor config={reportConfig} stations={extras?.basin_stations || []} onSave={saveConfig} onCancel={() => setConfigOpen(false)} />
      ) : null}

      {layout === "full" && extrasError ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 print:hidden">หัวข้อ 2–3: {extrasError}</p> : null}

      {editing ? (
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 print:hidden">
          <label htmlFor="water-recommendations" className="text-sm font-semibold text-[#083865]">ข้อเสนอเพื่อการเตรียมพร้อม (บรรทัดละ 1 ข้อ)</label>
          <textarea id="water-recommendations" value={draft} onChange={(event) => setDraft(event.target.value)} rows={5} className="w-full rounded-lg border border-slate-300 p-2 text-base" />
          <div className="flex flex-wrap gap-2">
            <Button onClick={saveEdit}>ใช้ข้อเสนอนี้</Button>
            <Button variant="secondary" onClick={resetEdit}>กลับไปใช้ข้อเสนอที่ระบบแนะนำ</Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>ยกเลิก</Button>
          </div>
          <p className="text-xs text-slate-500">ข้อเสนอที่แก้จะจำไว้ในเบราว์เซอร์นี้ ใช้กับรายงานรอบถัดไปด้วย จนกว่าจะกดกลับไปใช้ข้อเสนอที่ระบบแนะนำ</p>
        </div>
      ) : null}

      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 print:hidden">{error}</p> : null}

      {!data && loading ? <p className="py-16 text-center text-slate-500">กำลังดึงข้อมูลระดับน้ำจาก ปภ.…</p> : null}

      {data ? (
        <div ref={frameRef} data-sheet-frame className="w-full overflow-hidden print:overflow-visible" style={{ height: sheetHeight ? sheetHeight * scale : undefined }}>
          <div data-sheet-scale style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: SHEET_WIDTH_PX }}>
            <div ref={sheetRef} className="shadow-[0_2px_18px_rgba(8,56,101,0.12)] print:shadow-none">
              {layout === "full"
                ? <FullReportSheet data={data} extras={extras} config={reportConfig} flag={shownFlag} flagSource={flagSource} compact={compact} />
                : <ReportSheet data={data} recommendations={recommendations} flag={shownFlag} flagSource={flagSource} compact={compact} />}
            </div>
          </div>
        </div>
      ) : null}
      {data ? <p className="text-center text-xs text-slate-500 print:hidden"><Download className="mr-1 inline h-3.5 w-3.5" />บันทึก PDF: ในหน้าต่างพิมพ์ เลือก “บันทึกเป็น PDF” ขนาด A4 และเปิด “กราฟิกพื้นหลัง”</p> : null}
    </div>
  );
}
