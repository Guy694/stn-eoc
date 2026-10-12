// ประเภทศูนย์พักพิง ความพร้อม และการแนะนำศูนย์ที่เหมาะกับกลุ่มเปราะบางแต่ละประเภท (ไม่แตะฐานข้อมูล ทดสอบได้)
// ทุกศูนย์เริ่มเป็น "ศูนย์ทั่วไป" ไม่มีความพร้อมพิเศษ — การแนะนำจึงเรียงตามระยะทาง/ที่ว่างไปก่อน
// เมื่อหน่วยงานกำหนด Medical shelter และติ๊กความพร้อมแล้ว ระบบจะดันศูนย์ที่เหมาะขึ้นก่อนเอง

export const SHELTER_TYPES = [
  { key: "general", label: "ศูนย์พักพิงทั่วไป", short: "ทั่วไป", color: "#0b4c86" },
  { key: "vulnerable", label: "ศูนย์สำหรับกลุ่มเปราะบาง", short: "เปราะบาง", color: "#7c3aed" },
  { key: "medical", label: "ศูนย์พักพิงทางการแพทย์ (Medical shelter)", short: "Medical", color: "#dc2626" },
  { key: "field_hospital", label: "โรงพยาบาลสนาม", short: "รพ.สนาม", color: "#be123c" },
  { key: "temporary", label: "จุดพักชั่วคราว", short: "ชั่วคราว", color: "#64748b" }
];

export const SHELTER_CAPABILITIES = [
  { key: "health_staff", label: "เจ้าหน้าที่สาธารณสุขประจำ" },
  { key: "medical_beds", label: "เตียงผู้ป่วย" },
  { key: "oxygen", label: "ออกซิเจน" },
  { key: "power_backup", label: "ไฟสำรอง/เครื่องปั่นไฟ" },
  { key: "wheelchair", label: "ทางลาดและห้องน้ำรถเข็น" },
  { key: "cold_storage", label: "ตู้เย็นเก็บยา/อินซูลิน" },
  { key: "dialysis_transport", label: "รถรับส่งไปฟอกไต" },
  { key: "clean_room", label: "ห้องสะอาด (เปลี่ยนน้ำยา CAPD)" },
  { key: "isolation", label: "ห้องแยกโรค" },
  { key: "quiet_area", label: "พื้นที่แยกสงบ" },
  { key: "mother_child", label: "มุมแม่และเด็ก" }
];

// ศูนย์ที่เหมาะกับแต่ละกลุ่ม: ประเภทศูนย์ (เรียงจากเหมาะที่สุด) + ความพร้อมที่ควรมี
export const NEEDS_BY_TYPE = {
  bedridden: { types: ["medical", "field_hospital", "vulnerable"], caps: ["medical_beds", "power_backup", "health_staff"] },
  dialysis_hd: { types: ["medical", "field_hospital"], caps: ["dialysis_transport", "health_staff"] },
  dialysis_pd: { types: ["medical", "vulnerable"], caps: ["clean_room", "power_backup"] },
  disabled: { types: ["vulnerable", "medical", "general"], caps: ["wheelchair"] },
  elderly: { types: ["vulnerable", "general", "medical"], caps: ["wheelchair", "health_staff"] },
  pregnant: { types: ["vulnerable", "medical", "general"], caps: ["mother_child", "health_staff"] },
  children: { types: ["vulnerable", "general"], caps: ["mother_child"] },
  chronic_illness: { types: ["vulnerable", "medical", "general"], caps: ["cold_storage", "health_staff"] },
  psychiatric: { types: ["vulnerable", "medical", "general"], caps: ["quiet_area", "health_staff"] }
};

// ความต้องการที่เขียนไว้ในช่อง "ความต้องการ/อาการ" ของรายบุคคล
const NEED_KEYWORDS = [
  { pattern: /ออกซิเจน|oxygen|o2/i, cap: "oxygen" },
  { pattern: /เครื่องช่วยหายใจ|ไฟฟ้า|ดูดเสมหะ/i, cap: "power_backup" },
  { pattern: /รถเข็น|wheelchair|วีลแชร์/i, cap: "wheelchair" },
  { pattern: /อินซูลิน|insulin/i, cap: "cold_storage" }
];

