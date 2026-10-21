/** @jest-environment node */
jest.mock("@/lib/db", () => ({ query: jest.fn(), getPool: jest.fn() }));
jest.mock("@/lib/webPush", () => ({
  vapidConfig: () => ({ publicKey: "k", privateKey: "p", subject: "mailto:eoc@stn.go.th" }),
  sendWebPush: jest.fn(async () => ({ ok: true, status: 201 }))
}));
import { query } from "@/lib/db";
import { sendWebPush } from "@/lib/webPush";
import { broadcast } from "@/lib/publicPushServer";

test("ส่งถึงเจ้าหน้าที่เท่านั้น: เลือกเฉพาะเครื่อง audience = officer และไม่ขึ้นประวัติประชาชน", async () => {
  query.mockImplementation(async (sql, params) => {
    if (sql.startsWith("SELECT id, endpoint")) return params?.[0] === "officer"
      ? [{ id: 1, endpoint: "https://fcm.googleapis.com/fcm/send/o1", p256dh: "a", auth_secret: "b", scope: "all", districts: "[]", tambons: "[]" }]
      : [];
    return {};
  });
  const stats = await broadcast({ title: "[ทดสอบ] ประชุมด่วน", body: "[ทดสอบ] เข้าห้อง EOC", url: "/stn-eoc/", level: "high", audience: "officers" });
  expect(stats).toMatchObject({ recipients: 1, delivered: 1 });
  const select = query.mock.calls.find(([sql]) => sql.startsWith("SELECT id, endpoint"));
  expect(select[0]).toContain("audience = ?");
  const log = query.mock.calls.find(([sql]) => sql.includes("INSERT INTO public_push_log"));
  expect(log[1][6]).toBe(JSON.stringify({ audience: "officer" }));
  expect(sendWebPush).toHaveBeenCalledTimes(1);
});
