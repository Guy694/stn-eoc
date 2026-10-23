/** @jest-environment node */
// ปุ่มเดียวเปิด/ปิดศูนย์พักพิงทั้งหมด + หน้าประชาชนไม่นับเหตุการณ์ที่สวิตช์ EOC ปิดแล้ว
const mockPoolQuery = jest.fn();
const mockQuery = jest.fn();
jest.mock("@/lib/db", () => ({ getConnection: async () => ({ query: mockPoolQuery }), query: (...args) => mockQuery(...args) }));
jest.mock("@/lib/auth", () => ({ OFFICER_ROLES: ["admin"], requireAuth: async () => ({ success: true, user: { id: 1, role: "admin", username: "admin" } }) }));
jest.mock("@/lib/eocModuleAccess", () => ({ requireModuleEdit: async () => ({}), modulePermissions: async () => ({}) }));
jest.mock("@/lib/recordArchive", () => ({ recordChange: jest.fn() }));
jest.mock("@/lib/eocAlertRunner", () => ({ triggerEventAlerts: jest.fn() }));

const { NextRequest } = require("next/server");
const post = (body) => new NextRequest("http://localhost/stn-eoc/api/eoc/shelter-activations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => jest.clearAllMocks());

test("เปิดทั้งหมด: เปิดศูนย์ที่ยังไม่เปิด (อัปเดตแถวเดิม/เพิ่มแถวใหม่)", async () => {
  mockPoolQuery.mockImplementation(async (sql) => {
    if (sql.includes("FROM eoc_sessions")) return [[{ id: 9, eoc_type: "flood", status: "active" }]];
    if (sql.includes("FROM shelter_centers sc")) return [[{ id: 1, activation_id: 50 }, { id: 2, activation_id: null }]];
    return [{ affectedRows: 1 }];
  });
  const { POST } = require("@/app/api/eoc/shelter-activations/route");
  const body = await (await POST(post({ bulk: "open_all", session_id: 9, eoc_type: "flood" }))).json();
  expect(body).toMatchObject({ success: true, changed: 2 });
  const sqls = mockPoolQuery.mock.calls.map(([sql]) => sql);
  expect(sqls.some((sql) => sql.startsWith("UPDATE shelter_session_activations SET is_active = 1"))).toBe(true);
  expect(sqls.some((sql) => sql.startsWith("INSERT INTO shelter_session_activations"))).toBe(true);
});

test("ปิดทั้งหมด และไม่ให้เปิดในเหตุการณ์ที่ปิดแล้ว", async () => {
  mockPoolQuery.mockImplementation(async (sql) => {
    if (sql.includes("FROM eoc_sessions")) return [[{ id: 9, eoc_type: "flood", status: "active" }]];
    return [{ affectedRows: 5 }];
  });
  const { POST } = require("@/app/api/eoc/shelter-activations/route");
  expect(await (await POST(post({ bulk: "close_all", session_id: 9 }))).json()).toMatchObject({ success: true, changed: 5 });

  mockPoolQuery.mockImplementation(async (sql) => (sql.includes("FROM eoc_sessions") ? [[{ id: 9, status: "closed" }]] : [{}]));
  const response = await POST(post({ bulk: "open_all", session_id: 9 }));
  expect(response.status).toBe(409);
});

test("เหตุการณ์ที่เปิดอยู่: ตัดครั้งที่ค้างสถานะ active ทั้งที่ปิดสวิตช์ EOC แล้ว", async () => {
  mockQuery.mockResolvedValue([]);
  const { getOpenEocSessions } = require("@/lib/eocOpen");
  await getOpenEocSessions();
  expect(mockQuery.mock.calls[0][0]).toMatch(/NOT EXISTS \(SELECT 1 FROM eoc_status st WHERE st.eoc_type = es.eoc_type AND st.is_active = 0\)/);
});