export const shelterTypeMeta = (key) => SHELTER_TYPES.find((item) => item.key === key) || SHELTER_TYPES[0];
export const capabilityLabel = (key) => SHELTER_CAPABILITIES.find((item) => item.key === key)?.label || key;

/** "oxygen,wheelchair" | ["oxygen"] → ["oxygen","wheelchair"] (เฉพาะค่าที่รู้จัก) */
export function parseCapabilities(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(",");
  const known = new Set(SHELTER_CAPABILITIES.map((item) => item.key));
  return [...new Set(list.map((item) => String(item).trim()).filter((item) => known.has(item)))];
}

export function normalizeShelterType(value) {
  return SHELTER_TYPES.some((item) => item.key === value) ? value : "general";
}

/** ความต้องการของบุคคล = ตามประเภท + คำในช่องความต้องการ */
export function needsOf(person = {}) {
  const base = NEEDS_BY_TYPE[person.vulnerable_type] || { types: ["general"], caps: [] };
  const caps = new Set(base.caps);
  for (const keyword of NEED_KEYWORDS) if (keyword.pattern.test(String(person.needs || ""))) caps.add(keyword.cap);
  return { types: base.types, caps: [...caps] };
}

/** ระยะทางตรง (กม.) */
export function distanceKm(a, b) {
  if (!a || !b || !Number.isFinite(Number(a.lat)) || !Number.isFinite(Number(b.lat))) return null;
  const toRad = (value) => (Number(value) * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad((b.lng ?? b.lon) - (a.lng ?? a.lon));
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) * 10) / 10;
}

/**
 * แนะนำศูนย์สำหรับบุคคลหนึ่งคน
 * shelters: [{ id, name, lat, lon, shelter_type, capabilities, capacity, occupancy, active }]
 * คืนรายการที่เรียงแล้ว: ศูนย์ที่เปิดและยังว่างก่อน → เหมาะกับกลุ่มนี้มากกว่า → ใกล้กว่า
 */
export function suggestShelters(person, shelters = [], { limit = 5, includeInactive = false } = {}) {
  const need = needsOf(person);
  const home = person?.location ? { lat: person.location.lat, lng: person.location.lng } : null;
  const items = shelters
    .filter((shelter) => includeInactive || Number(shelter.active) === 1)
    .map((shelter) => {
      const type = normalizeShelterType(shelter.shelter_type);
      const caps = parseCapabilities(shelter.capabilities);
      const typeIndex = need.types.indexOf(type);
      const typeScore = type === "temporary" ? -1 : typeIndex === -1 ? 0 : need.types.length - typeIndex;
      const matched = need.caps.filter((cap) => caps.includes(cap));
      const missing = need.caps.filter((cap) => !caps.includes(cap));
      const capacity = Number(shelter.capacity) || 0;
      const occupancy = Number(shelter.occupancy) || 0;
      const free = capacity ? capacity - occupancy : null;
      const distance = home && shelter.lat != null ? distanceKm(home, { lat: Number(shelter.lat), lng: Number(shelter.lon ?? shelter.lng) }) : null;
      const score = typeScore * 2 + matched.length;
      return {
        ...shelter,
        shelter_type: type,
        capabilities: caps,
        free,
        full: free !== null && free <= 0,
        distance,
        score,
        suitable: typeScore > 0 || matched.length > 0,
        matched,
        missing
      };
    })
    .sort((a, b) =>
      Number(a.full) - Number(b.full)
      || b.score - a.score
      || (a.distance ?? 1e9) - (b.distance ?? 1e9)
      || (b.free ?? 0) - (a.free ?? 0));
  return items.slice(0, limit);
}

/** ข้อความสั้นอธิบายว่าทำไมแนะนำ */
export function suggestionReason(item) {
  const parts = [];
  if (item.shelter_type !== "general") parts.push(shelterTypeMeta(item.shelter_type).short);
  if (item.matched?.length) parts.push(`มี${item.matched.map(capabilityLabel).join(", ")}`);
  if (item.distance !== null && item.distance !== undefined) parts.push(`ห่าง ${item.distance} กม.`);
  if (item.free !== null && item.free !== undefined) parts.push(item.full ? "เต็มแล้ว" : `ว่าง ${item.free} ที่`);
  return parts.join(" · ");
}
