// ประกอบชุดข้อมูลออฟไลน์ (ไม่มีการเรียกเครือข่าย ทดสอบได้) — เลือกเฉพาะฟิลด์สาธารณะ
export const BASE_HOTLINES = [
  { name: "เจ็บป่วยฉุกเฉิน", phone: "1669" },
  { name: "สาธารณภัย (ปภ.)", phone: "1784" },
  { name: "ตำรวจ", phone: "191" },
  { name: "ดับเพลิง", phone: "199" },
  { name: "ตำรวจท่องเที่ยว", phone: "1155" }
];

const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : null);

export function buildOfflinePack({ hotlines = [], shelters = [], warnings = [], situation = null, sea = null, now = Date.now() } = {}) {
  const phones = new Set();
  const lines = [];
  for (const item of [...BASE_HOTLINES, ...(hotlines || [])]) {
    const phone = String(item?.phone || "").replace(/[^\d-]/g, "");
    if (!phone || phones.has(phone)) continue;
    phones.add(phone);
    lines.push({ name: String(item.name || "").slice(0, 60), phone, note: item.status ? String(item.status).slice(0, 40) : null });
  }
  return {
    version: 1,
    generated_at: new Date(now).toISOString(),
    hotlines: lines.slice(0, 14),
    shelters: (shelters || []).slice(0, 60).map((s) => ({
      name: s.sheltername || s.name || "-",
      district: s.district_name || null,
      tambon: s.tambon || null,
      village: s.village || null,
      lat: num(s.lat),
      lon: num(s.lon),
      phone: s.contact_phone || null,
      vacancy: num(s.vacancy),
      status: s.occupancy_status || null
    })),
    warnings: (warnings || []).filter((w) => w?.message).slice(0, 8).map((w) => ({
      level: w.level === "high" ? "high" : "watch",
      message: String(w.message).slice(0, 300),
      issued_at: w.issued_at || null,
      source: w.source || null
    })),
    events: (situation?.events || []).map((e) => ({ type: e.type || null, label: e.label, opened_at: e.opened_at, open_shelters: e.detail?.open_shelters ?? null })),
    sea: sea?.status ? { label: sea.status.label, key: sea.status.key, next_high: sea.next_highs?.[0] ? { at: sea.next_highs[0].at, level: sea.next_highs[0].est_level ?? sea.next_highs[0].level ?? null } : null } : null
  };
}
