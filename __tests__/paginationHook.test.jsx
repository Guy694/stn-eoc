import { act, fireEvent, render, screen } from "@testing-library/react";
import PaginationControls, { usePagination } from "@/components/common/PaginationControls";

function List({ rows, resetKey = "" }) {
  const { anchor, ...paged } = usePagination(rows, { pageSize: 10, resetKey });
  return (
    <div>
      <ul ref={anchor}>{paged.visible.map((n) => <li key={n}>แถว {n}</li>)}</ul>
      <span data-testid="page-of-25">{paged.pageOfIndex(24)}</span>
      <PaginationControls {...paged.controls} pageSizeOptions={[10, 20]} />
    </div>
  );
}

const rows = Array.from({ length: 25 }, (_, i) => i + 1);

describe("usePagination", () => {
  test("แสดงทีละหน้า และเลื่อนหน้าได้", () => {
    render(<List rows={rows} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(10);
    expect(screen.getByText("แถว 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "สุดท้าย" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByText("แถว 25")).toBeInTheDocument();
    expect(screen.getByTestId("page-of-25")).toHaveTextContent("3");
  });

  test("เปลี่ยนตัวกรองแล้วกลับไปหน้า 1", () => {
    const { rerender } = render(<List rows={rows} resetKey="a" />);
    fireEvent.click(screen.getByRole("button", { name: "ถัดไป" }));
    expect(screen.getByText("แถว 11")).toBeInTheDocument();
    act(() => { rerender(<List rows={rows} resetKey="b" />); });
    expect(screen.getByText("แถว 1")).toBeInTheDocument();
  });

  test("รายการน้อยกว่าหน้าเดียว: ไม่แสดงตัวเลือกหน้า", () => {
    render(<List rows={rows.slice(0, 8)} />);
    expect(screen.queryByRole("navigation", { name: "เลือกหน้า" })).toBeNull();
  });

  test("แบบกะทัดรัดมีแค่ก่อนหน้า/ถัดไป", () => {
    const onPageChange = jest.fn();
    render(<PaginationControls page={2} pageSize={30} totalItems={75} pageSizeOptions={[30]} onPageChange={onPageChange} compact />);
    expect(screen.queryByRole("button", { name: "แรก" })).toBeNull();
    expect(screen.getByText("หน้า 2/3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ถัดไป" }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});
