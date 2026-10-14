/** @jest-environment node */
const mockCalls = [];
jest.mock("@/lib/auth", () => ({ requireAuth: jest.fn(async () => ({ success: true, user: { id: 1, role: "admin" } })) }));
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    query: jest.fn(async (sql) => {
      mockCalls.push(sql);
      if (/FROM medical_inventory_events/.test(sql)) return [{ id: 40 }];
      if (/COUNT\(DISTINCT item_code\)/.test(sql)) return [{ item_count: 3, total_balance: 120 }];
      if (/FROM medical_inventory_stock s/.test(sql)) return [{ id: 1, item_name: "ORS", opening_qty: 100, balance_qty: 5, remain_pct: 5 }];
      if (/WITH active_st/.test(sql)) return [{ id: 1, team_code: "SAT", assigned_sessions: 1, member_count: 4, lead_count: 1, activity_count_7d: 6 }];
      return [];
    })
  }
}));

const { GET } = require("@/app/api/analytics/route");
const call = (query = "") => GET(new Request(`http://localhost/stn-eoc/api/analytics${query}`));

test("รวมยอดทีมแยกเป็นส่วน ไม่ JOIN กิจกรรมกับรายงานคูณกัน และคลังใช้ยอดตั้งต้น+รับเข้า", async () => {
  const json = await (await call()).json();
  expect(json.success).toBe(true);
  const teamSql = mockCalls.find((sql) => /WITH active_st/.test(sql));
  expect(teamSql).toMatch(/activity AS \(/);
  expect(teamSql).toMatch(/reports AS \(/);
  expect(json.data.inventory.summary).toMatchObject({ item_count: 3, low_stock_count: 1, critical_stock_count: 1 });
  expect(mockCalls.join("\n")).toMatch(/received_qty/);
  expect(json.data.teams[0]).toMatchObject({ team_code: "SAT", status: "ready" });
});

test("เรียกซ้ำภายใน 30 วินาทีใช้ผลเดิม ปุ่มรีเฟรชคำนวณใหม่", async () => {
  const before = mockCalls.length;
  expect((await (await call()).json()).cached).toBe(true);
  expect(mockCalls.length).toBe(before);
  await call("?refresh=1");
  expect(mockCalls.length).toBeGreaterThan(before);
});
