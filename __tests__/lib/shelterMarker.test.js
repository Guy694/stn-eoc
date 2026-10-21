import { SHELTER_CLOSED_COLOR, SHELTER_COLOR, shelterDivIconOptions, shelterMarkerHtml } from "@/lib/shelterMarker";

test("หมุดศูนย์พักพิงแบบเดียว: สีม่วง ไอคอนเต็นท์ ป้ายตามสถานะ", () => {
  const base = shelterMarkerHtml();
  expect(base).toContain(SHELTER_COLOR);
  expect(base).toContain("M3.5 21 14 3");
  expect(base).not.toContain("<span");
  expect(shelterMarkerHtml({ free: 12 })).toContain("ว่าง 12");
  expect(shelterMarkerHtml({ free: 0, full: true })).toContain("เต็ม");
  const closed = shelterMarkerHtml({ active: false });
  expect(closed).toContain(SHELTER_CLOSED_COLOR);
  expect(closed).toContain("ปิด");
  expect(shelterDivIconOptions()).toMatchObject({ className: "shelter-marker-icon", iconSize: [26, 26], iconAnchor: [13, 13] });
});

test("ศูนย์พักพิงทางการแพทย์ = กากบาทขาวบนพื้นเขียว (ไม่ใช่กาชาด) · สถานพยาบาล = H น้ำเงิน + จุดสถานะ", () => {
  const { HEALTH_COLOR, healthMarkerHtml, isMedicalShelter } = jest.requireActual("@/lib/shelterMarker");
  const medical = shelterMarkerHtml({ type: "field_hospital" });
  expect(isMedicalShelter("medical")).toBe(true);
  expect(medical).toContain(SHELTER_COLOR);
  expect(medical).toContain('fill="#fff"');
  expect(medical).not.toMatch(/#dc2626|#be123c|red/i);
  const hospital = healthMarkerHtml({ level: "hospital", statusColor: "#b91c1c", name: "[ทดสอบ] รพ.สตูล" });
  expect(hospital).toContain(HEALTH_COLOR);
  expect(hospital).toContain(">H<");
  expect(hospital).toContain("#b91c1c");
  expect(hospital).toContain("[ทดสอบ] รพ.สตูล");
  expect(healthMarkerHtml({ level: "office", statusColor: "#15803d" })).not.toContain("#15803d");
});
