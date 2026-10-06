import { buildHealthDashboard, canonicalDisease } from "@/lib/healthDashboard";

describe("canonicalDisease", () => {
  it("รวมชื่อโรคที่เขียนต่างกันระหว่างแบบรายงานศูนย์และชุมชน", () => {
    expect(canonicalDisease("โรคฉี่หนู")).toBe("โรคฉี่หนู (เลปโตสไปโรซิส)");
    expect(canonicalDisease(" เลปโตสไปโรซิส ")).toBe("โรคฉี่หนู (เลปโตสไปโรซิส)");
    expect(canonicalDisease("น้ำกัดเท้า")).toBe("โรคผิวหนัง/น้ำกัดเท้า");
    expect(canonicalDisease("ท้องเสีย")).toBe("อุจจาระร่วง");
    expect(canonicalDisease("")).toBe("ไม่ระบุโรค");
    expect(canonicalDisease("ไข้มาลาเรีย")).toBe("ไข้มาลาเรีย");
  });

  it("dashboard นับโรคเดียวกันจากสองแหล่งเป็นแถวเดียว", () => {
    const result = buildHealthDashboard({
      session: { opened_at: "2026-10-01T08:00:00" },
      community: [{ report_date: "2026-10-05", district: "ละงู", disease: "โรคฉี่หนู", cases: 5 }],
      shelter: [{ report_date: "2026-10-06", district: "ละงู", shelter: "ศูนย์ ก", disease: "โรคฉี่หนู (เลปโตสไปโรซิส)", cases: 2, hospitalized: 0, deaths: 0 }]
    }, "2026-10-06");
    const lepto = result.diseases.filter((row) => row.disease.includes("ฉี่หนู"));
    expect(lepto).toHaveLength(1);
    expect(lepto[0].last7).toBe(7);
  });
});
