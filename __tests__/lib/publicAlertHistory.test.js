/** @jest-environment node */
jest.mock("@/lib/db", () => ({ query: jest.fn(), getPool: jest.fn() }));
import { query } from "@/lib/db";
import { publicAlertHistory } from "@/lib/publicPushServer";

test("ประวัติแจ้งเตือนประชาชนไม่รวมงานของเจ้าหน้าที่ และลิงก์ต้องอยู่ในระบบ", async () => {
  query.mockResolvedValueOnce([
    { id: 3, kind: "auto", level: "high", title: "เตือนภัยอัตโนมัติ", body: "[ทดสอบ] น้ำล้นตลิ่ง", url: null, target: '{"districts":["ควนโดน"]}', created_at: "2026-10-20" },
    { id: 2, kind: "auto", level: "high", title: "คำขอช่วยเหลือใหม่", body: "[ทดสอบ] รายละเอียดผู้ขอ", url: "/stn-eoc/eoc/help", target: '{"audience":"officer"}', created_at: "2026-10-20" },
    { id: 1, kind: "manual", level: "info", title: "[ทดสอบ] เปิดศูนย์พักพิง", body: "x", url: "https://evil.example/", target: null, created_at: "2026-10-20" }
  ]);
  const rows = await publicAlertHistory();
  expect(rows.map((r) => r.id)).toEqual([3, 1]);
  expect(rows[0]).toMatchObject({ title: "⚠️ เตือนภัย จ.สตูล", districts: ["ควนโดน"] });
  expect(rows[1].url).toBeNull();
  expect(query.mock.calls[0][0]).toContain("kind IN ('auto', 'manual')");
});

describe("ลบรายการออกจากประวัติการส่ง", () => {
  beforeEach(() => query.mockReset());

  test("ประวัติไม่แสดงรายการที่ถูกลบ", async () => {
    query.mockResolvedValueOnce([]);
    await publicAlertHistory();
    expect(query.mock.calls[0][0]).toContain("hidden_at IS NULL");
  });

  test("ยังไม่ได้รัน migration: อ่านประวัติได้เหมือนเดิม", async () => {
    query.mockRejectedValueOnce(Object.assign(new Error("Unknown column"), { code: "ER_BAD_FIELD_ERROR" }));
    query.mockResolvedValueOnce([{ id: 9, kind: "manual", level: "info", title: "[ทดสอบ] ข่าว", body: "x", url: null, target: null, created_at: "2026-10-20" }]);
    const rows = await publicAlertHistory();
    expect(rows.map((r) => r.id)).toEqual([9]);
    expect(query.mock.calls[1][0]).not.toContain("hidden_at");
  });

  test("ซ่อนแถวแทนการลบจริง (เก็บ alert_key ไว้กันส่งซ้ำ) และกรองรหัสที่ไม่ถูกต้อง", async () => {
    const { hidePushLog } = await import("@/lib/publicPushServer");
    query.mockResolvedValueOnce([{ id: 4, kind: "test", title: "[ทดสอบ] ทดสอบ" }]);
    query.mockResolvedValueOnce({ affectedRows: 1 });
    const rows = await hidePushLog([4, "4", -1, "x", 7], { id: 12 });
    expect(rows).toHaveLength(1);
    expect(query.mock.calls[0][1]).toEqual([4, 7]);
    expect(query.mock.calls[1][0]).toMatch(/^UPDATE public_push_log SET hidden_at = NOW\(\), hidden_by = \?/);
    expect(query.mock.calls[1][1]).toEqual([12, 4]);
    expect(query.mock.calls.some(([sql]) => /DELETE/.test(sql))).toBe(false);
  });

  test("ไม่มีรหัสที่ใช้ได้: ไม่แตะฐานข้อมูล", async () => {
    const { hidePushLog } = await import("@/lib/publicPushServer");
    expect(await hidePushLog(["x", 0])).toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });
});
