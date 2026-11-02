// ระดับรังสี UV และความร้อน (อุณหภูมิที่รู้สึก) สำหรับการ์ดหน้าแรก — ใช้คำแนะนำด้านสุขภาพ
//
// UV: เกณฑ์ดัชนี UV สากล (WHO) — ข้อมูล uv_index_max จาก Open-Meteo (GFS ของ NOAA เพราะ ECMWF IFS ไม่มีค่า UV)
//     ยังไม่ได้เทียบกับเครื่องวัดจริง จึงแสดงเป็นระดับ
// ความร้อน: ระดับเฝ้าระวังโรคลมแดดตามดัชนีความร้อน (Heat Index) ของกรมควบคุมโรค / กรมอุตุนิยมวิทยา

export const UV_LEVELS = [
  { key: "low", max: 2, label: "ต่ำ", color: "#22c55e", text: "#14532d" },
  { key: "moderate", max: 5, label: "ปานกลาง", color: "#eab308", text: "#713f12" },
  { key: "high", max: 7, label: "สูง", color: "#f97316", text: "#7c2d12" },
  { key: "very_high", max: 10, label: "สูงมาก", color: "#ef4444", text: "#7f1d1d", advice: "แดดแรง เลี่ยงกลางแจ้ง 10–15 น. ทาครีมกันแดด สวมหมวก" },
  { key: "extreme", max: Infinity, label: "อันตราย", color: "#8b5cf6", text: "#4c1d95", advice: "แดดแรงมาก งดอยู่กลางแจ้งช่วงเที่ยง ผิวไหม้ได้ในไม่กี่นาที" }
];

export function uvLevel(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return UV_LEVELS.find((level) => number <= level.max) || UV_LEVELS.at(-1);
}

export const HEAT_LEVELS = [
  { key: "normal", max: 26.9, label: "ปกติ", color: "#e2e8f0", text: "#334155" },
  { key: "watch", max: 32.9, label: "เฝ้าระวัง", color: "#fde68a", text: "#713f12" },
  { key: "caution", max: 41.9, label: "เตือนภัย", color: "#fdba74", text: "#7c2d12", advice: "ดื่มน้ำบ่อย ๆ พักในที่ร่ม" },
  { key: "danger", max: 54, label: "อันตราย", color: "#f87171", text: "#7f1d1d", advice: "เสี่ยงโรคลมแดด งดออกแรงกลางแจ้ง" },
  { key: "extreme", max: Infinity, label: "อันตรายมาก", color: "#b91c1c", text: "#ffffff", advice: "อันตรายถึงชีวิต อยู่ในที่ร่มเย็น มีอาการผิดปกติโทร 1669" }
];

export function heatLevel(feelsLike) {
  if (feelsLike === null || feelsLike === undefined || feelsLike === "") return null;
  const number = Number(feelsLike);
  if (!Number.isFinite(number)) return null;
  return HEAT_LEVELS.find((level) => number <= level.max) || HEAT_LEVELS.at(-1);
}
