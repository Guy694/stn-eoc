/**
 * @jest-environment node
 *
 * callback ของ Provider ID: ตรวจ state → Health ID → Provider ID → เข้าสู่ระบบ (เครือข่ายและฐานข้อมูลเป็น mock)
 */
const mockExecute = jest.fn();
const mockCreateSession = jest.fn(async () => ({ token: "SESSION" }));

jest.mock("@/lib/db", () => ({ getPool: () => ({ getConnection: async () => ({ execute: (...args) => mockExecute(...args), release: jest.fn() }) }) }));
jest.mock("@/lib/telegram", () => ({ notifySecurityEvent: jest.fn() }));
jest.mock("@/lib/auth", () => ({
  createUserSession: (...args) => mockCreateSession(...args),
  setSessionCookie: (response, token) => { response.cookies.set("session_token", token); return response; }
}));

function callbackRequest({ state = "S1", cookieState = "S1", code = "CODE" } = {}) {
  const { NextRequest } = require("next/server");
  const url = `http://localhost/stn-eoc/api/auth/provider-id/callback/?code=${code}&state=${state}`;
  return new NextRequest(url, { headers: { cookie: `provider_id_state=${cookieState}` } });
}

const json = (status, body) => ({ status, ok: status < 400, text: async () => JSON.stringify(body) });

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(process.env, {
    SECRET_KEY: "test-secret", HEALTH_ID_CLIENT_ID: "hc", HEALTH_ID_CLIENT_SECRET: "hs", PROVIDER_ID_CLIENT_ID: "pc", PROVIDER_ID_SECRET_KEY: "ps",
    NEXT_PUBLIC_BASE_URL: "https://eoc.example"
  });
  global.fetch = jest.fn(async (url) => {
    if (url.endsWith("/api/v1/token")) return json(200, { data: { access_token: "HT" } });
    if (url.endsWith("/services/token")) return json(200, { data: { access_token: "PT" } });
    return json(200, { data: { account_id: "A1", hash_cid: "h1", provider_id: "P1", firstname_th: "สมชาย", lastname_th: "ใจดี", organization: [] } });
  });
});

describe("GET /api/auth/provider-id/callback", () => {
  it("state ไม่ตรง → กลับหน้า login โดยไม่เรียก Health ID", async () => {
    const { GET } = require("@/app/api/auth/provider-id/callback/route");
    const response = await GET(callbackRequest({ cookieState: "OTHER" }));
    expect(response.headers.get("location")).toMatch(/\/stn-eoc\/login\?error=provider_failed/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("เชื่อมบัญชีแล้ว → สร้าง session แบบ provider_id และไปแดชบอร์ด", async () => {
    mockExecute.mockImplementation(async (sql) => (/FROM officer\s+WHERE \(provider_account_id/s.test(sql) ? [[{ id: 7, username: "u7", role: "staff", is_approved: 1 }]] : [{ affectedRows: 1 }]));
    const { GET } = require("@/app/api/auth/provider-id/callback/route");
    const response = await GET(callbackRequest());
    expect(response.headers.get("location")).toBe("https://eoc.example/stn-eoc/dashboard");
    expect(mockCreateSession.mock.calls[0][1]).toMatchObject({ officer: { id: 7 }, loginMethod: "provider_id" });
    expect(response.cookies.get("session_token")?.value).toBe("SESSION");
  });

  it("ยังไม่เชื่อมบัญชี → บอกวิธีเชื่อม ไม่สร้าง session", async () => {
    mockExecute.mockImplementation(async () => [[]]);
    const { GET } = require("@/app/api/auth/provider-id/callback/route");
    const response = await GET(callbackRequest());
    expect(decodeURIComponent(response.headers.get("location"))).toMatch(/error=provider_not_linked.*เชื่อม Provider ID/);
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it("บัญชี Health ID ไม่มี Provider ID → error provider_none", async () => {
    global.fetch = jest.fn(async (url) => (url.endsWith("/api/v1/token") ? json(200, { data: { access_token: "HT" } }) : json(400, { message: "This user has not provider id" })));
    const { GET } = require("@/app/api/auth/provider-id/callback/route");
    const response = await GET(callbackRequest());
    expect(response.headers.get("location")).toMatch(/error=provider_none/);
  });
});
