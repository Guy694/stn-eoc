// แจ้งผลการทำงานผ่าน toast จุดเดียว: ข้อความว่างไม่แสดง และข้อความซ้ำใช้ id เดียวกัน (ไม่ซ้อนหลายใบ)
jest.mock("sonner", () => {
  const toast = jest.fn();
  toast.success = jest.fn(); toast.error = jest.fn(); toast.warning = jest.fn(); toast.info = jest.fn();
  return { toast };
});
const { toast } = require("sonner");
const { notify } = require("@/lib/notify");
const { showSuccess, showError } = require("@/lib/sweetAlert");

test("ข้อความว่างไม่แสดง", () => {
  notify.error("  ");
  expect(toast.error).not.toHaveBeenCalled();
});

test("ข้อความเดียวกันใช้ id เดียวกัน · error แสดงนานกว่า success", () => {
  notify.error("[ทดสอบ] บันทึกไม่สำเร็จ");
  notify.error("[ทดสอบ] บันทึกไม่สำเร็จ");
  const [first, second] = toast.error.mock.calls;
  expect(first[1].id).toBe(second[1].id);
  notify.success("[ทดสอบ] บันทึกแล้ว");
  expect(toast.error.mock.calls[0][1].duration).toBeGreaterThan(toast.success.mock.calls[0][1].duration);
});

test("showSuccess/showError เดิมส่งไปที่เดียวกัน", () => {
  showSuccess("[ทดสอบ] เพิ่มแล้ว");
  showError("[ทดสอบ] ลบไม่สำเร็จ");
  expect(toast.success).toHaveBeenCalledWith("[ทดสอบ] เพิ่มแล้ว", expect.objectContaining({ id: "success:[ทดสอบ] เพิ่มแล้ว" }));
  expect(toast.error).toHaveBeenCalledWith("[ทดสอบ] ลบไม่สำเร็จ", expect.any(Object));
});
