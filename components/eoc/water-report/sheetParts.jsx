// ชิ้นส่วนที่ใช้ร่วมกันของแผ่นรายงานระดับน้ำ (แบบสรุปธงและแบบ 4 หัวข้อ)
export const NAVY = "#083865";
export const BRAND = "#0b4c86";
export const UP = "#c62828";
export const DOWN = "#1d64b8";
export const STEADY = "#64748b";
export const DEFAULT_FOOTER = [
  "ออกโดยกลุ่มภารกิจตระหนักรู้สถานการณ์ (Situation Awareness Team)",
  "ศูนย์บัญชาการเหตุการณ์ภาวะอุทกภัยทางสาธารณสุข",
  "สำหรับทุกโรคและภัยสุขภาพ (Emergency Operation Center : EOC)",
  "สำนักงานสาธารณสุขจังหวัดสตูล"
];

export function Arrow({ direction, size = 14 }) {
  if (direction === "up") {
    return <svg width={size} height={size} viewBox="0 0 16 16" aria-label="เพิ่มขึ้น"><path d="M8 1.5 14 8H10v6.5H6V8H2z" fill={UP} /></svg>;
  }
  if (direction === "down") {
    return <svg width={size} height={size} viewBox="0 0 16 16" aria-label="ลดลง"><path d="M8 14.5 2 8h4V1.5h4V8h4z" fill={DOWN} /></svg>;
  }
  if (direction === "steady") {
    return <svg width={size} height={size} viewBox="0 0 16 16" aria-label="คงที่"><path d="M2 5h12v2.2H2zM2 8.8h12V11H2z" fill={STEADY} /></svg>;
  }
  return <span aria-label="ไม่มีข้อมูล" style={{ color: STEADY }}>–</span>;
}

// ธงตามเกณฑ์ทีม SAT: เขียว เฝ้าระวัง · เหลือง เตรียมพร้อมเคลื่อนย้าย · แดง เคลื่อนย้าย
export function StatusFlag({ level, source, compact = false }) {
  return (
    <div className={`flex flex-col ${compact ? "items-center" : "items-end"}`} aria-label={`${level.label} ${level.meaning}`}>
      <svg width={compact ? 40 : 74} height={compact ? 42 : 78} viewBox="0 0 74 86" aria-hidden="true" className={compact ? "" : "mr-3"}>
        <rect x="6" y="2" width="4" height="84" rx="2" fill="#1f2937" />
        <circle cx="8" cy="3.5" r="3.5" fill="#1f2937" />
        <path d="M10 8 C 26 2, 40 14, 56 8 S 70 6, 72 9 L 72 44 C 66 41, 58 42, 52 45 C 38 51, 24 40, 10 46 Z" fill={level.color} />
        <path d="M10 8 C 26 2, 40 14, 56 8 S 70 6, 72 9 L 72 16 C 60 13, 52 20, 38 17 C 26 14, 18 12, 10 16 Z" fill="#ffffff" opacity="0.18" />
      </svg>
      <span data-pill className={`mt-0.5 whitespace-nowrap rounded-full px-2 font-semibold leading-[1.7] text-white ${compact ? "text-[10px]" : "text-[11px]"}`} style={{ background: level.color }}>
        {level.label} · {level.meaning}
      </span>
      {source ? <span className="mt-0.5 whitespace-nowrap rounded bg-white/80 px-1 text-[9px] leading-[1.5] text-slate-600">{source}</span> : null}
    </div>
  );
}

export function SectionHead({ number, title, aside }) {
  return (
    <div className="flex items-center gap-3 rounded-t-[10px] px-4 py-1.5" style={{ background: BRAND }}>
      <svg width="28" height="28" viewBox="0 0 28 28" className="shrink-0" aria-hidden="true">
        <circle cx="14" cy="14" r="14" fill="#ffffff" />
        <text x="14" y="19.5" textAnchor="middle" fontSize="16" fontWeight="700" fill={BRAND} fontFamily="Kanit, system-ui, sans-serif">{number}</text>
      </svg>
      <h2 className="text-[18px] font-semibold leading-tight text-white">{title}</h2>
      {aside ? <span className="ml-auto text-right text-[10.5px] leading-tight text-white/85">{aside}</span> : null}
    </div>
  );
}

