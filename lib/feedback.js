// แจ้งผลและหน้าต่างยืนยันของทั้งระบบ — ที่เดียว (แทน SweetAlert เดิม)
// - showSuccess/showError/showWarning/showAlert → toast มุมขวาบน (lib/notify → components/providers/AppToaster)
// - showConfirm/showDeleteConfirm/showLogoutConfirm → หน้าต่างยืนยันกลาง (lib/confirmDialog → components/providers/ConfirmHost ซึ่งใช้ AppDialog)
//   ถ้า ConfirmHost ยังไม่ติดตั้ง คำขอจะรอในคิวแล้วแสดงเมื่อพร้อม (ไม่มีหน้าต่างแบบอื่นสำรอง)
import { notify } from "@/lib/notify";
import { requestConfirm } from "@/lib/confirmDialog";

/** @param {string} message @param {"success"|"error"|"warning"|"info"} icon */
export const showAlert = (message, icon = "info") => (notify[icon] || notify.info)(message);
export const showSuccess = (message) => notify.success(message);
export const showError = (message) => notify.error(message);
export const showWarning = (message) => notify.warning(message);

/** @returns {Promise<boolean>} true เมื่อกดยืนยัน */
export const showConfirm = (title, message, confirmText = "ยืนยัน", cancelText = "ยกเลิก") =>
  requestConfirm({ title, message, confirmText, cancelText, tone: "primary" });

/** @returns {Promise<boolean>} */
export const showDeleteConfirm = (message = "คุณต้องการลบข้อมูลนี้ใช่หรือไม่?") =>
  requestConfirm({ title: "ยืนยันการลบ", message, confirmText: "ลบ", tone: "danger" });

/** @returns {Promise<boolean>} */
export const showLogoutConfirm = () =>
  requestConfirm({ title: "ออกจากระบบ", message: "ต้องการออกจากระบบใช่หรือไม่", confirmText: "ออกจากระบบ", tone: "primary" });
