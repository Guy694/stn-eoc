// แจ้งเซิร์ฟเวอร์ว่ามีการเปิดดูสื่อ (riskcom / อินโฟกราฟิก) — ไม่รอผล ไม่แจ้งข้อผิดพลาด
// เปิดชิ้นเดิมซ้ำในแท็บเดียวกันไม่ส่งซ้ำ (เซิร์ฟเวอร์กันซ้ำต่อ IP อีกชั้น)
const sent = new Set();

export function reportContentView(kind, id, title = "") {
  if (typeof window === "undefined" || !kind || id === undefined || id === null) return;
  const key = `${kind}:${id}`;
  if (sent.has(key)) return;
  sent.add(key);
  fetch("/stn-eoc/api/public/content-view/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({ kind, id: String(id), title: String(title || "").slice(0, 200) })
  }).catch(() => {});
}
