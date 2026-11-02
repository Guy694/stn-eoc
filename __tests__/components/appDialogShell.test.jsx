/** @jest-environment jsdom */
// หน้าต่างแบบออกแบบเอง (popup ประกาศ เตือนภัยด่วน ภาพเต็มจอ) ใช้พฤติกรรมเดียวกับ AppDialog: role, Esc ปิด, focus เริ่มที่ปุ่มที่กำหนด
import { useRef } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { AppDialogShell } from "@/components/ui/app-dialog";
import ImageLightbox from "@/components/ui/image-lightbox";

function Shell({ onOpenChange, alert = false }) {
  const ackRef = useRef(null);
  return (
    <AppDialogShell open alert={alert} onOpenChange={onOpenChange} initialFocus={ackRef} aria-labelledby="t">
      <h2 id="t">[ทดสอบ] เตือนภัย</h2>
      <button type="button">ลิงก์อื่น</button>
      <button ref={ackRef} type="button">รับทราบ</button>
    </AppDialogShell>
  );
}

test("dialog ทั่วไป: role=dialog มีชื่อจากหัวข้อ focus ที่ปุ่มที่กำหนด และ Esc ปิด", async () => {
  const onOpenChange = jest.fn();
  render(<Shell onOpenChange={onOpenChange} />);
  const dialog = await screen.findByRole("dialog", { name: "[ทดสอบ] เตือนภัย" });
  expect(dialog).toBeTruthy();
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "รับทราบ" }));
  await act(async () => { fireEvent.keyDown(document.activeElement, { key: "Escape" }); });
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

test("เตือนภัยด่วน (alert): role=alertdialog", async () => {
  render(<Shell alert onOpenChange={jest.fn()} />);
  expect(await screen.findByRole("alertdialog", { name: "[ทดสอบ] เตือนภัย" })).toBeTruthy();
});

test("ภาพเต็มจอ: แสดงภาพและปุ่มปิด กดปิดแล้วแจ้ง onOpenChange(false)", async () => {
  const onOpenChange = jest.fn();
  render(<ImageLightbox open onOpenChange={onOpenChange} src="/stn-eoc/img/flood.png" alt="[ทดสอบ] ภาพประกาศ" />);
  expect(await screen.findByRole("dialog", { name: "ดูภาพเต็มจอ" })).toBeTruthy();
  expect(screen.getByAltText("[ทดสอบ] ภาพประกาศ")).toBeTruthy();
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "ปิดภาพ" })); });
  expect(onOpenChange).toHaveBeenCalledWith(false);
});
