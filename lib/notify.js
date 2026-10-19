// แจ้งผลการทำงาน (เพิ่ม/แก้ไข/ลบ/บันทึก/ผิดพลาด) — ใช้ที่เดียวทั้งระบบ: toast มุมขวาบน (components/providers/AppToaster)
// ข้อความเดียวกันที่ยิงซ้ำในเวลาใกล้กัน (เช่น ทั้ง dialog และหน้าแจ้ง error เดียวกัน) จะแสดงใบเดียว
import { toast } from "sonner";

const DURATION = { success: 3500, info: 4500, warning: 5500, error: 7000 };

function show(type, message, options = {}) {
  const text = String(message ?? "").trim();
  if (!text) return null;
  const fn = type === "info" ? toast.info : toast[type] || toast;
  return fn(text, { id: `${type}:${text}`, duration: DURATION[type], ...options });
}

export const notify = {
  success: (message, options) => show("success", message, options),
  error: (message, options) => show("error", message, options),
  warning: (message, options) => show("warning", message, options),
  info: (message, options) => show("info", message, options)
};

export default notify;
