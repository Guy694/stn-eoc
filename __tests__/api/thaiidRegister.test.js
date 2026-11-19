/** @jest-environment node */
const execute = jest.fn();
jest.mock("@/lib/db", () => ({ getPool: () => ({ getConnection: async () => ({ execute, release: () => {} }) }) }));
jest.mock("@/lib/telegram", () => ({ notifySecurityEvent: jest.fn() }));
jest.mock("@/lib/registrationSession", () => ({
  REGISTRATION_SESSION_COOKIE: "reg",
  unsealRegistrationSession: (value) => JSON.parse(value),
  setRegistrationSessionCookie: jest.fn()
}));

import { POST } from "@/app/api/auth/thaiid/register/route";

const request = (session, body) => ({
  cookies: { get: () => ({ value: JSON.stringify(session) }) },
  headers: { get: () => null },
  json: async () => body
});
const body = { position: "นักวิชาการ", department: "สสจ.", requested_role: "staff", phone: "0812345678", email: "a@b.c" };

beforeEach(() => execute.mockReset().mockResolvedValue([{ affectedRows: 1 }]));

describe("POST /api/auth/thaiid/register", () => {
  it("คุกกี้ของประชาชน (id ตาราง citizens) แก้ตาราง officer ไม่ได้", async () => {
    const response = await POST(request({ id: 1, userType: "citizen" }, body));
    expect(response.status).toBe(403);
    expect(execute).not.toHaveBeenCalled();
  });

  it("ขอบทบาท admin ไม่ได้", async () => {
    const response = await POST(request({ id: 7, userType: "officer" }, { ...body, requested_role: "admin" }));
    expect(response.status).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });

  it("เจ้าหน้าที่ที่รออนุมัติ แก้ได้เฉพาะบัญชีที่ยังไม่อนุมัติของตัวเอง", async () => {
    const response = await POST(request({ id: 7, userType: "officer" }, body));
    expect(response.status).toBe(200);
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/is_approved, 0\) = 0/);
    expect(params.at(-1)).toBe(7);
  });
});
