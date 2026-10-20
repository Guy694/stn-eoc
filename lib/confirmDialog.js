// หน้าต่างยืนยันกลางของระบบ (แทน SweetAlert) — เรียกจากที่ไหนก็ได้ ได้ Promise<boolean>
// ConfirmHost (components/providers/ConfirmHost.jsx) ซึ่งติดตั้งใน app/layout เป็นตัวแสดงผล
let host = null;
const queue = [];

/** ConfirmHost เรียกเพื่อรับคำขอ — คืนฟังก์ชันยกเลิกการลงทะเบียน */
export function registerConfirmHost(show) {
  host = show;
  while (queue.length) show(queue.shift());
  return () => {
    if (host === show) host = null;
  };
}

export function hasConfirmHost() {
  return Boolean(host);
}

/**
 * ขอให้ผู้ใช้ยืนยัน
 * @param {{ title?: string, message?: string, confirmText?: string, cancelText?: string, tone?: "danger" | "primary" }} options
 * @returns {Promise<boolean>}
 */
export function requestConfirm(options = {}) {
  return new Promise((resolve) => {
    const request = { ...options, resolve };
    if (host) host(request);
    else queue.push(request);
  });
}
