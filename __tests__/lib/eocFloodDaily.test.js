jest.mock("@/lib/db", () => ({
  query: jest.fn(),
}));

jest.mock("@/lib/eocTeamAccess", () => ({
  getSessionTeamAccessByCode: jest.fn(),
}));

const {
  bangkokTodayKey,
  getFloodDailyData,
  parseDateKey,
  parsePositiveId,
} = require("@/lib/eocFloodDaily");
const { query } = require("@/lib/db");

describe("flood daily filters", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  test("accepts only positive integer session identifiers", () => {
    expect(parsePositiveId("54")).toBe(54);
    expect(parsePositiveId("0")).toBeNull();
    expect(parsePositiveId("-1")).toBeNull();
    expect(parsePositiveId("1.5")).toBeNull();
    expect(parsePositiveId("abc")).toBeNull();
  });

  test("accepts valid ISO date keys and rejects rollover dates", () => {
    expect(parseDateKey("2026-07-23")).toBe("2026-07-23");
    expect(parseDateKey("2026-02-31")).toBeNull();
    expect(parseDateKey("2026-7-23")).toBeNull();
    expect(parseDateKey("not-a-date")).toBeNull();
  });

  test("formats today using the Asia/Bangkok calendar date", () => {
    expect(bangkokTodayKey(new Date("2026-07-22T18:30:00.000Z"))).toBe("2026-07-23");
  });

  test("scopes every flood-record query to the selected session and exact report date", async () => {
    query.mockImplementation(async (sql) => {
      if (sql.includes("FROM eoc_sessions")) {
        return [{ id: 54, session_number: 3, status: "closed" }];
      }
      if (sql.includes("COUNT(DISTINCT district)")) {
        return [{ affected_districts: 0, affected_tambons: 0, affected_villages: 0 }];
      }
      return [];
    });

    const result = await getFloodDailyData({ sessionId: 54, reportDate: "2026-07-23" });
    const floodRecordCalls = query.mock.calls.filter(([sql]) => sql.includes("FROM flood_records"));

    expect(result).toMatchObject({ session_id: 54, reportDate: "2026-07-23" });
    expect(floodRecordCalls).toHaveLength(5);
    floodRecordCalls.forEach(([sql, params]) => {
      expect(sql).toContain("session_id = ?");
      if (sql.includes("DATE(flood_start_date)")) {
        expect(params).toEqual([54, "2026-07-23"]);
      } else {
        expect(params).toEqual([54]);
      }
    });
  });
});
