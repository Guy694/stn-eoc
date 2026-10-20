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
