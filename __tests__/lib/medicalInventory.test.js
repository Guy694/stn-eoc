import { applyMovement, normalizeItemCode, stockLevel, summarizeStock } from "@/lib/medicalInventory";

describe("medicalInventory", () => {
  it("classifies stock level", () => {
    expect(stockLevel({ opening_qty: 100, received_qty: 0, balance_qty: 0 })).toBe("out");
    expect(stockLevel({ opening_qty: 100, received_qty: 0, balance_qty: 10 })).toBe("low");
    expect(stockLevel({ opening_qty: 100, received_qty: 50, balance_qty: 80 })).toBe("ok");
    expect(stockLevel({ data_status: "not_recorded", balance_qty: 0 })).toBe("unknown");
  });

  it("summarises rows", () => {
    const summary = summarizeStock([
      { item_code: "A", health_facility_id: 1, opening_qty: 10, balance_qty: 0, issued_qty: 10 },
      { item_code: "A", health_facility_id: 2, opening_qty: 10, balance_qty: 1 },
      { item_code: "B", health_facility_id: 2, opening_qty: 10, balance_qty: 10, received_qty: 5 }
    ]);
    expect(summary).toMatchObject({ rows: 3, items: 2, agencies: 2, out: 1, low: 1, issued_qty: 10, received_qty: 5, balance_qty: 11 });
  });

  it("applies receive, issue and adjust", () => {
    const stock = { received_qty: 5, issued_qty: 2, balance_qty: 20, unit: "กล่อง" };
    expect(applyMovement(stock, "receive", 10)).toMatchObject({ ok: true, before: 20, after: 30, next: { received_qty: 15 } });
    expect(applyMovement(stock, "issue", 20)).toMatchObject({ ok: true, after: 0, next: { issued_qty: 22 } });
    expect(applyMovement(stock, "issue", 21).error).toContain("ไม่เกินยอดคงเหลือ (20 กล่อง)");
    expect(applyMovement(stock, "adjust", 15)).toMatchObject({ ok: true, after: 15, movementQty: 5 });
    expect(applyMovement(stock, "adjust", 0)).toMatchObject({ ok: true, after: 0 });
    expect(applyMovement(stock, "receive", 0).ok).toBe(false);
    expect(applyMovement(stock, "steal", 1).ok).toBe(false);
  });

  it("normalises item codes", () => {
    expect(normalizeItemCode("", "ors powder")).toBe("ORS_POWDER");
    expect(normalizeItemCode(" para 500 ", "x")).toBe("PARA_500");
  });
});
