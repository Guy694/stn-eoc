import { fireEvent, render, screen } from "@testing-library/react";
import { RowActions } from "@/components/admin/crud";

test("ปุ่มแก้ไข/ลบท้ายแถวเป็นไอคอน แต่ยังมีชื่อปุ่มให้โปรแกรมอ่านจอและ tooltip", () => {
  const onEdit = jest.fn();
  const onDelete = jest.fn();
  render(<RowActions onEdit={onEdit} onDelete={onDelete} itemName="รพ.สตูล" />);
  const edit = screen.getByRole("button", { name: "แก้ไข รพ.สตูล" });
  const remove = screen.getByRole("button", { name: "ลบ รพ.สตูล" });
  expect(edit).toHaveAttribute("title", "แก้ไข รพ.สตูล");
  expect(edit.textContent).toBe("");
  fireEvent.click(edit);
  fireEvent.click(remove);
  expect(onEdit).toHaveBeenCalled();
  expect(onDelete).toHaveBeenCalled();
});
