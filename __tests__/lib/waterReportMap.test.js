import { isWaterReport, latestEvidenceAt, timeAgoText, travelText, waterReportStyle } from "@/lib/waterReportMap";
import { toPublicIncident } from "@/lib/incidentPublishing";

const NOW = Date.parse("2026-10-07T14:00:00+07:00");
const report = (over = {}) => ({
  id: 1,
  report_type: "problem_point",
  problem_category: "flood",
  water_level: "knee_waist",
  travel_status: "impassable",
  occurred_at: "2026-10-07T12:00:00+07:00",
  confirmations: { still: 0, still_at: null, normal: 0, normal_at: null },
  ...over
});

describe("waterReportMap", () => {
  test("เฉพาะจุดปัญหาที่มีรหัสระดับน้ำ", () => {
    expect(isWaterReport(report())).toBe(true);
    expect(isWaterReport(report({ water_level: "45" }))).toBe(false);
    expect(isWaterReport(report({ report_type: "traffic_report" }))).toBe(false);
  });

  test("จางลงตามอายุ: ≤12 ชม. / 12–24 / เกิน 24", () => {
    expect(waterReportStyle(report(), NOW).fillOpacity).toBe(0.9);
    expect(waterReportStyle(report({ occurred_at: "2026-10-06T22:00:00+07:00" }), NOW).fillOpacity).toBe(0.55);
    expect(waterReportStyle(report({ occurred_at: "2026-10-06T08:00:00+07:00" }), NOW).fillOpacity).toBe(0.3);
  });

  test("ยืนยันว่ายังท่วมทำให้จุดกลับมาสด", () => {
    const old = report({ occurred_at: "2026-10-06T08:00:00+07:00", confirmations: { still: 2, still_at: "2026-10-07T13:00:00+07:00", normal: 0 } });
    expect(latestEvidenceAt(old)).toBe(Date.parse("2026-10-07T13:00:00+07:00"));
    expect(waterReportStyle(old, NOW).fillOpacity).toBe(0.9);
  });

  test("ขอบประเมื่อคนแจ้งน้ำลดไม่น้อยกว่าคนยืนยันว่ายังท่วม", () => {
    expect(waterReportStyle(report({ confirmations: { still: 1, normal: 2 } }), NOW)).toMatchObject({ receding: true, dashArray: "4 3" });
    expect(waterReportStyle(report({ confirmations: { still: 3, normal: 1 } }), NOW).receding).toBe(false);
    expect(waterReportStyle(report(), NOW).receding).toBe(false);
  });

  test("ข้อความเวลาและการสัญจร", () => {
    expect(timeAgoText("2026-10-07T13:20:00+07:00", NOW)).toBe("40 นาทีก่อน");
    expect(timeAgoText("2026-10-06T12:30:00+07:00", NOW)).toBe("1 วัน 1 ชม.ก่อน");
    expect(timeAgoText("2026-10-07T10:51:00+07:00", NOW)).toBe("3 ชม. 9 น.ก่อน");
    expect(travelText(report())).toBe("เรือเท่านั้น");
  });

  test("ข้อมูลสาธารณะมีจำนวนยืนยัน ไม่มีข้อมูลผู้แจ้ง", () => {
    const pub = toPublicIncident({ ...report(), first_name: "ก", phone: "0812345678", still_reports: 4, still_reported_at: "2026-10-07 10:42:00", normal_reports: 0, latitude: 6.6, longitude: 100.06 });
    expect(pub.confirmations).toMatchObject({ still: 4, normal: 0, still_at: "2026-10-07 10:42:00" });
    expect(JSON.stringify(pub)).not.toContain("0812345678");
  });
});
