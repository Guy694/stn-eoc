import { matchesQuickFilter, validatePerson } from "@/lib/vulnerablePersons";
import { spreadApproxPositions } from "@/components/eoc/vulnerable/vulnerablePins";

const base = { vulnerable_type: "dialysis_hd", name: "[ทดสอบ] ผู้ป่วย ก", district: "ละงู", tambon: "กำแพง", village: "หมู่ 4 บ้านควนใหญ่", lat: "6.9", lng: "99.8" };

describe("พิกัดโดยประมาณ (กลางหมู่บ้านจากการนำเข้า)", () => {
  test("ติดธง approx เมื่อระบุ และไม่ติดเมื่อไม่ระบุ", () => {
    expect(validatePerson({ ...base, location_approx: 1 }).value.location).toEqual({ lat: 6.9, lng: 99.8, approx: true });
    expect(validatePerson({ ...base, location_approx: true }).value.location.approx).toBe(true);
    expect(validatePerson(base).value.location).toEqual({ lat: 6.9, lng: 99.8 });
    expect(validatePerson({ ...base, lat: "", lng: "", location_approx: 1 }).value.location).toBeNull();
  });

  test("ตัวกรองลัด ตำแหน่งประมาณ", () => {
    expect(matchesQuickFilter({ location: { lat: 1, lng: 1, approx: true } }, "approx_location")).toBe(true);
    expect(matchesQuickFilter({ location: { lat: 1, lng: 1 } }, "approx_location")).toBe(false);
    expect(matchesQuickFilter({ location: null }, "approx_location")).toBe(false);
  });

  test("กระจายหมุดที่ซ้อนจุดเดียวกัน เฉพาะพิกัดโดยประมาณ ไม่เกิน ~100 ม.", () => {
    const at = { lat: 6.9, lng: 99.8, approx: true };
    const people = [{ id: 1, location: at }, { id: 2, location: at }, { id: 3, location: at }, { id: 4, location: { lat: 6.9, lng: 99.8 } }, { id: 5, location: { lat: 6.95, lng: 99.85, approx: true } }];
    const spread = spreadApproxPositions(people);
    expect([...spread.keys()].sort()).toEqual([1, 2, 3]);
    const keys = new Set([...spread.values()].map(([lat, lng]) => `${lat.toFixed(6)},${lng.toFixed(6)}`));
    expect(keys.size).toBe(3);
    for (const [lat, lng] of spread.values()) {
      const meters = Math.hypot((lat - 6.9) * 111320, (lng - 99.8) * 111320 * Math.cos((6.9 * Math.PI) / 180));
      expect(meters).toBeGreaterThan(20);
      expect(meters).toBeLessThan(100);
    }
  });
});
