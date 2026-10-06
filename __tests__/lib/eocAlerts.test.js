import { detectAlerts, formatAlertMessage } from "@/lib/eocAlerts";

describe("eocAlerts", () => {
  it("detects critical events with stable keys", () => {
    const alerts = detectAlerts({
      health: { totals: { deaths: 2 }, actions: [{ level: "serious", title: "อ.ละงู ผู้ป่วยเพิ่มขึ้น 80%", detail: "x" }, { level: "warning", title: "ตาแดง", detail: "" }] },
      shelters: { attention: [{ id: 5, name: "รร.ก", district: "ละงู", reasons: [{ text: "เต็ม/เกินความจุ" }, { text: "มีผู้ป่วยอาการรุนแรง" }] }, { id: 6, name: "วัด", reasons: [{ text: "ใกล้เต็ม" }] }] },
      supplies: { critical: [{ id: 9, level: "out", item_name: "ORS", agency_name: "รพ." }, { id: 10, level: "low", item_name: "พารา" }] },
      it: { openTickets: [{ id: 3, severity: "critical", ticket_no: "IT3-001", title: "เน็ตล่ม", unit_name: "สสจ." }, { id: 4, severity: "high" }] }
    }, { eventLabel: "อุทกภัย ครั้งที่ 3" });
    expect(alerts.map((alert) => alert.key)).toEqual(["deaths:2", "health-district:อ.ละงู", "shelter-full:5", "shelter-severe:5", "stock-out:9", "it-critical:3"]);
  });

  it("formats a Telegram message", () => {
    const text = formatAlertMessage({ eventLabel: "อุทกภัย", alerts: [{ text: "a<b" }], escape: (value) => value.replace("<", "&lt;"), link: "http://x" });
    expect(text).toContain("<b>แจ้งเตือนอัตโนมัติ อุทกภัย</b>");
    expect(text).toContain("• a&lt;b");
    expect(text).toContain("ดูสรุป: http://x");
  });

  it("returns nothing when all is calm", () => {
    expect(detectAlerts({})).toEqual([]);
  });
});
