import { buildDistrictMatrix, buildKpis, districtKey, headline } from "@/lib/situationBoard";
import { buildAgenda } from "@/lib/meetingBrief";

const brief = {
  impact: {
    latest: { date: "2026-10-06", villages: 5, households: 120, people: 450, severe: 2 },
    previous: { date: "2026-10-05", villages: 3, households: 80, people: 300, severe: 0 },
    districts: [
      { district: "ละงู", villages: 3, households: 90, people: 350, severe: 2, maxDepth: 120 },
      { district: "ท่าแพ", villages: 2, households: 30, people: 100, severe: 0, maxDepth: 40 }
    ],
    casualties: { deaths: 1, missing: 0, injured: 3, districts: [{ district: "ละงู", deaths: 1, missing: 0, injured: 3 }] }
  },
  shelters: { activeCount: 2, occupancy: 120, capacity: 150, usePercent: 80, free: 30, full: 0, nearFull: 1, districts: [{ district: "ละงู", shelters: 1, occupancy: 95, capacity: 100 }] },
  health: { totals: { cases: 20, last7: 20, change: null, hospitalized: 1, deaths: 0, severeReports: 0 }, districts: [{ district: "อ.ท่าแพ", last7: 12, prev7: 0, change: null }] },
  vulnerable: { affected: 100, pending: 80, caredPercent: 20, districts: [{ district: "ละงู", affected: 100, pending: 80 }] },
  supplies: { summary: { out: 1, low: 2, items: 4, agencies: 3 } },
  it: { summary: { open: 1, critical: 0, resources: { offline: 2 } } },
  completeness: { districts: [{ district: "ละงู", reported: 4, total: 6 }, { district: "มะนัง", reported: 0, total: 2 }] }
};

describe("situationBoard", () => {
  it("districtKey ตัดคำนำหน้าอำเภอให้ชื่อตรงกันทุกตาราง", () => {
    expect(districtKey("อ.ละงู")).toBe("ละงู");
    expect(districtKey("อำเภอ ละงู")).toBe("ละงู");
    expect(districtKey(" ละงู ")).toBe("ละงู");
  });

  it("ตัวชี้วัดหลักบอกสถานะและเหตุผล", () => {
    const kpis = Object.fromEntries(buildKpis(brief).map((kpi) => [kpi.key, kpi]));
    expect(kpis.impact).toMatchObject({ value: 450, delta: 150, tone: "red" });
    expect(kpis.casualties.tone).toBe("red");
    expect(kpis.shelters.tone).toBe("amber");
    expect(kpis.health.tone).toBe("amber");
    expect(kpis.vulnerable.tone).toBe("red");
    expect(kpis.supplies).toMatchObject({ value: "1 / 2", tone: "red" });
    expect(kpis.it.tone).toBe("amber");
  });

  it("ไม่มีข้อมูลเลยจะเป็นสถานะ ไม่มีข้อมูล ไม่ใช่ ปกติ", () => {
    const kpis = buildKpis({});
    expect(kpis.find((kpi) => kpi.key === "impact").tone).toBe("gray");
    expect(kpis.find((kpi) => kpi.key === "shelters").tone).toBe("gray");
  });

  it("ตารางรายอำเภอรวมทุกด้านเป็นแถวเดียวและเรียงอำเภอเร่งด่วนก่อน", () => {
    const matrix = buildDistrictMatrix(brief);
    expect(matrix[0].district).toBe("ละงู");
    expect(matrix[0]).toMatchObject({ tone: "red", people: 350, severe: 2, deaths: 1, occupancy: 95, vulnerablePending: 80, reported: 4, tambons: 6 });
    expect(matrix[0].reasons).toEqual(expect.arrayContaining(["เสียชีวิต/สูญหาย 1 คน", "น้ำท่วมรุนแรง 2 หมู่บ้าน", "ศูนย์พักพิงใกล้เต็ม"]));
    const full = buildDistrictMatrix({ shelters: { districts: [{ district: "ละงู", shelters: 2, occupancy: 104, capacity: 150, full: 1 }] } });
    expect(full[0]).toMatchObject({ tone: "red", reasons: ["ศูนย์พักพิงเต็ม 1 แห่ง"] });
    const thapae = matrix.find((row) => row.district === "ท่าแพ");
    expect(thapae).toMatchObject({ tone: "red", cases7: 12, people: 100 });
    const manang = matrix.find((row) => row.district === "มะนัง");
    expect(manang).toMatchObject({ tone: "gray", reasons: ["ยังไม่ส่งรายงานวันนี้"] });
  });

  it("ยังไม่มีอำเภอไหนส่งรายงาน ไม่เขียนเหตุผลเดียวกันซ้ำทุกแถว", () => {
    const matrix = buildDistrictMatrix({ completeness: { districts: [{ district: "ละงู", reported: 0, total: 6 }, { district: "มะนัง", reported: 0, total: 2 }] } });
    expect(matrix.every((row) => row.reasons.length === 0)).toBe(true);
  });

  it("หัวเรื่องสรุปบอกอำเภอเร่งด่วน", () => {
    const matrix = buildDistrictMatrix(brief);
    expect(headline(buildKpis(brief), matrix)).toMatchObject({ tone: "red" });
    expect(headline([], []).tone).toBe("gray");
  });

  it("เรื่องที่ต้องตัดสินใจรวมผลกระทบน้ำท่วมและผู้เสียชีวิต", () => {
    const agenda = buildAgenda(brief);
    expect(agenda[0]).toMatchObject({ level: "critical", module: "ผู้ประสบภัย" });
    expect(agenda.some((item) => item.title === "น้ำท่วมระดับรุนแรง 2 หมู่บ้าน")).toBe(true);
    expect(agenda.some((item) => item.title === "ผู้ได้รับผลกระทบเพิ่มขึ้น 150 คน")).toBe(true);
  });
});
