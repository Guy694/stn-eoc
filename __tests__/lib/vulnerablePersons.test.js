import {
  caseGroup, caseStatus, filterPersons, maskPhone, parseLocation, sortByUrgency, summarizePersons, validatePerson, validateStatusChange
} from "@/lib/vulnerablePersons";

const people = [
  { id: 1, name: "ก", vulnerable_type: "elderly", district: "ละงู", tambon: "กำแพง", status: "waiting", location: { lat: 6.8, lng: 99.8 } },
  { id: 2, name: "ข", vulnerable_type: "bedridden", district: "ละงู", tambon: "กำแพง", status: "waiting", location: null, needs: "ออกซิเจน" },
  { id: 3, name: "ค", vulnerable_type: "disabled", district: "เมืองสตูล", tambon: "พิมาน", status: "arrived", location: { lat: 6.62, lng: 100.07 } },
  { id: 4, name: "ง", vulnerable_type: "pregnant", district: "เมืองสตูล", tambon: "พิมาน", status: "moved", moved_to: "ศูนย์พักพิง" },
  { id: 5, name: "จ", vulnerable_type: "children", district: "ควนโดน", tambon: "ควนโดน", status: "unreachable" }
];

describe("vulnerablePersons", () => {
  it("แบ่งกลุ่มสถานะ จัดการแล้ว/ยังไม่จัดการ", () => {
    expect(caseGroup("waiting")).toBe("pending");
    expect(caseGroup("unreachable")).toBe("pending");
    expect(caseGroup("arrived")).toBe("progress");
    expect(caseGroup("moved")).toBe("done");
    expect(caseStatus("nonsense").key).toBe("waiting");
  });

  it("สรุปจำนวน", () => {
    const summary = summarizePersons(people);
    expect(summary).toMatchObject({ total: 5, withLocation: 2, donePercent: 20 });
    expect(summary.byGroup).toEqual({ pending: 3, progress: 1, done: 1 });
    expect(summary.byType.bedridden).toBe(1);
  });

  it("กรองตามกลุ่ม ประเภท พื้นที่ และคำค้น", () => {
    expect(filterPersons(people, { group: "pending" }).map((p) => p.id)).toEqual([1, 2, 5]);
    expect(filterPersons(people, { type: "bedridden" }).map((p) => p.id)).toEqual([2]);
    expect(filterPersons(people, { district: "เมืองสตูล", status: "moved" }).map((p) => p.id)).toEqual([4]);
    expect(filterPersons(people, { search: "ออกซิเจน" }).map((p) => p.id)).toEqual([2]);
    expect(filterPersons(people, { search: "ศูนย์พัก" }).map((p) => p.id)).toEqual([4]);
  });

  it("เรียงคนที่ต้องไปก่อน: ยังไม่จัดการ + ติดเตียงอยู่บนสุด", () => {
    expect(sortByUrgency(people).map((p) => p.id)).toEqual([2, 1, 5, 3, 4]);
  });

  it("ตรวจพิกัด", () => {
    expect(parseLocation("", "")).toBeNull();
    expect(parseLocation("6.6234567", "100.0712345")).toEqual({ lat: 6.623457, lng: 100.071235 });
    expect(parseLocation("100.07", "6.62").error).toMatch(/สลับ/);
    expect(parseLocation("6.6", "").error).toMatch(/ครบ/);
  });

  it("ตรวจข้อมูลบุคคล", () => {
    expect(validatePerson({ vulnerable_type: "elderly", district: "ละงู", tambon: "กำแพง" }).error).toMatch(/ชื่อ/);
    expect(validatePerson({ name: "ก", vulnerable_type: "xx", district: "ละงู", tambon: "กำแพง" }).error).toMatch(/ประเภท/);
    const ok = validatePerson({ name: "  นาง ก  ", vulnerable_type: "bedridden", district: "ละงู", tambon: "กำแพง", phone: "081-234-5678", lat: "6.8", lng: "99.8" });
    expect(ok.value).toMatchObject({ name: "นาง ก", phone: "0812345678", location: { lat: 6.8, lng: 99.8 }, village: null });
  });

  it("ตรวจการเปลี่ยนสถานะ", () => {
    expect(validateStatusChange({ status: "flying" }).error).toBeTruthy();
    expect(validateStatusChange({ status: "moved" }).error).toMatch(/ไปที่ไหน/);
    expect(validateStatusChange({ status: "arrived", moved_to: "x" }).value).toEqual({ status: "arrived", moved_to: null, moved_shelter_id: null, note: null });
  });

  it("ปิดบังเบอร์", () => {
    expect(maskPhone("0812345678")).toBe("081-xxx-5678");
    expect(maskPhone("")).toBe("");
  });
});
