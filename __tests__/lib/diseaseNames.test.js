import { normalizeDiseaseName, sameDisease, uniqueDiseaseNames } from "@/lib/diseaseNames";
import { canonicalDisease } from "@/lib/healthDashboard";

describe("normalizeDiseaseName (ชื่อมาตรฐานตอนบันทึก)", () => {
  it("รวมชื่อที่เป็นโรคเดียวกัน", () => {
    for (const name of ["โรคฉี่หนู", "เลปโตสไปโรซิส", "เลปโตสไปโรซีส", " Leptospirosis "]) {
      expect(normalizeDiseaseName(name)).toBe("โรคฉี่หนู (เลปโตสไปโรซิส)");
    }
    expect(normalizeDiseaseName("ท้องเสีย")).toBe("อุจจาระร่วง");
    expect(normalizeDiseaseName("โรคตาแดง")).toBe("ตาแดง");
  });

  it("ไม่รวมโรคที่ต่างกันจริง", () => {
    expect(normalizeDiseaseName("ไข้หวัด")).toBe("ไข้หวัด");
    expect(normalizeDiseaseName("ไข้หวัดใหญ่")).toBe("ไข้หวัดใหญ่");
    expect(normalizeDiseaseName("โรคผิวหนัง")).toBe("โรคผิวหนัง");
    expect(normalizeDiseaseName("น้ำกัดเท้า")).toBe("น้ำกัดเท้า");
  });

  it("หมวดรวมเดิมที่มี / และชื่อที่ไม่รู้จักคงไว้ (ตัดแค่ช่องว่าง)", () => {
    expect(normalizeDiseaseName("ไข้หวัด/ไข้หวัดใหญ่")).toBe("ไข้หวัด/ไข้หวัดใหญ่");
    expect(normalizeDiseaseName("  ไข้มาลาเรีย  ")).toBe("ไข้มาลาเรีย");
    expect(normalizeDiseaseName(null)).toBe("");
  });

  it("sameDisease และ uniqueDiseaseNames กันชื่อซ้ำในรายการหลัก", () => {
    expect(sameDisease("โรคฉี่หนู", "เลปโตสไปโรซีส")).toBe(true);
    expect(sameDisease("ไข้หวัด", "ไข้หวัดใหญ่")).toBe(false);
    expect(uniqueDiseaseNames(["ตาแดง", { name: "โรคฉี่หนู" }, "เลปโตสไปโรซิส", "เลปโตสไปโรซีส", "ไข้หวัด"]))
      .toEqual(["ตาแดง", "โรคฉี่หนู (เลปโตสไปโรซิส)", "ไข้หวัด"]);
  });

  it("หมวดดูภาพรวมของ dashboard ยังรวมกว้างกว่าเดิม", () => {
    expect(canonicalDisease("น้ำกัดเท้า")).toBe("โรคผิวหนัง/น้ำกัดเท้า");
    expect(canonicalDisease("ไข้หวัดใหญ่")).toBe("ไข้หวัด/ไข้หวัดใหญ่");
  });
});

describe("planMasterListCleanup", () => {
  const { planMasterListCleanup } = require("@/lib/diseaseNames");
  it("รายการหลักจริงที่มีชื่อซ้ำ เหลือแถวเดียวต่อโรค และไม่แตะโรคที่ไม่ซ้ำ", () => {
    const names = ["ตาแดง", "ทางเดินอาหาร", "น้ำกัดเท้า", "บาดแผล", "ปวดเมื่อย", "ปอดอักเสบ", "มือเท้าปาก", "อุจจาระร่วง", "เลปโตสไปโรซิส", "เลปโตสไปโรซีส", "เวียนศีรษะ", "โควิด-19", "โรคฉี่หนู", "โรคผิวหนัง", "ไข้หวัด", "ไข้หวัดใหญ่", "ไข้เลือดออก"];
    const rows = names.map((name, index) => ({ id: index + 1, name, is_active: 1 }));
    const plan = planMasterListCleanup(rows);
    expect(plan).toHaveLength(1);
    expect(plan[0].canonical).toBe("โรคฉี่หนู (เลปโตสไปโรซิส)");
    expect(plan[0].keep.name).toBe("เลปโตสไปโรซิส");
    expect(plan[0].others.map((row) => row.name)).toEqual(["เลปโตสไปโรซีส", "โรคฉี่หนู"]);
  });

  it("ถ้ามีแถวชื่อมาตรฐานอยู่แล้วใช้แถวนั้น", () => {
    const plan = planMasterListCleanup([{ id: 1, name: "โรคฉี่หนู", is_active: 1 }, { id: 2, name: "โรคฉี่หนู (เลปโตสไปโรซิส)", is_active: 0 }]);
    expect(plan[0].keep.id).toBe(2);
    expect(plan[0].others.map((row) => row.id)).toEqual([1]);
  });
});
