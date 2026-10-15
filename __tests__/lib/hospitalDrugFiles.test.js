/**
 * @jest-environment node
 */
import {
  buildImportPayload, daysInPeriod, decodeHospitalFile, expiryStatus, isEssentialDrug, mergeHospitalFiles, parseHospitalFile, periodLabel, ymdToIso
} from "@/lib/hospitalDrugFiles";
import { hospitalItemCode, sanitizeItems } from "@/lib/hospitalDrugImportServer";
import { usageBaseline } from "@/lib/medicalDailyServer";

jest.mock("@/lib/db", () => ({ query: jest.fn(), transaction: jest.fn(), getPool: jest.fn() }));
jest.mock("@/lib/eocAlertRunner", () => ({ triggerEventAlerts: jest.fn() }));
jest.mock("@/lib/recordArchive", () => ({ recordChange: jest.fn() }));
jest.mock("@/lib/imports/server", () => ({ ImportError: class ImportError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }, prepareSuppliesImport: jest.fn() }));

const paged = (content, { page = 0, totalPages = 1, totalElements = content.length } = {}) => JSON.stringify({ content, number: page, totalPages, totalElements, pageable: { pageNumber: page } });
const H = "EA0010746";
const druglist = paged([
  { WORKING_CODE: "1000530", HOSP_CODE: H, PERIOD_RPT: "202508", BASE_UNIT: "cap", GENERIC_NAME: "AMOXYCILLIN CAP 500MG", NLEM: "E" },
  { WORKING_CODE: "1000131", HOSP_CODE: H, PERIOD_RPT: "202508", BASE_UNIT: "��", GENERIC_NAME: "Acetylcysteine 600mg/��", NLEM: "N" }
]);
const inventory = paged([
  { DATE_ONHAND: "20251003", EXPIRE_DATE: "20271206", WORKING_CODE: "1000530", HOSP_CODE: H, TRADE_NAME: "AMOXYCILLIN CAP 500MG", PACK_SIZE: 1, BASE_UNIT: "cap", QTY_ONHAND: 10000, PACK_COST: 1.2, VALUE_ONHAND: 12000, LOT_NO: "A1" },
  { DATE_ONHAND: "20251003", EXPIRE_DATE: "20251201", WORKING_CODE: "1000530", HOSP_CODE: H, TRADE_NAME: "AMOXYCILLIN CAP 500MG", PACK_SIZE: 1, BASE_UNIT: "cap", QTY_ONHAND: 500, PACK_COST: 1.2, VALUE_ONHAND: 600, LOT_NO: "A0" },
  { DATE_ONHAND: "20251003", EXPIRE_DATE: "20280623", WORKING_CODE: "1000131", HOSP_CODE: H, TRADE_NAME: "Mucotic HD", PACK_SIZE: 1, BASE_UNIT: "��", QTY_ONHAND: 2900, VALUE_ONHAND: 16880.32, LOT_NO: "75-300" }
], { totalPages: 2, totalElements: 30 });
const receipt = paged([
  { EXPIRE_DATE: "20280603", DATE_RCV: "20250801", WORKING_CODE: "1000131", HOSP_CODE: H, PERIOD_RPT: "202508", TRADE_NAME: "Mucotic HD", PACK_SIZE: 50, QTY_RCV: 60, TOTAL_VALUE: 17462.4, LOT_NO: "75-296" },
  { EXPIRE_DATE: "20280623", DATE_RCV: "20250815", WORKING_CODE: "1000131", HOSP_CODE: H, PERIOD_RPT: "202508", TRADE_NAME: "Mucotic HD", PACK_SIZE: 50, QTY_RCV: 80, TOTAL_VALUE: 23283.2, LOT_NO: "75-300" }
]);
const distribution = paged([
  { WORKING_CODE: "1000131", HOSP_CODE: H, DIS_DEPT_GROUP: "2", PERIOD_RPT: "202508", TRADE_NAME: "Mucotic HD", QTY_DIS: 21, PACK_SIZE: 50, VALUE: 6111.84 },
  { WORKING_CODE: "1000131", HOSP_CODE: H, DIS_DEPT_GROUP: "3", PERIOD_RPT: "202508", TRADE_NAME: "Mucotic HD", QTY_DIS: 20, PACK_SIZE: 50, VALUE: 5820.8 }
]);

describe("ถอดไฟล์และอ่านชนิด", () => {
  it("UTF-8 และ TIS-620", () => {
    expect(decodeHospitalFile(new TextEncoder().encode("{\"a\":\"ยา\"}"))).toMatchObject({ encoding: "utf-8", garbled: false });
    const tis = new Uint8Array([0x7b, 0x22, 0x61, 0x22, 0x3a, 0x22, 0xc2, 0xd2, 0x22, 0x7d]); // {"a":"ยา"} แบบ TIS-620
    const decoded = decodeHospitalFile(tis);
    expect(decoded.encoding).toBe("tis-620");
    expect(JSON.parse(decoded.text).a).toBe("ยา");
  });
  it("รู้ชนิดไฟล์จากคอลัมน์ และคูณขนาดแพ็ก", () => {
    expect(parseHospitalFile(druglist, "a.txt").kind).toBe("DRUGLIST");
    const rec = parseHospitalFile(receipt, "b.txt");
    expect(rec.kind).toBe("RECEIPT");
    expect(rec.rows[0]).toMatchObject({ qty: 3000, period: "202508", expire_date: "2028-06-03" });
    expect(parseHospitalFile(distribution, "c.txt").rows[1].qty).toBe(1000);
    expect(parseHospitalFile("{bad", "x.txt").error).toBeTruthy();
    expect(parseHospitalFile(JSON.stringify([{ X: 1 }]), "x.txt").error).toMatch(/ไม่รู้จักชนิดไฟล์/);
  });
});

