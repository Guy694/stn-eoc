import { pinHtml, pinKey, pinSvg } from "@/components/eoc/vulnerable/vulnerablePins";

describe("หมุดกลุ่มเปราะบาง (ประสิทธิภาพ)", () => {
  const person = { id: 1, status: "waiting", vulnerable_type: "bedridden", power_dependent: false, care_group: "red", location: { lat: 6.6, lng: 100 } };

  test("คนที่หมุดหน้าตาเหมือนกันได้ key เดียวกัน (ใช้ไอคอนซ้ำได้) และต่างกันเมื่อสถานะ/การเลือกเปลี่ยน", () => {
    expect(pinKey(person)).toBe(pinKey({ ...person, id: 2, name: "[ทดสอบ] อีกคน" }));
    expect(pinKey(person)).not.toBe(pinKey({ ...person, status: "assisted" }));
    expect(pinKey(person)).not.toBe(pinKey(person, { selected: true }));
  });

  test("เงาวาดใน SVG ไม่พึ่ง CSS filter", () => {
    expect(pinSvg("waiting", 30, "#dc2626")).toContain('stroke="rgba(15,23,42,.35)"');
    expect(pinHtml(person)).not.toMatch(/filter/);
    expect(pinHtml(person)).toContain("vp-pin--urgent");
  });
});
