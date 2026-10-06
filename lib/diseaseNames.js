// ชื่อโรคมาตรฐาน: ใช้ตอน "บันทึก" ทุกช่องทาง (ฟอร์มศูนย์พักพิง ชุมชน หน่วยบริการ และการเพิ่มชื่อโรคใหม่)
// หลักการ: รวมเฉพาะชื่อที่เป็น "โรคเดียวกัน" เท่านั้น เช่น โรคฉี่หนู = เลปโตสไปโรซิส
// ไม่รวมโรคที่ต่างกันจริง (ไข้หวัด ≠ ไข้หวัดใหญ่, โรคผิวหนัง ≠ น้ำกัดเท้า) — การจัดกลุ่มเพื่อดูภาพรวมทำตอนแสดงผลใน healthDashboard
// ไม่แตะฐานข้อมูล ทดสอบได้

export const DISEASE_SYNONYMS = [
  { name: "โรคฉี่หนู (เลปโตสไปโรซิส)", patterns: [/ฉี่หนู/, /เลปโตสไปโร(ซิส|ซีส|สิส)/, /leptospir/i] },
  { name: "อุจจาระร่วง", patterns: [/^อุจจาระร่วง/, /^(โรค)?ท้องเสีย/, /^(โรค)?ท้องร่วง/, /diarrh/i] },
  { name: "ไข้เลือดออก", patterns: [/ไข้เลือดออก/, /dengue|dhf/i] },
  { name: "ตาแดง", patterns: [/^(โรค)?ตาแดง/, /เยื่อบุตาอักเสบ/, /conjunctivitis/i] },
  { name: "ไข้หวัดใหญ่", patterns: [/ไข้หวัดใหญ่/, /influenza/i] },
  { name: "โควิด-19", patterns: [/โควิด/, /covid/i] },
  { name: "มือเท้าปาก", patterns: [/มือ\s*เท้า\s*ปาก/, /hfmd|hand.?foot.?mouth/i] },
  { name: "น้ำกัดเท้า", patterns: [/^(โรค)?น้ำกัดเท้า$/] },
  { name: "ไข้หวัด", patterns: [/^(โรค)?ไข้หวัด$/, /^common cold$/i] }
];

/** ชื่อโรคที่ใช้เป็นตัวเลือกในฟอร์มของ EOC อุทกภัย (เรียงตามที่พบบ่อยหลังน้ำท่วม) */
export const FLOOD_DISEASE_CHOICES = [
  "อุจจาระร่วง",
  "โรคฉี่หนู (เลปโตสไปโรซิส)",
  "น้ำกัดเท้า",
  "โรคผิวหนัง",
  "ตาแดง",
  "ไข้หวัด",
  "ไข้หวัดใหญ่",
  "ไข้เลือดออก",
  "บาดแผล"
];

/**
 * ปรับชื่อโรคเป็นชื่อมาตรฐานก่อนบันทึก
 * - ตัดช่องว่างเกิน
 * - ชื่อที่รวมหลายโรคด้วย "/" (หมวดรวมเดิม เช่น "ไข้หวัด/ไข้หวัดใหญ่") คงไว้ตามเดิม เพราะแยกไม่ได้ว่าเป็นโรคไหน
 */
export function normalizeDiseaseName(name) {
  const text = String(name ?? "").replace(/\s+/g, " ").trim();
  if (!text || text.includes("/")) return text;
  const hit = DISEASE_SYNONYMS.find((entry) => entry.patterns.some((pattern) => pattern.test(text)));
  return hit ? hit.name : text;
}

/** สองชื่อหมายถึงโรคเดียวกันหรือไม่ (ใช้กันการเพิ่มชื่อโรคซ้ำในรายการหลัก) */
export function sameDisease(a, b) {
  const left = normalizeDiseaseName(a);
  const right = normalizeDiseaseName(b);
  return Boolean(left) && left === right;
}

/** รวมรายการชื่อโรคจากรายการหลัก ให้เหลือชื่อมาตรฐานไม่ซ้ำ (คงลำดับเดิม) */
export function uniqueDiseaseNames(names) {
  const seen = new Set();
  const out = [];
  for (const raw of names || []) {
    const name = normalizeDiseaseName(typeof raw === "string" ? raw : raw?.name);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

export const OTHER_DISEASE = "อื่นๆ";

/**
 * ตัวเลือกชื่อโรคในฟอร์ม: โรคที่ให้ขึ้นก่อน + รายการหลัก (ชื่อมาตรฐาน ไม่ซ้ำ) + "อื่นๆ" ท้ายสุด
 * @param {Array<string|{name:string}>} masterRows ผลจาก /api/common/diseases
 * @param {string[]} priority
 */
export function buildDiseaseChoices(masterRows = [], priority = []) {
  const names = uniqueDiseaseNames([...priority, ...(masterRows || [])]).filter((name) => name !== OTHER_DISEASE);
  return [...names, OTHER_DISEASE];
}

/**
 * แผนรวมชื่อซ้ำในรายการหลัก (common_diseases): แต่ละโรคเหลือแถวเดียวชื่อมาตรฐาน ที่เหลือปิดใช้งาน
 * @param {Array<{id:number,name:string,is_active:number|boolean}>} rows
 * @returns {Array<{ canonical, keep, others }>} เฉพาะกลุ่มที่ต้องเปลี่ยน
 */
export function planMasterListCleanup(rows = []) {
  const groups = new Map();
  for (const row of rows) {
    const key = normalizeDiseaseName(row.name);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const changes = [];
  for (const [canonical, members] of groups) {
    if (members.length === 1 && members[0].name === canonical) continue;
    const keep = members.find((row) => row.name === canonical) || members.find((row) => Number(row.is_active)) || members[0];
    changes.push({ canonical, keep, others: members.filter((row) => row.id !== keep.id) });
  }
  return changes;
}
