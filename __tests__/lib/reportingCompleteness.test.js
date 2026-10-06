import { buildCompleteness, buildReminderText } from "@/lib/reportingCompleteness";

describe("reportingCompleteness", () => {
  const areas = [
    { district: "เมืองสตูล", tambon: "พิมาน" }, { district: "เมืองสตูล", tambon: "คลองขุด" },
    { district: "เมืองสตูล", tambon: "พิมาน" }, { district: "ละงู", tambon: "กำแพง" }, { district: null, tambon: "x" }
  ];

  it("counts reported tambons per district without duplicates", () => {
    const summary = buildCompleteness(areas, [{ district: "เมืองสตูล", tambon: "พิมาน " }]);
    expect(summary).toMatchObject({ total: 3, reported: 1, percent: 33 });
    const muang = summary.districts.find((item) => item.district === "เมืองสตูล");
    expect(muang).toMatchObject({ total: 2, reported: 1, missing: ["คลองขุด"] });
  });

  it("writes a reminder listing only districts with gaps", () => {
    const summary = buildCompleteness(areas, [{ district: "ละงู", tambon: "กำแพง" }]);
    const text = buildReminderText({ label: "โรคระบาด", sessionNumber: 3, dateLabel: "5 ต.ค. 2569", summary });
    expect(text).toContain("ครั้งที่ 3");
    expect(text).toContain("อ.เมืองสตูล ยังไม่ส่ง: คลองขุด, พิมาน");
    expect(text).not.toContain("อ.ละงู");
  });

  it("handles no areas", () => {
    expect(buildCompleteness([], []).percent).toBe(0);
  });
});
