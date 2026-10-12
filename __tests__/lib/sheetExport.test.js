import fs from "fs";
import { buildSheetExport, makeTable } from "@/lib/sheetExport";
import { buildXlsx, columnName, safeSheetNames } from "@/lib/xlsxWriter";

const sample = {
  eventLabel: "อุทกภัย ครั้งที่ 9 [ทดสอบ]",
  date: "2026-10-11",
  startDate: "2026-10-01",
  vulnerableBaseline: [{ district: "ละงู", pregnant: 10, bedridden: 5, dialysis_hd: 2, dialysis_pd: 1 }],
  vulnerableEvent: [{ district: "อ.ละงู", pregnant: 3, bedridden: 2, dialysis_hd: 1, cared_count: 4, moved_count: 1 }],
  polygons: [{ district: "ละงู", tambon: "ก", village: "1" }, { district: "ละงู", tambon: "ข", village: "2" }],
  floodRows: [{ district: "ละงู", tambon: "ก", village: "1", date: "2026-10-10", level: "สูง", households: 40 }, { district: "ละงู", tambon: "ก", village: "1", date: "2026-10-11", level: "ต่ำ", households: 30 }],
  affected: [{ district: "ละงู", citizen_injured: 2, evacuated: 50 }],
  facilities: [{ district_name: "ละงู", name: "รพ.ละงู", level: "hospital", flood_status: "access_cut" }, { district_name: "ละงู", name: "รพ.สต.ก", level: "primary", service_status: "closed" }],
  teamReports: [
    { report_type: "mcatt", report_date: "2026-10-11", district_name: "ละงู", metrics: { home_visits: 7, stress_high: 1 } },
    { report_type: "mcatt", report_date: "2026-10-10", district_name: "ละงู", metrics: { home_visits: 3 } },
    { report_type: "mert", report_date: "2026-10-11", district_name: "มะนัง", metrics: { mert_teams: 1, served: 4 }, area_note: "ต.ปาล์มพัฒนา" },
    { report_type: "doxy", report_date: "2026-10-11", district_name: "มะนัง", metrics: { at_risk: 20, doxy_new: 5 }, area_note: "รพ.สต.บ้านมะนัง" },
    { report_type: "resources", report_date: "2026-10-09", district_name: "ละงู", metrics: { relief_kits: 100, boots: 20 } }
  ],
  stock: [{ agency_name: "รพ.ละงู", item_code: "FLOOD_RELIEF_KIT", opening_qty: 10, received_qty: 5, issued_qty: 3, balance_qty: 12 }, { agency_name: "รพ.ละงู", item_code: "LIFE_JACKET", balance_qty: 4 }],
  oxygen: [{ facility_name: "รพ.ละงู", report_date: "2026-10-11", tank_qty: "600", tank_use_per_day: "200", procurement_problem: 1, problem_note: "ถนนขาด" }],
  diseaseCommunity: [{ district: "ละงู", disease: "ทางเดินอาหาร", date: "2026-10-11", cases: 2 }, { district: "ละงู", disease: "ทางเดินอาหาร", date: "2026-10-09", cases: 3 }],
  diseaseShelter: [{ district: "มะนัง", disease: "ไข้หวัดใหญ่", date: "2026-10-11", cases: 1 }],
  shelters: [{ sheltername: "โรงเรียน ก", district_name: "อ.ละงู", tambon: "ก", shelter_capacity: 200, occupancy: 80, active: 1 }]
};

const find = (sheet, label) => sheet.rows.find((row) => (row?.[0]?.v ?? row?.[0]) === label);

describe("sheetExport", () => {
  test("columnName and sheet names", () => {
    expect(columnName(0)).toBe("A");
    expect(columnName(25)).toBe("Z");
    expect(columnName(27)).toBe("AB");
    expect(safeSheetNames(["a/b", "a/b", "x".repeat(40)])).toEqual(["a b", "a b 2", "x".repeat(31)]);
  });

  test("makeTable merges header cells", () => {
    const table = makeTable({ name: "t", title: "T", subtitle: "S", header: [[{ label: "A", rowSpan: 2 }, { label: "B", span: 2 }], [{ label: "b1" }, { label: "b2" }]], rows: [["x", 1, 2]] });
    expect(table.merges).toEqual(["A3:A4", "B3:C3"]);
    expect(table.freezeRows).toBe(4);
  });

  test("builds all 14 sheets with expected numbers", () => {
    const sheets = buildSheetExport(sample);
    expect(sheets).toHaveLength(14);
    const vuln = sheets[0];
    const lagu = find(vuln, "ละงู");
    expect(lagu.slice(1, 4)).toEqual([10, 3, null]); // ตั้งครรภ์ ทั้งหมด/กระทบ/ดูแล
    expect(lagu[16]).toBe(3); // ฟอกไต ทั้งหมด (HD+PD)
    const area = find(sheets[1], "ละงู");
    expect(area.slice(1, 6)).toEqual([2, 1, 2, 1, 40]);
    expect(area.slice(7, 10)).toEqual([0, 1, 0]); // คลี่คลาย
    const facility = find(sheets[3], "ละงู");
    expect(facility.slice(1, 8)).toEqual([1, 1, 0, 1, 0, 0, 1]);
    const mcatt = sheets[4];
    expect(find(mcatt, "ละงู")[3]).toBe(7);
    expect(find(mcatt, "มะนัง")[3]).toBeNull();
    expect(find(mcatt, "สะสมทั้งเหตุการณ์")[3].v).toBe(10);
    expect(find(sheets[13], "มะนัง")[4]).toBe("ต.ปาล์มพัฒนา");
    expect(find(sheets[7], 1)?.[2] ?? sheets[7].rows.find((row) => row[1] === "รพ.ละงู")[2]).toBe(10);
    const oxygen = sheets[9].rows.find((row) => row[1] === "รพ.ละงู");
    expect(oxygen[4]).toBe(3);
    expect(oxygen[12]).toBe("/");
    expect(find(sheets[6], "ทางเดินอาหาร").slice(-2)).toEqual([2, 5]);
    expect(sheets[11].rows.some((row) => row[0] === "รพ.สต.บ้านมะนัง" && row[3] === 5)).toBe(true);
  });

  test("writes a valid zip", () => {
    const buffer = buildXlsx(buildSheetExport(sample));
    expect(buffer.slice(0, 2).toString()).toBe("PK");
    if (process.env.XLSX_OUT) fs.writeFileSync(process.env.XLSX_OUT, buffer);
  });
});
