import {
  detectSecurityAnomalies, formatSecurityAlert, formatWeeklySecurityReport, isoWeekKey,
  securityMonitorConfig, weeklyReportDue, cooldownFor
} from "@/lib/securityMonitor";
import { officerChangeActions } from "@/lib/securityAudit";
import { visitorLogDays } from "@/lib/pdpaRetention.mjs";

const config = securityMonitorConfig({});

describe("detectSecurityAnomalies", () => {
  test("ไม่มีอะไรผิดปกติ → ไม่แจ้ง", () => {
    expect(detectSecurityAnomalies({ total: 40, baselinePerWindow: 30, topIps: [], staffForeign: [], failedLogins: { total: 2, ips: 1 } }, config)).toEqual([]);
  });

  test("ผู้เข้าชมพุ่งเกินเกณฑ์และเกินค่าเฉลี่ย 5 เท่า", () => {
    const [alert] = detectSecurityAnomalies({ total: 600, baselinePerWindow: 50 }, config);
    expect(alert).toMatchObject({ kind: "traffic_spike", key: "traffic_spike" });
    expect(alert.lines.join(" ")).toMatch(/600 ครั้งใน 10 นาที/);
  });

  test("ยอดสูงแต่ปกติก็สูงอยู่แล้ว (ช่วงเกิดภัย) → ไม่แจ้งพุ่ง", () => {
    expect(detectSecurityAnomalies({ total: 600, baselinePerWindow: 200 }, config)).toEqual([]);
  });

  test("IP เดียวเข้าถี่ แจ้ง · เครือข่ายภายในไม่แจ้ง", () => {
    const alerts = detectSecurityAnomalies({ total: 10, topIps: [
      { ip: "203.0.113.9", visits: 400, network: "public", staff: 0 },
      { ip: "10.0.0.5", visits: 900, network: "private" }
    ] }, config);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ kind: "ip_flood", key: "ip_flood:203.0.113.9" });
  });

  test("บัญชีเจ้าหน้าที่ถูกใช้จากต่างประเทศ (ไทยไม่แจ้ง)", () => {
    const alerts = detectSecurityAnomalies({ staffForeign: [
      { username: "[ทดสอบ]officer", ip: "198.51.100.7", country: "NL", city: "Amsterdam" },
      { username: "[ทดสอบ]local", ip: "203.0.113.1", country: "TH" }
    ] }, config);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].key).toBe("staff_foreign:[ทดสอบ]officer:NL");
    expect(cooldownFor("staff_foreign_access", config)).toBe(1440);
  });

  test("รหัสผิดจำนวนมากพร้อมกันหลาย IP", () => {
    const [alert] = detectSecurityAnomalies({ failedLogins: { total: 35, ips: 12 } }, config);
    expect(alert.kind).toBe("failed_login_burst");
  });

  test("ข้อความแจ้งเตือนกัน HTML", () => {
    const text = formatSecurityAlert({ title: "t", lines: ["<x>"] }, (v) => String(v).replace(/</g, "&lt;"));
    expect(text).toContain("&lt;x>");
  });

  test("ปรับเกณฑ์จาก .env ได้", () => {
    const custom = securityMonitorConfig({ SECURITY_IP_MAX_VISITS: "20", SECURITY_MONITOR: "off", SECURITY_WEEKLY_DAY: "5", SECURITY_WEEKLY_HOUR: "17" });
    expect(custom).toMatchObject({ ipMaxVisits: 20, enabled: false, weeklyDay: 5, weeklyHour: 17 });
  });
});

describe("สรุปรายสัปดาห์", () => {
  // จันทร์ 26 ต.ค. 2569 (2026) เวลาไทย
  const mon0700 = new Date("2026-10-26T00:00:00Z");
  const mon0800 = new Date("2026-10-26T01:00:00Z");
  const wed = new Date("2026-10-28T05:00:00Z");
  const sun = new Date("2026-11-01T10:00:00Z");

  test("ถึงกำหนดตั้งแต่จันทร์ 08:00 และส่งครั้งเดียวต่อสัปดาห์", () => {
    expect(weeklyReportDue(mon0700, null, config).due).toBe(false);
    const due = weeklyReportDue(mon0800, null, config);
    expect(due.due).toBe(true);
    expect(weeklyReportDue(wed, due.key, config).due).toBe(false);
    expect(weeklyReportDue(wed, "2026-W43", config).due).toBe(true); // เซิร์ฟเวอร์ปิดช่วงจันทร์ ส่งย้อนได้
    expect(isoWeekKey(sun)).toBe(due.key);
  });

  test("ข้อความสรุปมีหัวข้อหลักและสิ่งที่ควรทำ", () => {
    const text = formatWeeklySecurityReport({
      logins: { success: 120, failed: 60, failedIps: 4 },
      topFailedIps: [{ ip: "203.0.113.9", count: 40 }],
      lockEvents: 2, suspiciousEvents: 1,
      accounts: { admins: 3, pending: 1, locked: 0, suspended: 1, inactive: 7, inactiveSample: ["[ทดสอบ]a", "[ทดสอบ]b"] },
      auditCount: 1, auditRecent: [{ action: "role_change", actor_username: "[ทดสอบ]admin", target_username: "[ทดสอบ]x", detail: "staff → admin" }],
      visitors: { visits: 1200, ips: 300, staff: 200, foreign: 5, previousVisits: 1000, peakDay: "จ. 26 ต.ค.", peakVisits: 400 },
      alerts: { ip_flood: 2 }
    }, { periodLabel: "19 – 26 ต.ค. 2569" });
    expect(text).toMatch(/สรุปความปลอดภัยรายสัปดาห์/);
    expect(text).toMatch(/สำเร็จ 120 ครั้ง · ผิด 60 ครั้ง จาก 4 IP/);
    expect(text).toMatch(/ไม่ได้เข้าใช้เกิน 90 วัน 7 บัญชี: \[ทดสอบ\]a, \[ทดสอบ\]b …/);
    expect(text).toMatch(/เปลี่ยนสิทธิ์ \[ทดสอบ\]x \(staff → admin\) โดย \[ทดสอบ\]admin/);
    expect(text).toMatch(/\+20% จากสัปดาห์ก่อน/);
    expect(text).toMatch(/IP เข้าถี่ 2/);
    expect(text).toMatch(/ควรทำ:/);
  });

  test("สัปดาห์ที่ไม่มีข้อมูลก็สรุปได้", () => {
    expect(formatWeeklySecurityReport({})).toMatch(/ไม่มีบัญชีที่ไม่ได้ใช้เกิน 90 วัน/);
  });
});

test("เหตุการณ์จากการแก้ไขบัญชี", () => {
  expect(officerChangeActions({ role: "staff", is_approved: 0 }, { role: "admin", is_approved: 1, password: "x" }).map((a) => a.action))
    .toEqual(["role_change", "approval_granted", "password_reset"]);
  expect(officerChangeActions({ role: "staff", is_approved: 1 }, { role: "staff", is_approved: 0 }).map((a) => a.action)).toEqual(["approval_revoked"]);
  expect(officerChangeActions({ role: "staff", is_approved: 1 }, { given_name: "x" })).toEqual([]);
});

test("งานลบอัตโนมัติเก็บประวัติผู้เข้าชม 365 วันเป็นค่าเริ่มต้น", () => {
  expect(visitorLogDays({})).toBe(365);
});
