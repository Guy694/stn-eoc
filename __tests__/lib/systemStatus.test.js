import { buildRoleMatrix, healthChecks, integrationStatus, maskId, pendingMigrations } from "@/lib/systemStatus";

describe("systemStatus", () => {
  it("บอกว่าตั้งค่าครบหรือยัง โดยไม่ส่งค่า secret ออกไป", () => {
    const status = integrationStatus({ TELEGRAM_BOT_TOKEN: "123:tok-zz9q", TELEGRAM_HELP_NOTIFY_CHAT_IDS: "-1001234567", GEMINI_API_KEY: " " });
    const byKey = Object.fromEntries(status.map((item) => [item.key, item]));
    expect(byKey.telegram.configured).toBe(true);
    expect(byKey["telegram-security"].missing).toEqual(["TELEGRAM_SECURITY_CHAT_IDS"]);
    expect(byKey.gemini.configured).toBe(false);
    expect(byKey["open-meteo"].configured).toBe(true);
    expect(JSON.stringify(status)).not.toContain("tok-zz9q");
    expect(JSON.stringify(status)).not.toContain("1001234567");
  });

  it("ปิดบังรหัสกลุ่ม", () => {
    expect(maskId("-1001234567890")).toBe("-100…7890");
    expect(maskId("")).toBe("");
  });

  it("ตารางสิทธิ์อ่านจาก rolePermissions", () => {
    const rows = buildRoleMatrix({
      admin: { eoc: { view: true, create: true, edit: true, delete: true }, admin: { view: true, edit: true }, reports: { view: true, export: true }, users: { view: true, edit: true } },
      staff: { eoc: { view: true, create: true }, admin: { view: false }, reports: { view: true }, users: {} },
      citizen: { dashboard: true }
    }, { admin: "ผู้ดูแลระบบ" });
    expect(rows.map((row) => row.role)).toEqual(["admin", "staff"]);
    expect(rows[0]).toMatchObject({ name: "ผู้ดูแลระบบ", admin: "จัดการ", reports: "ดู + ส่งออก" });
    expect(rows[1]).toMatchObject({ eoc: { view: true, create: true, edit: false, delete: false }, admin: "-", reports: "ดูได้" });
  });

  it("migration ค้างและสรุปสุขภาพระบบ", () => {
    expect(pendingMigrations(["a.sql", "b.sql", "c.sql"], ["a.sql"])).toEqual(["b.sql", "c.sql"]);
    const checks = healthChecks({
      db: { ok: true, tables: 80, sizeMb: 120, timezoneOk: true },
      migrations: { pending: ["b.sql"], total: 3 },
      integrations: [{ key: "telegram", configured: true }],
      alerts: { sendingEnabled: false },
      backups: { files: [] }
    });
    expect(checks.map((check) => [check.key, check.tone])).toEqual([["db", "ok"], ["migrations", "bad"], ["alerts", "warn"], ["backup", "warn"]]);
  });
});

describe("visitorStatsToCsv", () => {
  const { visitorStatsToCsv } = require("@/lib/systemStatus");
  it("มี BOM และ escape เครื่องหมายจุลภาค/อัญประกาศ", () => {
    const csv = visitorStatsToCsv({ totalVisits: 10, dailyVisits: [{ date: "2026-10-06", visits: 3 }], topPages: [{ path: '/a,"b"', visits: 2 }], helpRequests: { opened: 1, submitted: 1, sources: [] } });
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("รายวัน,2026-10-06,3");
    expect(csv).toContain('หน้าที่เข้าชม,"/a,""b""",2');
  });
});
