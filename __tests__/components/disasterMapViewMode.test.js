import { buildContextOptions, describeViewMode } from "@/components/public/PublicDisasterMapContent";

const TODAY = "2026-10-01";
const active = [{ is_active: true, eoc_type: "disease", session_id: 9, session_number: 3, disease_name: "ไข้เลือดออก", activated_at: "2026-09-20" }];
const sessions = [
  { id: 9, eoc_type: "disease", session_number: 3, opened_at: "2026-09-20", status: "active" },
  { id: 4, eoc_type: "disease", session_number: 1, opened_at: "2025-06-01", closed_at: "2025-07-01", status: "closed" }
];

describe("describeViewMode", () => {
  const options = buildContextOptions(active, sessions, "disease");

  it("separates active and closed sessions", () => {
    expect(options.map((item) => item.mode)).toEqual(["active", "history"]);
  });

  it("is live for an open EOC on today's date", () => {
    expect(describeViewMode(options[0], TODAY, options, TODAY).kind).toBe("live");
    expect(describeViewMode(options[0], "", options, TODAY).kind).toBe("live");
  });

  it("flags past days of an open EOC", () => {
    expect(describeViewMode(options[0], "2026-09-25", options, TODAY).kind).toBe("activePast");
  });

  it("flags closed sessions as history and reports whether a live one exists", () => {
    expect(describeViewMode(options[1], "2025-06-10", options, TODAY)).toEqual({ kind: "history", hasActive: true });
    const onlyHistory = buildContextOptions([], sessions.slice(1), "disease");
    expect(describeViewMode(onlyHistory[0], "2025-06-10", onlyHistory, TODAY)).toEqual({ kind: "history", hasActive: false });
  });

  it("returns none when nothing is selected", () => {
    expect(describeViewMode(null, "", [], TODAY).kind).toBe("none");
  });
});
