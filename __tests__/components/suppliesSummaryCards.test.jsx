import { fireEvent, render, screen } from "@testing-library/react";
import { DashboardSummary, StockSummary } from "@/components/eoc/supplies/SuppliesSummaryCards";

const dashSummary = { items: 12, facilities: 5, stock_rows: 60, out: 3, low: 6, critical_cover: 2, warning_cover: 4, discrepancies: 0, lots: 10, expired: 1, expiring_90: 2, expiring_180: 3 };
const reporting = { today: { complete: 3, partial: 1, missing: 1, total: 5 } };

describe("SuppliesSummaryCards", () => {
  it("ภาพรวม: แสดงการส่งรายงานวันนี้และการ์ดสัญญาณ", () => {
    render(<DashboardSummary summary={dashSummary} reporting={reporting} today="2026-10-16" />);
    expect(screen.getByText("3/5")).toBeInTheDocument();
    expect(screen.getByText("60% ของหน่วยบริการ")).toBeInTheDocument();
    expect(screen.getByText("หมดคลัง")).toBeInTheDocument();
    expect(screen.getByText("ต้องเติม")).toBeInTheDocument();
    expect(screen.getByText("อีก 4 รายการพอใช้ 3–7 วัน")).toBeInTheDocument();
    expect(screen.getByText("ล็อตหมดอายุ / ใน 3 เดือน")).toBeInTheDocument();
    expect(screen.getByText("ยอดนับตรงกับที่ระบบคำนวณ")).toBeInTheDocument();
  });

  it("ภาพรวม: ไม่มีล็อตยา → ไม่แสดงการ์ดวันหมดอายุ", () => {
    render(<DashboardSummary summary={{ ...dashSummary, lots: 0 }} reporting={reporting} today="2026-10-16" />);
    expect(screen.queryByText("ล็อตหมดอายุ / ใน 3 เดือน")).not.toBeInTheDocument();
  });

  it("คงคลัง: กดการ์ดสถานะเพื่อกรอง และกดซ้ำเพื่อยกเลิก", () => {
    const onFilter = jest.fn();
    const summary = { rows: 20, items: 8, agencies: 3, out: 2, low: 3, unknown: 5 };
    const { rerender } = render(<StockSummary summary={summary} levelFilter="" onFilter={onFilter} />);
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(onFilter).toHaveBeenLastCalledWith("out");
    rerender(<StockSummary summary={summary} levelFilter="out" onFilter={onFilter} />);
    const outCard = screen.getAllByRole("button")[0];
    expect(outCard).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(outCard);
    expect(onFilter).toHaveBeenLastCalledWith("");
    // พอใช้ = 20 - 2 - 3 - 5 = 10 → 50%
    expect(screen.getAllByRole("button")[2]).toHaveTextContent("50%");
  });
});
