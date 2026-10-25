export const RISK_LEVELS = ["normal", "watch", "high", "critical"];

// ชื่อระดับความเสี่ยงน้ำท่วม: ใช้คำที่ไม่ทำให้ตื่นตระหนก (เดิม "เสี่ยงสูง" / "วิกฤต") — ประชาชนเคยอ่านคำว่า "วิกฤต" แล้วเข้าใจว่าต้องอพยพทันที
export const RISK_META = {
  normal: { label: "ปกติ", color: "#16a34a", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  watch: { label: "เฝ้าระวัง", color: "#eab308", bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
  high: { label: "เสี่ยง", color: "#f97316", bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  critical: { label: "เสี่ยงสูง", color: "#dc2626", bg: "bg-red-50", text: "text-red-700", border: "border-red-200" }
};
