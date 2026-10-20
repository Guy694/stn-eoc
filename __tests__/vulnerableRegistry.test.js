import { mergeRegistry, mooOf, summarizeRegistry } from "@/lib/vulnerableRegistry";

const villages = [
  { distname: "ละงู", subdistnam: "กำแพง", moo: "4", villname: "ควนใหญ่, ตลาดกำแพง" },
  { distname: "ละงู", subdistnam: "กำแพง", moo: "5", villname: "ปิใหญ่" },
  { distname: "ควนกาหลง", subdistnam: "ควนกาหลง", moo: "11", villname: "ปาล์มไทย" }
];
const zero = { elderly: 0, children: 0, disabled: 0, bedridden: 0, pregnant: 0, chronic_illness: 0, psychiatric: 0, dialysis_hd: 0, dialysis_pd: 0 };

test("เลขหมู่จากข้อความ", () => {
  expect(mooOf("หมู่ 11 บ้านปาล์มไทย")).toBe("11");
  expect(mooOf("หมู่ที่ 04")).toBe("4");
  expect(mooOf("บ้านทุ่ง")).toBe("");
});

test("แถวหมู่บ้านที่กรอกเอง: ใช้ค่าที่มากกว่าแยกตามประเภท และจับคู่ชื่อหมู่บ้านกับเลขหมู่", () => {
  const baseline = [{ id: 1, district: "ละงู", tambon: "กำแพง", village: "ควนใหญ่", ...zero, elderly: 20, dialysis_hd: 1 }];
  const persons = [
    { district: "ละงู", tambon: "กำแพง", village: "หมู่ 4 บ้านควนใหญ่", vulnerable_type: "dialysis_hd", count: 3 },
    { district: "ละงู", tambon: "กำแพง", village: "หมู่ 4 บ้านควนใหญ่", vulnerable_type: "bedridden", count: 2 }
  ];
  const [row] = mergeRegistry(baseline, persons, villages);
  expect(row).toMatchObject({ id: 1, elderly: 20, dialysis_hd: 3, bedridden: 2, source: "both", person_total: 5 });
  expect(row.manual_counts).toMatchObject({ elderly: 20, dialysis_hd: 1, bedridden: 0 });
});

test("ไม่มีแถวในทะเบียน: สร้างแถวหมู่บ้านจากรายชื่อ ชื่อหมู่บ้านจากชั้นข้อมูล", () => {
  const rows = mergeRegistry([], [{ district: "ควนกาหลง", tambon: "ควนกาหลง", village: "หมู่ 11 บ้านปาล์มไทย", vulnerable_type: "dialysis_pd", count: 1 }], villages);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ id: null, village: "ปาล์มไทย", moo: "11", dialysis_pd: 1, source: "persons" });
});

test("มีแถวรวมทั้งตำบล/ทั้งอำเภอ: นับเข้าแถวรวม ไม่สร้างแถวหมู่บ้านซ้ำ", () => {
  const baseline = [
    { id: 2, district: "ละงู", tambon: "กำแพง", village: "รวม", ...zero, bedridden: 5 },
    { id: 3, district: "ควนกาหลง", tambon: "รวมทั้งอำเภอ", village: "รวม", ...zero, dialysis_hd: 10 }
  ];
  const persons = [
    { district: "ละงู", tambon: "กำแพง", village: "หมู่ 5 บ้านปิใหญ่", vulnerable_type: "bedridden", count: 7 },
    { district: "ควนกาหลง", tambon: "ควนกาหลง", village: "หมู่ 11", vulnerable_type: "dialysis_hd", count: 4 }
  ];
  const rows = mergeRegistry(baseline, persons, villages);
  expect(rows).toHaveLength(2);
  expect(rows.find((row) => row.id === 2).bedridden).toBe(7);
  expect(rows.find((row) => row.id === 3).dialysis_hd).toBe(10);
  expect(summarizeRegistry(rows)).toMatchObject({ total_bedridden: 7, total_dialysis_hd: 10, grand_total: 17, location_count: 2, person_total: 11 });
});

test("รวมรายชื่อที่หมู่เดียวกันเป็นแถวเดียว และข้ามประเภทที่ไม่รู้จัก", () => {
  const rows = mergeRegistry([], [
    { district: "ละงู", tambon: "กำแพง", village: "หมู่ 5", vulnerable_type: "bedridden", count: 1 },
    { district: "ละงู", tambon: "กำแพง", village: "หมู่ 5 บ้านปิใหญ่", vulnerable_type: "dialysis_hd", count: 2 },
    { district: "ละงู", tambon: "กำแพง", village: "หมู่ 5", vulnerable_type: "unknown", count: 9 }
  ], villages);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ village: "ปิใหญ่", bedridden: 1, dialysis_hd: 2, person_total: 3 });
});
