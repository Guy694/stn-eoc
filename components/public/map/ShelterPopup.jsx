"use client";

// popup ศูนย์พักพิงบนแผนที่สาธารณะ: ที่ว่างคงเหลือ ความจุ ที่ตั้ง เบอร์โทร และปุ่มนำทาง
// ใช้ div แทน p เพราะ leaflet ใส่ระยะห่างให้ <p> ใน popup มากจนอ่านยาก
import { MapPin, Navigation, Phone } from "lucide-react";

const NEAR_FULL_RATIO = 0.8;

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

// ตัวเลขผู้พักจากเหตุการณ์ที่เปิดอยู่ก่อน ถ้าไม่มีใช้ยอดล่าสุดจากชีต
export function shelterNumbers(shelter) {
  const capacity = toNumber(shelter?.shelter_capacity);
  const occupancy = toNumber(shelter?.current_occupancy) || toNumber(shelter?.current_occupancy_total);
  const vacancy = Math.max(capacity - occupancy, 0);
  const ratio = capacity ? occupancy / capacity : 0;
  const status = !capacity ? "unknown" : ratio >= 1 ? "full" : ratio >= NEAR_FULL_RATIO ? "near_full" : "available";
  return { capacity, occupancy, vacancy, ratio: Math.min(ratio, 1), status };
}

const STATUS = {
  available: { label: "รับเพิ่มได้", color: "#15803d", bg: "#dcfce7" },
  near_full: { label: "ใกล้เต็ม", color: "#b45309", bg: "#fef3c7" },
  full: { label: "เต็ม", color: "#b91c1c", bg: "#fee2e2" },
  unknown: { label: "ไม่ทราบความจุ", color: "#475569", bg: "#f1f5f9" }
};

// เบอร์อาจกรอกมาหลายเบอร์ในช่องเดียว เช่น "074-711xxx, 081-xxx" → แยกเป็นลิงก์โทรทีละเบอร์
function phoneList(shelter) {
  // ใช้เฉพาะเบอร์ศูนย์ ไม่แสดงเบอร์ส่วนตัวของผู้ประสานงาน
  const raw = String(shelter?.contact_phone || "");
  const seen = new Set();
  return raw
    .split(/[,/;|]|\s{2,}|\sหรือ\s/)
    .map((item) => item.trim())
    .filter((item) => item.replace(/\D/g, "").length >= 9)
    .filter((item) => {
      const digits = item.replace(/\D/g, "");
      if (seen.has(digits)) return false;
      seen.add(digits);
      return true;
    })
    .slice(0, 2);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("th-TH");
}

export default function ShelterPopup({ shelter }) {
  const { capacity, occupancy, vacancy, ratio, status } = shelterNumbers(shelter);
  const meta = STATUS[status];
  const phones = phoneList(shelter);
  const lat = Number.parseFloat(shelter.lat);
  const lon = Number.parseFloat(shelter.lon);
  const area = [shelter.village, shelter.tambon && `ต.${shelter.tambon}`, shelter.district_name && `อ.${shelter.district_name}`].filter(Boolean).join(" ");
  const address = String(shelter.address || "").trim();
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;

  return (
    <div className="w-60 text-slate-700" style={{ fontFamily: "var(--font-kanit)" }}>
      <div className="flex items-start justify-between gap-2">
        <h4 className="m-0 text-[15px] font-bold leading-snug text-slate-900">{shelter.sheltername}</h4>
        <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ color: meta.color, backgroundColor: meta.bg }}>{meta.label}</span>
      </div>

      {capacity ? (
        <div className="mt-2 rounded-lg bg-slate-50 p-2">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[11px] text-slate-500">ที่ว่างคงเหลือ</div>
              <div className="text-xl font-black leading-none" style={{ color: meta.color }}>{formatNumber(vacancy)} <span className="text-xs font-bold">คน</span></div>
            </div>
            <div className="text-right text-[11px] leading-tight text-slate-500">
              <div>ความจุ {formatNumber(capacity)} คน</div>
              <div>พักอยู่ {formatNumber(occupancy)} คน</div>
            </div>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200" role="img" aria-label={`ใช้ไปแล้ว ${Math.round(ratio * 100)}%`}>
            <div className="h-full rounded-full" style={{ width: `${Math.round(ratio * 100)}%`, backgroundColor: meta.color }} />
          </div>
        </div>
      ) : null}

      <div className="mt-2 flex items-start gap-1.5 text-[13px] leading-snug">
        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
        <span>
          {address || area || "-"}
          {address && area && !(shelter.tambon && address.includes(shelter.tambon)) ? <span className="block text-slate-500">{area}</span> : null}
        </span>
      </div>

      {phones.length ? (
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px]">
          <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
          {phones.map((phone) => (
            <a key={phone} href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="font-semibold text-[#0b4c86] hover:underline">{phone}</a>
          ))}
        </div>
      ) : null}

      <div className={`mt-2.5 grid gap-1.5 ${phones.length ? "grid-cols-2" : "grid-cols-1"}`}>
        {Number.isFinite(lat) && Number.isFinite(lon) ? (
          <a href={directions} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 rounded-lg bg-[#0b4c86] px-2 py-1.5 text-xs font-bold text-white! hover:bg-[#083865]">
            <Navigation className="h-3.5 w-3.5" aria-hidden="true" /> นำทาง
          </a>
        ) : null}
        {phones.length ? (
          <a href={`tel:${phones[0].replace(/[^\d+]/g, "")}`} className="flex items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-bold text-slate-800! hover:bg-slate-50">
            <Phone className="h-3.5 w-3.5" aria-hidden="true" /> โทร
          </a>
        ) : null}
      </div>
      {status === "full" ? <div className="mt-1.5 text-[11px] text-red-700">ศูนย์เต็มแล้ว โปรดโทรสอบถามก่อนเดินทาง</div> : null}
    </div>
  );
}
