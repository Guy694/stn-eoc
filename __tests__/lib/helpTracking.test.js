import {
  citizenStatus,
  citizenTimeline,
  formatTrackingCode,
  generateTrackingCode,
  nameVariants,
  normalizeTrackingCode,
  phoneMatches
} from "@/lib/helpTracking";

describe("helpTracking", () => {
  test("สร้างเลขติดตามจากตัวอักษรที่อ่านง่าย", () => {
    const code = generateTrackingCode((n) => Uint8Array.from({ length: n }, (_, i) => i * 7));
    expect(code).toMatch(/^ST[2-9A-HJ-NP-Z]{6}$/);
    expect(code.slice(2)).not.toMatch(/[01OIL]/);
  });

  test("รับเลขที่พิมพ์มาหลายรูปแบบ", () => {
    expect(normalizeTrackingCode("st-k7q 9mx")).toBe("STK7Q9MX");
    expect(normalizeTrackingCode("K7Q9MX")).toBe("STK7Q9MX");
    expect(normalizeTrackingCode("ST-123")).toBe("");
    expect(formatTrackingCode("STK7Q9MX")).toBe("ST-K7Q-9MX");
  });

  test("ต้องตรงเบอร์ 4 ตัวท้าย และรายงานที่ไม่มีเบอร์ตรวจไม่ได้", () => {
    expect(phoneMatches("098-765-4321", "4321")).toBe(true);
    expect(phoneMatches("0987654321", "1234")).toBe(false);
    expect(phoneMatches(null, "1234")).toBe(false);
    expect(phoneMatches("0987654321", "321")).toBe(false);
  });

  test("ประวัติ: ตัดสถานะซ้ำ เก็บข้อความถึงผู้แจ้ง", () => {
    const timeline = citizenTimeline([
      { status: "reviewing", created_at: "2026-10-07T10:00:00Z" },
      { status: "pending", created_at: "2026-10-07T09:00:00Z" },
      { status: "reviewing", created_at: "2026-10-07T10:05:00Z" },
      { status: "reviewing", created_at: "2026-10-07T10:30:00Z", citizen_message: "ทีมกำลังเดินทาง" }
    ]);
    expect(timeline.map((item) => item.status)).toEqual(["pending", "reviewing", "reviewing"]);
    expect(timeline[2].message).toBe("ทีมกำลังเดินทาง");
    expect(citizenStatus("unknown").label).toBe("รับเรื่องแล้ว");
  });

  test("ชื่อที่ใช้ค้น: ตัดช่องว่างและคำนำหน้า", () => {
    expect(nameVariants("  นาย  สมชาย ")).toEqual(["นาย สมชาย", "สมชาย"]);
    expect(nameVariants("มานี")).toEqual(["มานี"]);
    expect(nameVariants("")).toEqual([]);
  });
});
