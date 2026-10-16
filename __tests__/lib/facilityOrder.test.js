import { compareFacilities, facilityGroup, facilityOrderSql, matchFacility, sortFacilities } from "@/lib/facilityOrder";

const list = [
  { id: 9, name: "รพ.สต.บ้านควน", typecode: "รพ.สต.", district_name: "เมืองสตูล" },
  { id: 8, name: "สสอ.ละงู", typecode: "สสอ.", district_name: "ละงู" },
  { id: 7, name: "รพ.ละงู", typecode: "รพ.ชุมชน", district_name: "ละงู" },
  { id: 6, name: "ศสช.ตำมะลัง", typecode: "ศสช.", district_name: "เมืองสตูล" },
  { id: 5, name: "สสจ.สตูล", typecode: "สสจ.", district_name: "เมืองสตูล" },
  { id: 4, name: "รพ.สตูล", typecode: "รพ.ทั่วไป", district_name: "เมืองสตูล" },
  { id: 3, name: "สสอ.ควนโดน", typecode: "สสอ.", district_name: "ควนโดน" },
  { id: 2, name: "สอน.เกาะสาหร่าย", typecode: "สอน.", district_name: "เมืองสตูล" },
  { id: 1, name: "รพ.ควนโดน", typecode: "รพ.ชุมชน", district_name: "ควนโดน" }
];

describe("facilityOrder", () => {
  it("เรียง โรงพยาบาล → สสจ. → สสอ. → รพ.สต. → อื่น ๆ (รพ.ทั่วไปก่อน รพ.ชุมชน, ในกลุ่มเรียงอำเภอ)", () => {
    expect(sortFacilities(list).map((row) => row.name)).toEqual([
      "รพ.สตูล", "รพ.ควนโดน", "รพ.ละงู", "สสจ.สตูล", "สสอ.ควนโดน", "สสอ.ละงู", "รพ.สต.บ้านควน", "สอน.เกาะสาหร่าย", "ศสช.ตำมะลัง"
    ]);
  });

  it("แยก รพ.สต. ออกจากโรงพยาบาล และเดากลุ่มจากชื่อเมื่อไม่มีประเภท", () => {
    expect(facilityGroup({ typecode: "รพ.สต." })).toBe("pcu");
    expect(facilityGroup({ name: "รพ.สต.บ้านควน" })).toBe("pcu");
    expect(facilityGroup({ name: "รพ.ทุ่งหว้า" })).toBe("hospital");
    expect(facilityGroup({ agency_name: "สสอ.มะนัง" })).toBe("dho");
    expect(compareFacilities({ name: "สสจ.สตูล" }, { name: "รพ.สต.ควนโดน" })).toBeLessThan(0);
  });

  it("ค้นหาได้จากชื่อ อำเภอ หรือประเภท โดยไม่สนจุดและช่องว่าง", () => {
    const pcu = list[0];
    expect(matchFacility(pcu, "บ้านควน")).toBe(true);
    expect(matchFacility(pcu, "รพสต")).toBe(true);
    expect(matchFacility(pcu, "เมือง")).toBe(true);
    expect(matchFacility(pcu, "ละงู")).toBe(false);
    expect(matchFacility(pcu, "")).toBe(true);
  });

  it("SQL ORDER BY ใส่ alias ได้", () => {
    expect(facilityOrderSql("hf")).toMatch(/hf\.typecode LIKE 'รพ\.สต%'/);
    expect(facilityOrderSql()).toMatch(/END, district_name, name$/);
  });
});
