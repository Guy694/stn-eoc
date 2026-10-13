// ใส่ข้อความลงใน HTML ที่สร้างเป็นสตริง (เช่น popup/tooltip ของ Leaflet) อย่างปลอดภัย
const MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };
export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => MAP[ch]);
}
