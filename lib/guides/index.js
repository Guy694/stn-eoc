import { citizenGuide } from "./citizen";
import { officerGuide } from "./officer";
import { adminGuide } from "./admin";

export const GUIDES = { citizen: citizenGuide, officer: officerGuide, admin: adminGuide };
export { citizenGuide, officerGuide, adminGuide };

/** ข้อความทั้งหมดของหัวข้อ (ใช้ค้นหา) */
export function sectionText(section) {
  const parts = [section.title, section.summary || ""];
  for (const block of section.blocks || []) {
    parts.push(block.title || "", block.text || "", block.q || "", block.a || "");
    for (const item of block.items || []) parts.push(item);
    for (const row of block.rows || []) parts.push(row.join(" "));
  }
  return parts.join(" ").toLowerCase();
}

/** กรองหัวข้อตามคำค้น (ทุกคำต้องพบ) */
export function filterSections(sections = [], query = "") {
  const words = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return sections;
  return sections.filter((section) => {
    const text = sectionText(section);
    return words.every((word) => text.includes(word));
  });
}