describe("mergeHospitalFiles", () => {
  const files = [
    parseHospitalFile(druglist, "Download_DRUGLIST.txt"),
    parseHospitalFile(inventory, "Download_INVENTORY.txt"),
    parseHospitalFile(inventory, "Download_INVENTORY (1).txt"),
    parseHospitalFile(receipt, "Download_RECEIPT.txt"),
    parseHospitalFile(distribution, "Download_DISTRIBUTION.txt")
  ];
  const merged = mergeHospitalFiles(files);

  it("รวมยอดคงคลังรายล็อต ชื่อ หน่วย และยอดรายเดือน", () => {
    const amox = merged.items.find((item) => item.working_code === "1000530");
    expect(amox).toMatchObject({ name: "AMOXYCILLIN CAP 500MG", unit: "cap", onhand: 10500, nearest_expiry: "2025-12-01", essential: true, nlem: "E" });
    const muco = merged.items.find((item) => item.working_code === "1000131");
    expect(muco).toMatchObject({ name: "Mucotic HD", unit: "หน่วย", unit_garbled: true, onhand: 2900 });
    expect(muco.usage[0]).toMatchObject({ period: "202508", used: 2050, received: 7000, days: 31, avg_daily: 66.13 });
  });
  it("เตือนหน้าซ้ำ หน้าไม่ครบ และภาษาไทยเสีย", () => {
    expect(merged.hospCode).toBe(H);
    expect(merged.onhandDate).toBe("2025-10-03");
    expect(merged.warnings.join("\n")).toMatch(/ซ้ำกับ Download_INVENTORY.txt/);
    expect(merged.warnings.join("\n")).toMatch(/ได้ 1 จาก 2 หน้า/);
    expect(merged.warnings.join("\n")).toMatch(/ภาษาไทยในไฟล์เสียหาย/);
    expect(merged.kinds.find((kind) => kind.kind === "INVENTORY")).toMatchObject({ partial: true, files: 1 });
  });
  it("ข้อมูลที่ส่งบันทึกมีเฉพาะรายการที่เลือก", () => {
    const payload = buildImportPayload(merged, ["1000530"]);
    expect(payload).toHaveLength(1);
    expect(payload[0].lots).toHaveLength(2);
  });
});

describe("ฝั่งเซิร์ฟเวอร์และตัวช่วย", () => {
  it("รหัสรายการแยกตามโรงพยาบาล", () => {
    expect(hospitalItemCode("EA0010746", "1000530")).toBe("EA0010746:1000530");
  });
  it("ตรวจข้อมูลที่ส่งมา", () => {
    const clean = sanitizeItems([
      { working_code: "1", name: "ยา ก", unit: "", onhand: "-5", lots: [{ lot_no: "L", expire_date: "2027-01-01", qty: 3 }, { expire_date: "bad", qty: -1 }], usage: [{ period: "202508", used: 31 }, { period: "x" }] },
      { working_code: "1", name: "ซ้ำ" },
      { working_code: "", name: "ไม่มีรหัส" }
    ]);
    expect(clean).toHaveLength(1);
    expect(clean[0]).toMatchObject({ unit: "หน่วย", onhand: null });
    expect(clean[0].lots[1]).toMatchObject({ expire_date: null, qty: 0 });
    expect(clean[0].usage).toHaveLength(1);
    expect(() => sanitizeItems([])).toThrow(/ยังไม่ได้เลือก/);
  });
  it("อัตราใช้ปกติจากเดือนล่าสุดที่มีการจ่าย", () => {
    expect(usageBaseline([{ period: "202509", used_qty: 0, days_in_period: 30 }, { period: "202508", used_qty: "310", days_in_period: 31 }])).toEqual({ period: "202508", used: 310, days: 31, avg_daily: 10 });
    expect(usageBaseline([])).toBeNull();
  });
  it("วันหมดอายุ วันที่ และชื่อเดือน", () => {
    expect(expiryStatus("2026-10-01", "2026-10-15").key).toBe("expired");
    expect(expiryStatus("2026-12-01", "2026-10-15").key).toBe("within90");
    expect(expiryStatus("2027-03-01", "2026-10-15").key).toBe("within180");
    expect(expiryStatus("2028-03-01", "2026-10-15").key).toBe("ok");
    expect(ymdToIso("20251003143334")).toBe("2025-10-03");
    expect(daysInPeriod("202402")).toBe(29);
    expect(periodLabel("202508")).toBe("ส.ค. 2568");
    expect(isEssentialDrug("Povidone iodine sol 10%")).toBe(true);
    expect(isEssentialDrug("Actilyse 50 mg")).toBe(false);
  });
});
