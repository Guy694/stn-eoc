/** @jest-environment node */
const mockQuery = jest.fn();
jest.mock("@/lib/db", () => ({ query: (...args) => mockQuery(...args) }));
jest.mock("@/lib/auth", () => ({ getAuthSession: jest.fn(), getSessionToken: jest.fn() }));

test("จุดบนแผนที่: รวมตามตำแหน่ง ใช้ GPS ก่อน IP และนับรายการที่ไม่ทราบตำแหน่ง", async () => {
  mockQuery.mockImplementation(async (sql) => {
    if (sql.includes("INFORMATION_SCHEMA")) return [{ n: 1 }];
    if (sql.includes("GROUP BY lat, lon, kind")) {
      return [{ lat: "6.62", lon: "100.07", kind: "gps", visits: 12, ips: 3, staff: 10, users: "admin,test01", user_count: 2, sample_ips: "49.1.1.1,49.1.1.2", last_seen: "2026-10-23 10:00:00" }];
    }
    if (sql.includes("IS NULL OR")) return [{ n: 7 }];
    return [];
  });
  const { readVisitorPoints } = require("@/lib/visitorLogServer");
  const result = await readVisitorPoints(new URLSearchParams({ days: "7", area: "staff" }));
  expect(result.points[0]).toMatchObject({ lat: 6.62, lon: 100.07, kind: "gps", visits: 12, users: ["admin", "test01"], sampleIps: ["49.1.1.1", "49.1.1.2"] });
  expect(result.unlocated).toBe(7);
  const sql = mockQuery.mock.calls.find(([text]) => text.includes("GROUP BY lat, lon, kind"));
  expect(sql[0]).toContain("COALESCE(gps_latitude, ROUND(latitude, 2))");
  expect(sql[1]).toEqual(["7", "staff"]);
});
