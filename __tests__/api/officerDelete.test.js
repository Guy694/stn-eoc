/**
 * @jest-environment node
 */
const mockQuery = jest.fn();
const mockExecute = jest.fn();
jest.mock("@/lib/db", () => ({ query: (...args) => mockQuery(...args), transaction: async (fn) => fn((...args) => mockExecute(...args)) }));
jest.mock("@/lib/auth", () => ({ requireAuth: async () => ({ success: true, user: { id: 1, username: "admin" } }), revokeUserSessions: jest.fn() }));
jest.mock("@/lib/recordArchive", () => ({ recordChange: jest.fn() }));

const req = (method, body) => {
  const { NextRequest } = require("next/server");
  return new NextRequest("http://localhost/stn-eoc/api/admin/officers/331/", { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
};
const params = (id = "331") => ({ params: Promise.resolve({ id }) });

describe("DELETE /api/admin/officers/[id]", () => {
  beforeEach(() => { jest.clearAllMocks(); mockExecute.mockResolvedValue({ affectedRows: 1 }); });

  it("มีประวัติการทำงาน → 409 HAS_HISTORY ไม่ลบ", async () => {
    mockQuery.mockImplementation(async (sql) => (sql.startsWith("SELECT id, username") ? [{ id: 331, username: "u" }] : sql.includes("eoc_team_reports") ? [{ n: 3 }] : [{ n: 0 }]));
    const { DELETE } = require("@/app/api/admin/officers/[id]/route");
    const response = await DELETE(req("DELETE"), params());
    const body = await response.json();
    expect(response.status).toBe(409);
    expect(body.code).toBe("HAS_HISTORY");
    expect(body.error).toMatch(/รายงานทีม 3 รายการ/);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("ไม่มีประวัติ → ถอดออกจากทีมแล้วลบ", async () => {
    mockQuery.mockImplementation(async (sql) => (sql.startsWith("SELECT id, username") ? [{ id: 331, username: "u" }] : [{ n: 0 }]));
    const { DELETE } = require("@/app/api/admin/officers/[id]/route");
    const response = await DELETE(req("DELETE"), params());
    expect(response.status).toBe(200);
    const sqls = mockExecute.mock.calls.map(([sql]) => sql);
    expect(sqls[sqls.length - 1]).toBe("DELETE FROM officer WHERE id = ?");
    expect(sqls.some((sql) => sql.startsWith("DELETE FROM eoc_team_members"))).toBe(true);
  });

  it("ตารางอื่นยังอ้างถึง → แปลง error เป็น 409 ไม่ใช่ 500", async () => {
    mockQuery.mockImplementation(async (sql) => (sql.startsWith("SELECT id, username") ? [{ id: 331, username: "u" }] : [{ n: 0 }]));
    mockExecute.mockImplementation(async (sql) => { if (sql.startsWith("DELETE FROM officer")) { const error = new Error("fk"); error.code = "ER_ROW_IS_REFERENCED_2"; throw error; } return { affectedRows: 1 }; });
    const { DELETE } = require("@/app/api/admin/officers/[id]/route");
    expect((await DELETE(req("DELETE"), params())).status).toBe(409);
  });

  it("ลบบัญชีตัวเองไม่ได้", async () => {
    const { DELETE } = require("@/app/api/admin/officers/[id]/route");
    expect((await DELETE(req("DELETE"), params("1"))).status).toBe(400);
  });

  it("ระงับ = ล็อกไม่มีกำหนดและตัด session · เปิดใช้งาน = ปลดล็อก", async () => {
    mockQuery.mockImplementation(async (sql) => (sql.startsWith("SELECT id, username") ? [{ id: 331, username: "u" }] : { affectedRows: 1 }));
    const { PATCH } = require("@/app/api/admin/officers/[id]/route");
    const { revokeUserSessions } = require("@/lib/auth");
    expect((await PATCH(req("PATCH", { action: "suspend" }), params())).status).toBe(200);
    expect(mockQuery.mock.calls.some(([sql, p]) => sql.startsWith("UPDATE officer SET account_locked_until = ?") && p[0].startsWith("9999"))).toBe(true);
    expect(revokeUserSessions).toHaveBeenCalledWith("331");
    expect((await PATCH(req("PATCH", { action: "reactivate" }), params())).status).toBe(200);
    expect(mockQuery.mock.calls.some(([sql]) => sql.startsWith("UPDATE officer SET account_locked_until = NULL"))).toBe(true);
  });
});
