import { hoursSince, occupancyLevel, summarizeShelters } from "@/lib/shelterDashboard";

const now = Date.parse("2026-10-06T12:00:00+07:00");
const rows = [
  { id: 1, sheltername: "รร.ก", district_name: "ละงู", is_activated_for_session: 1, shelter_capacity: 100, session_occupancy: 100, activation_updated_at: "2026-10-06T10:00:00+07:00", coordinator_phone: "081", occupancy_elderly_60_plus: 5 },
  { id: 2, sheltername: "วัด ข", district_name: "ละงู", is_activated_for_session: 1, shelter_capacity: 50, session_occupancy: 42, activation_updated_at: "2026-10-05T20:00:00+07:00", contact_phone: "082" },
  { id: 3, sheltername: "รร.ค", district_name: "เมืองสตูล", is_activated_for_session: 1, shelter_capacity: 200, session_occupancy: 20, activation_updated_at: "2026-10-06T11:00:00+07:00" },
  { id: 4, sheltername: "ปิดอยู่", district_name: "ทุ่งหว้า", is_activated_for_session: 0, shelter_capacity: 80, session_occupancy: 0 }
];
const health = {
  by_shelter: { 3: { new_cases: 4, today_new_cases: 2, severity: "medium" }, 1: { new_cases: 1, severity: "critical" } },
  by_disease: [{ disease_type: "อุจจาระร่วง", new_cases: 4 }],
  totals: { new_cases: 5, hospitalized: 1, deaths: 0, today_new_cases: 2 }
};

describe("shelterDashboard", () => {
  it("classifies occupancy", () => {
    expect(occupancyLevel(rows[0])).toBe("full");
    expect(occupancyLevel(rows[1])).toBe("near");
    expect(occupancyLevel(rows[2])).toBe("ok");
    expect(occupancyLevel({ shelter_capacity: 0 })).toBe("unknown");
  });

  it("computes hours since update", () => {
    expect(hoursSince("2026-10-06T10:00:00+07:00", now)).toBe(2);
    expect(hoursSince(null, now)).toBeNull();
  });

  it("summarises active shelters, districts, attention and health", () => {
    const summary = summarizeShelters(rows, health, now);
    expect(summary).toMatchObject({ registered: 4, activeCount: 3, capacity: 350, occupancy: 162, free: 188, usePercent: 46, full: 1, nearFull: 1, stale: 1 });
    expect(summary.districts[0]).toMatchObject({ district: "ละงู", shelters: 2, capacity: 150, occupancy: 142, usePercent: 95 });
    expect(summary.attention[0].name).toBe("รร.ก");
    expect(summary.attention.find((item) => item.name === "วัด ข").reasons.map((reason) => reason.text)).toEqual(["ใกล้เต็ม", "ไม่อัปเดตยอด 16 ชม."]);
    expect(summary.attention.find((item) => item.name === "รร.ค").reasons.map((reason) => reason.text)).toEqual(["ผู้ป่วยใหม่วันนี้ 2 ราย", "ไม่มีเบอร์ติดต่อ"]);
    expect(summary.health.sheltersWithCases).toBe(2);
    expect(summary.hasGroupData).toBe(true);
  });

  it("handles no data", () => {
    expect(summarizeShelters([], {}).usePercent).toBe(0);
  });
});
