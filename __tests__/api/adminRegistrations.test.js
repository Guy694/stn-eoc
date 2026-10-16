/**
 * @jest-environment node
 */
const mockExecute = jest.fn();
jest.mock("@/lib/db", () => ({ getPool: () => ({ getConnection: async () => ({ execute: (...args) => mockExecute(...args), release: jest.fn() }) }) }));
jest.mock("@/lib/auth", () => ({ requireAuth: async () => ({ success: true, user: { id: 1, username: "admin" } }) }));
jest.mock("@/lib/recordArchive", () => ({ recordChange: jest.fn() }));

const request = (method = "GET", body) => {
  const { NextRequest } = require("next/server");
  return new NextRequest("http://localhost/stn-eoc/api/admin/registrations?limit=50", { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
};

describe("/api/admin/registrations", () => {
  beforeEach(() => jest.clearAllMocks());

  it("ปิดคำขอของคนที่อนุมัติแล้วก่อน และนับคิวจากบัญชีที่ยังไม่อนุมัติ", async () => {
    mockExecute.mockImplementation(async (sql) => {
      if (sql.includes("INFORMATION_SCHEMA")) return [[{ count: 1 }]];
      if (sql.trim().startsWith("UPDATE registration_requests rr")) return [{ affectedRows: 1 }];
      return [[
        { id: 5, username: "a", thaiid_verified: 1, request_status: "verified", agency: "สสจ.สตูล" },
        { id: 6, username: "b", thaiid_verified: 0, request_status: null, department: "รพ.ละงู" },
        { id: 7, username: "c", thaiid_verified: 1, request_status: "rejected" }
      ]];
    });
    const { GET } = require("@/app/api/admin/registrations/route");
    const body = await (await GET(request())).json();
    const sync = mockExecute.mock.calls.find(([sql]) => sql.trim().startsWith("UPDATE registration_requests rr"));
    expect(sync[0]).toMatch(/o\.is_approved = 1 AND rr\.status IN \('pending', 'verified'\)/);
    expect(mockExecute.mock.calls.some(([sql]) => /WHERE COALESCE\(o\.is_approved, 0\) <> 1/.test(sql))).toBe(true);
    expect(body.stats).toEqual({ waiting: 2, verified: 1, unverified: 1, rejected: 1, actionable: 2 });
    expect(body.data[1]).toMatchObject({ agency: "รพ.ละงู", thaiid_verified: false, rejected: false });
  });

  it("ปฏิเสธต้องมีเหตุผล และไม่ให้ปฏิเสธบัญชีที่อนุมัติแล้ว", async () => {
    const { PATCH } = require("@/app/api/admin/registrations/route");
    expect((await PATCH(request("PATCH", { officer_id: 5, action: "reject", reason: "สั้น" }))).status).toBe(400);
    mockExecute.mockImplementation(async (sql) => (sql.includes("FROM officer") ? [[{ id: 5, username: "a", is_approved: 1 }]] : [[]]));
    expect((await PATCH(request("PATCH", { officer_id: 5, action: "reject", reason: "ลงทะเบียนซ้ำ" }))).status).toBe(409);
  });

  it("ปฏิเสธคำขอ: เปลี่ยนสถานะคำขอล่าสุดเป็น rejected", async () => {
    mockExecute.mockImplementation(async (sql) => {
      if (sql.includes("FROM officer")) return [[{ id: 5, username: "a", is_approved: 0 }]];
      if (sql.includes("INFORMATION_SCHEMA")) return [[{ count: 1 }]];
      if (sql.startsWith("SELECT id FROM registration_requests")) return [[{ id: 99 }]];
      return [{ affectedRows: 1 }];
    });
    const { PATCH } = require("@/app/api/admin/registrations/route");
    const response = await PATCH(request("PATCH", { officer_id: 5, action: "reject", reason: "ลงทะเบียนซ้ำ" }));
    expect(response.status).toBe(200);
    expect(mockExecute.mock.calls.some(([sql, params]) => sql.startsWith("UPDATE registration_requests SET status") && params[0] === "rejected" && params[1] === 99)).toBe(true);
  });
});
