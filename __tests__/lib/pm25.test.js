import { buildPm25Payload, parseGistdaTime, pm25ForDistrict, pm25Level } from "@/lib/pm25";

describe("pm25Level", () => {
  it("ใช้เกณฑ์ดัชนีคุณภาพอากาศของกรมควบคุมมลพิษ", () => {
    expect(pm25Level(10).key).toBe("very_good");
    expect(pm25Level(15).key).toBe("very_good");
    expect(pm25Level(15.1).key).toBe("good");
    expect(pm25Level(25.1).key).toBe("moderate");
    expect(pm25Level(37.5).key).toBe("moderate");
    expect(pm25Level(37.6).key).toBe("unhealthy_sensitive");
    expect(pm25Level(75.1).key).toBe("unhealthy");
    expect(pm25Level(null)).toBeNull();
    expect(pm25Level(-1)).toBeNull();
  });
});

describe("parseGistdaTime", () => {
  const now = Date.parse("2026-10-08T01:38:00Z"); // 08:38 น. เวลาไทย

  it("อ่านเวลาที่ติด Z แต่เป็นเวลาไทย (อยู่ในอนาคตถ้าอ่านเป็น UTC)", () => {
    expect(parseGistdaTime("2026-10-08T08:00:00.000Z", now)).toBe("2026-10-08T01:00:00.000Z");
  });

  it("ถ้าเป็น UTC จริง (ไม่อยู่ในอนาคต) ใช้ตามเดิม", () => {
    expect(parseGistdaTime("2026-10-08T01:00:00.000Z", now)).toBe("2026-10-08T01:00:00.000Z");
  });

  it("ค่าว่างหรือผิดรูปแบบ", () => {
    expect(parseGistdaTime("", now)).toBeNull();
    expect(parseGistdaTime("abc", now)).toBeNull();
  });
});

describe("buildPm25Payload", () => {
  const now = Date.parse("2026-10-08T01:38:00Z");
  const provinces = [
    { pv_tn: "กรุงเทพมหานคร", pv_idn: 10, pm25: 48.8, pm25Avg24hr: 27.4, dt: "2026-10-08T08:00:00.000Z" },
    { pv_tn: "ตรัง", pv_idn: 92, pm25: 34.1, pm25Avg24hr: 20, dt: "2026-10-08T08:00:00.000Z" },
    { pv_tn: "สตูล", pv_idn: 91, pm25: 27.454, pm25Avg24hr: 20.27, dt: "2026-10-08T08:00:00.000Z" },
    { pv_tn: "สงขลา", pv_idn: 90, pm25: 25.7, pm25Avg24hr: 19, dt: "2026-10-08T08:00:00.000Z" },
    { pv_tn: "เสีย", pv_idn: 1, pm25: null }
  ];
  const amphoes = [
    { ap_tn: "ละงู", ap_idn: 9105, pm25: 28.98, pm25Avg24hr: 20.5, dt: "2026-10-08T08:00:00.000Z" },
    { ap_tn: "ทุ่งหว้า", ap_idn: 9106, pm25: 35.46, pm25Avg24hr: 21.8, dt: "2026-10-08T08:00:00.000Z" }
  ];

  it("สรุปค่าสตูล อันดับประเทศ รายอำเภอ (มากไปน้อย) และจังหวัดข้างเคียง", () => {
    const payload = buildPm25Payload({ provinces, amphoes, now });
    expect(payload.province).toMatchObject({ name: "สตูล", value: 27.5, avg24: 20.3, level: "moderate", avg24_level: "good" });
    expect(payload.province.observed_at).toBe("2026-10-08T01:00:00.000Z");
    expect(payload.rank).toBe(3);
    expect(payload.province_count).toBe(4);
    expect(payload.districts.map((item) => item.name)).toEqual(["ทุ่งหว้า", "ละงู"]);
    expect(payload.neighbors.map((item) => item.name)).toEqual(["ตรัง", "สงขลา"]);
  });

  it("ไม่มีข้อมูลสตูล", () => {
    expect(buildPm25Payload({ provinces: [], amphoes: [] }).province).toBeNull();
  });

  it("ค่าของอำเภอ ถ้าไม่มีใช้ค่าจังหวัด", () => {
    const payload = buildPm25Payload({ provinces, amphoes, now });
    expect(pm25ForDistrict(payload, "อ.ละงู")).toMatchObject({ value: 29, scope: "district" });
    expect(pm25ForDistrict(payload, "มะนัง")).toMatchObject({ value: 27.5, scope: "province" });
  });
});
