import { fireEvent, render, screen } from "@testing-library/react";
import { DataTable, pageNumbers } from "@/components/admin/crud";

describe("pageNumbers", () => {
  it("ย่อเลขหน้าเมื่อมีหลายหน้า", () => {
    expect(pageNumbers(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageNumbers(1, 12)).toEqual([1, 2, 3, 4, "…", 12]);
    expect(pageNumbers(6, 12)).toEqual([1, "…", 5, 6, 7, "…", 12]);
    expect(pageNumbers(12, 12)).toEqual([1, "…", 9, 10, 11, 12]);
  });
});

describe("DataTable pagination", () => {
  const rows = Array.from({ length: 45 }, (_, index) => ({ id: index + 1, name: `คนที่ ${index + 1}` }));
  const columns = [{ key: "name", label: "ชื่อ" }];

  it("กดเลขหน้าและเปลี่ยนจำนวนต่อหน้าได้", () => {
    render(<DataTable columns={columns} rows={rows} pageSize={20} pageSizeOptions={[20, 50]} />);
    expect(screen.getByText(/1–20 จาก 45/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "หน้า 3" }));
    expect(screen.getByText(/41–45 จาก 45/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("จำนวนแถวต่อหน้า"), { target: { value: "50" } });
    expect(screen.getByText(/1–45 จาก 45/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "หน้า 2" })).toBeNull();
  });
});
