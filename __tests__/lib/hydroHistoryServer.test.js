/** @jest-environment node */
jest.mock("@/lib/db", () => ({ query: jest.fn(async () => ({})), getPool: jest.fn() }));
jest.mock("@/lib/thaiWaterClient", () => ({ getSatunRainfall: jest.fn() }));
import { query } from "@/lib/db";
import { saveRainSnapshot, saveSeaSnapshot } from "@/lib/hydroHistoryServer";

test("เก็บฝนเฉพาะสถานีที่ข้อมูลใหม่ และเก็บน้ำทะเลรายชั่วโมง", async () => {
  const now = new Date("2026-10-20T03:20:00Z"); // 10:20 น.
  const n = await saveRainSnapshot([
    { id: "1", name: "[ทดสอบ] A", amphoe: "ละงู", rain24h: 12.5, rain1h: 2, observedAt: "2026-10-20T03:00:00Z", lat: 6.9, lng: 99.8 },
    { id: "2", name: "[ทดสอบ] เก่า", rain24h: 50, observedAt: "2026-10-19T10:00:00Z" }
  ], now);
  expect(n).toBe(1);
  const [sql, params] = query.mock.calls[0];
  expect(sql).toContain("INSERT INTO rain_readings");
  expect(params.slice(0, 2)).toEqual(["1", "2026-10-20 10:00:00"]);
  expect(params[9]).toBe("2026-10-20 10:00:00");

  query.mockClear();
  expect(await saveSeaSnapshot({ level: 1.23, observed: { level: 1.1, stale: false }, station: { code: "lgkw" }, status: { key: "elevated" } }, now)).toBe(1);
  expect(query.mock.calls[0][1]).toEqual(["2026-10-20 10:00:00", 1.1, "lgkw", 1.23, "elevated"]);
  expect(await saveSeaSnapshot({ stale: true, level: 1 }, now)).toBe(0);
});
