import { drugNameKey, hospitalPrefix, planHospitalDay } from "@/lib/hospitalDrugPlan";

const H = "EA0010746";
const stock = (code, over = {}) => ({ id: over.id || Number(code.replace(/\D/g, "")), item_code: `${H}:${code}`, item_name: `ยา ${code}`, unit: "เม็ด", balance_qty: 1000, created_day: "2026-10-13", ...over });
const base = { hospCode: H, sessionOpened: "2026-10-13", today: "2026-10-15", inventoryComplete: true };
const byCode = (plan, code) => plan.rows.find((row) => String(row.working_code) === code);

describe("planHospitalDay", () => {
  it("วันแรก: ยาใหม่ทั้งหมดเป็นยอดตั้งต้น และแยกยอดรับในวันนั้นตาม RECEIPT", () => {
    const plan = planHospitalDay({ ...base, onhandDate: "2026-10-13", items: [
      { working_code: "1", name: "Doxycycline 100 mg", unit: "เม็ด", onhand: 1000 },
      { working_code: "2", name: "ORS", unit: "ซอง", onhand: 500, received_on: 200 }
    ] });
    expect(byCode(plan, "1")).toMatchObject({ action: "create", opening: 1000, received: 0, end: 1000 });
    expect(byCode(plan, "2")).toMatchObject({ action: "create", opening: 300, received: 200, end: 500 });
    expect(plan.summary.create).toBe(2);
    expect(plan.blocking).toBeNull();
  });

  it("วันที่ 2: ใช้ไป = ยกมา + รับเข้า − คงคลัง · ยาหายจากไฟล์ครบหน้า = หมด · ยาใหม่เริ่มติดตาม", () => {
    const plan = planHospitalDay({ ...base, onhandDate: "2026-10-14",
      stocks: [stock("1"), stock("2", { balance_qty: 300 }), stock("3", { balance_qty: 40 })],
      items: [
        { working_code: "1", name: "Doxycycline", onhand: 880 },
        { working_code: "2", name: "ORS", onhand: 700, received_on: 500 },
        { working_code: "4", name: "Amoxicillin", onhand: 2000 }
      ] });
    expect(byCode(plan, "1")).toMatchObject({ action: "report", start: 1000, received: 0, used: 120, end: 880, value: { counted_qty: 880 } });
    expect(byCode(plan, "2")).toMatchObject({ action: "report", start: 300, received: 500, used: 100, end: 700 });
    expect(byCode(plan, "3")).toMatchObject({ action: "out", start: 40, used: 40, end: 0 });
    expect(byCode(plan, "4")).toMatchObject({ action: "create", opening: 2000, tracked: false });
    expect(plan.summary).toMatchObject({ report: 2, out: 1, create: 1 });
  });

  it("ยาที่ไม่มียอดคงคลังในไฟล์ INVENTORY ครบหน้า: บันทึกเป็น 0 แทนการข้าม", () => {
    const plan = planHospitalDay({ ...base, onhandDate: "2026-10-14",
      stocks: [stock("1", { balance_qty: 50 })],
      items: [
        { working_code: "1", name: "Doxycycline", onhand: null },
        { working_code: "5", name: "Cetirizine", onhand: null }
      ] });
    expect(byCode(plan, "1")).toMatchObject({ action: "out", zero_filled: true, start: 50, used: 50, end: 0 });
    expect(byCode(plan, "5")).toMatchObject({ action: "create", zero_filled: true, opening: 0, end: 0 });
    expect(plan.summary).toMatchObject({ skip: 0, zero_filled: 2 });
  });

  it("ไฟล์ INVENTORY ไม่ครบหน้า/ไม่มีไฟล์: ยาที่ไม่มียอดยังข้าม", () => {
    const partial = planHospitalDay({ ...base, inventoryComplete: false, onhandDate: "2026-10-14", stocks: [stock("1")], items: [{ working_code: "1", name: "Doxycycline", onhand: null }] });
    expect(byCode(partial, "1")).toMatchObject({ action: "skip" });
    const noInventory = planHospitalDay({ ...base, onhandDate: null, stocks: [stock("1")], items: [{ working_code: "1", name: "Doxycycline", onhand: null }] });
    expect(byCode(noInventory, "1")).toMatchObject({ action: "skip", reason: "ไม่มีไฟล์ INVENTORY" });
  });

  it("ไฟล์ไม่ครบทุกหน้า: ยาที่ไม่อยู่ในไฟล์ยังไม่สรุปว่าหมด", () => {
    const plan = planHospitalDay({ ...base, inventoryComplete: false, onhandDate: "2026-10-14", stocks: [stock("3")], items: [] });
    expect(byCode(plan, "3")).toMatchObject({ action: "missing" });
  });

  it("เจ้าหน้าที่ปรับยอด/เบิกเองในวันนั้นก่อนนำเข้า: คิดใช้ไปจากยอดหลังปรับ (ไม่นับซ้ำ)", () => {
    const plan = planHospitalDay({ ...base, onhandDate: "2026-10-14",
      stocks: [stock("1", { balance_qty: 950 })],
      adjustments: [{ stock_id: 1, day: "2026-10-14", net: -50 }],
      items: [{ working_code: "1", name: "Doxycycline", onhand: 880 }] });
    expect(byCode(plan, "1")).toMatchObject({ action: "report", start: 950, used: 70 });
  });

  it("ปรับยอดหลังวันในไฟล์: ไม่นำมาคิดในวันนั้น", () => {
    const plan = planHospitalDay({ ...base, onhandDate: "2026-10-14",
      stocks: [stock("1", { balance_qty: 980 })],
      adjustments: [{ stock_id: 1, day: "2026-10-15", net: -20 }],
      items: [{ working_code: "1", name: "Doxycycline", onhand: 880 }] });
    expect(byCode(plan, "1")).toMatchObject({ start: 1000, used: 120 });
  });

  it("มีรายงานจากแบบฟอร์มของวันเดียวกัน: แทนที่ และคำนวณจากยอดก่อนรายงานนั้น", () => {
    const plan = planHospitalDay({ ...base, onhandDate: "2026-10-14",
      stocks: [stock("1", { balance_qty: 900 })],
      reports: [{ stock_id: 1, report_date: "2026-10-14", received_qty: 0, used_qty: 100, counted_qty: null, source: "form" }],
      items: [{ working_code: "1", name: "Doxycycline", onhand: 880 }] });
    expect(byCode(plan, "1")).toMatchObject({ action: "report", start: 1000, used: 120, replaces: "form", replaces_label: "แบบฟอร์ม" });
    expect(plan.summary.replaces).toBe(1);
  });

  it("นำเข้าไฟล์เดิมซ้ำ: เท่าเดิม ไม่นับซ้ำ", () => {
    const plan = planHospitalDay({ ...base, onhandDate: "2026-10-14",
      stocks: [stock("1", { balance_qty: 880 })],
      reports: [{ stock_id: 1, report_date: "2026-10-14", received_qty: 0, used_qty: 120, counted_qty: 880, source: "hospital" }],
      items: [{ working_code: "1", name: "Doxycycline", onhand: 880 }] });
    expect(byCode(plan, "1").action).toBe("unchanged");
  });

  it("คงคลังเพิ่มโดยไม่มีใน RECEIPT: นับส่วนต่างเป็นรับเข้า", () => {
    const plan = planHospitalDay({ ...base, onhandDate: "2026-10-14", stocks: [stock("1")], items: [{ working_code: "1", name: "Doxycycline", onhand: 1300 }] });
    expect(byCode(plan, "1")).toMatchObject({ received: 300, used: 0, extra_received: true });
  });

  it("ไฟล์เก่ากว่ารายงานล่าสุด: ห้ามบันทึก", () => {
    const plan = planHospitalDay({ ...base, onhandDate: "2026-10-13",
      stocks: [stock("1", { created_day: "2026-10-12" })],
      reports: [{ stock_id: 1, report_date: "2026-10-14", received_qty: 0, used_qty: 10 }],
      items: [{ working_code: "1", name: "Doxycycline", onhand: 990 }] });
    expect(plan.blocking).toMatch(/เก่ากว่า/);
  });

  it("นำเข้าซ้ำวันเดียวกับวันเริ่มติดตาม (ยังไม่มีความเคลื่อนไหว): แก้ยอดตั้งต้น", () => {
    const plan = planHospitalDay({ ...base, onhandDate: "2026-10-13", stocks: [stock("1")], items: [{ working_code: "1", name: "Doxycycline", onhand: 1100 }] });
    expect(byCode(plan, "1")).toMatchObject({ action: "opening", opening: 1100, before: 1000 });
  });

  it("รายการที่เพิ่มเองผ่านฟอร์ม: ไม่ถูกแตะ และเตือนถ้าน่าจะซ้ำกับยาในไฟล์", () => {
    const plan = planHospitalDay({ ...base, onhandDate: "2026-10-14",
      stocks: [stock("1"), { id: 9, item_code: "DOXYCYCLINE_100", item_name: "ยา Doxycycline 100 mg", unit: "เม็ด", balance_qty: 50, created_day: "2026-10-13" }],
      items: [{ working_code: "1", name: "DOXYCYCLINE CAP 100MG", onhand: 900 }] });
    expect(plan.rows.some((row) => row.stock_id === 9)).toBe(false);
    expect(plan.manual).toEqual([expect.objectContaining({ stock_id: 9, possible_duplicate: "DOXYCYCLINE CAP 100MG" })]);
    expect(plan.summary.duplicates).toBe(1);
  });

  it("ตัวช่วย", () => {
    expect(hospitalPrefix("ea0010746")).toBe("EA0010746:");
    expect(drugNameKey("Doxy-cycline 100 mg")).toBe("doxycycline100mg");
  });
});
