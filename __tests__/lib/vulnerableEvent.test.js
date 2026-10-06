import { affectedOf, findBaselineFor, summarizeVulnerableEvent, urgencyScore, validateEventRecord } from "@/lib/vulnerableEvent";

const rows = [
  { district: "ละงู", tambon: "กำแพง", village: "บ้านA", elderly: 10, bedridden: 2, cared_count: 12, moved_count: 2 },
  { district: "ละงู", tambon: "กำแพง", village: "บ้านB", elderly: 5, bedridden: 3, disabled: 1, cared_count: 2, moved_count: 0 },
  { district: "เมืองสตูล", tambon: "พิมาน", village: "", children: 4, cared_count: 0, moved_count: 0 }
];
const baseline = [
  { district: "ละงู", tambon: "กำแพง", village: "บ้านA", elderly: 20, bedridden: 2 },
  { district: "เมืองสตูล", tambon: "พิมาน", village: null, children: 10 }
];

describe("vulnerableEvent", () => {
  it("adds up affected people across types", () => {
    expect(affectedOf(rows[1])).toBe(9);
  });

  it("summarises the event", () => {
    const summary = summarizeVulnerableEvent(rows, baseline);
    expect(summary).toMatchObject({ villages: 3, affected: 25, cared: 14, moved: 2, pending: 11, inArea: 32, caredPercent: 56 });
    expect(summary.byType.find((type) => type.key === "bedridden")).toMatchObject({ affected: 5, inArea: 2 });
    expect(summary.districts[0]).toMatchObject({ district: "ละงู", affected: 21, cared: 14, pending: 7 });
    expect(summary.urgent[0].village).toBe("บ้านB");
    expect(summary.urgent.map((row) => row.village)).not.toContain("บ้านA");
  });

  it("weights bedridden and disabled higher", () => {
    expect(urgencyScore({ bedridden: 2, cared_count: 0 })).toBeGreaterThan(urgencyScore({ elderly: 2, cared_count: 0 }));
    expect(urgencyScore({ elderly: 2, cared_count: 2 })).toBe(0);
  });

  it("validates records", () => {
    expect(validateEventRecord({ district: "", tambon: "x" })).toContain("อำเภอ");
    expect(validateEventRecord({ district: "a", tambon: "b", elderly: 2, cared_count: 3 })).toContain("ไม่เกิน");
    expect(validateEventRecord({ district: "a", tambon: "b", elderly: 2, moved_count: 3 })).toContain("เคลื่อนย้าย");
    expect(validateEventRecord({ district: "a", tambon: "b", elderly: -1 })).toContain("ติดลบ");
    expect(validateEventRecord({ district: "a", tambon: "b", elderly: 2, cared_count: 2, moved_count: 1 })).toBeNull();
  });

  it("finds the baseline row for an area", () => {
    expect(findBaselineFor(baseline, { district: "เมืองสตูล", tambon: "พิมาน", village: "" })).toMatchObject({ children: 10 });
    expect(findBaselineFor(baseline, { district: "x", tambon: "y" })).toBeNull();
  });
});

describe("registry helpers", () => {
  const { registryCounts, differsFromRegistry } = require("@/lib/vulnerableEvent");
  const registry = [{ district: "ละงู", tambon: "กำแพง", village: "บ้านA", elderly: 20, bedridden: 2 }];
  it("copies counts from the registry", () => {
    expect(registryCounts(registry, { district: "ละงู", tambon: "กำแพง", village: "บ้านA" })).toMatchObject({ elderly: 20, bedridden: 2, children: 0 });
    expect(registryCounts(registry, { district: "x", tambon: "y" }).elderly).toBe(0);
  });
  it("detects registry changes", () => {
    expect(differsFromRegistry({ district: "ละงู", tambon: "กำแพง", village: "บ้านA", elderly: 20, bedridden: 2 }, registry)).toBe(false);
    expect(differsFromRegistry({ district: "ละงู", tambon: "กำแพง", village: "บ้านA", elderly: 18, bedridden: 2 }, registry)).toBe(true);
    expect(differsFromRegistry({ district: "x", tambon: "y", elderly: 1 }, registry)).toBe(false);
  });
});

describe("areaLabel", () => {
  const { areaLabel } = require("@/lib/vulnerableEvent");
  it("แถวยอดรวมทั้งอำเภอแสดงเป็นชื่ออำเภอ ไม่ใช่คำว่า รวม", () => {
    expect(areaLabel({ district: "ควนโดน", tambon: "รวมทั้งอำเภอ", village: "รวม" }).main).toBe("อ.ควนโดน (ทั้งอำเภอ)");
    expect(areaLabel({ district: "ละงู", tambon: "กำแพง", village: "" }).main).toBe("ต.กำแพง (ทั้งตำบล)");
    expect(areaLabel({ district: "ละงู", tambon: "กำแพง", village: "ม.3 บ้านนา" })).toEqual({ main: "ม.3 บ้านนา", sub: "ต.กำแพง อ.ละงู" });
  });
});
