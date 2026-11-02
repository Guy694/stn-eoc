/** @jest-environment jsdom */
import { act, fireEvent, render, screen } from "@testing-library/react";
import ConfirmHost from "@/components/providers/ConfirmHost";
import { hasConfirmHost, requestConfirm } from "@/lib/confirmDialog";
import { showDeleteConfirm } from "@/lib/feedback";

test("ยังไม่มี ConfirmHost: คำขอรอในคิว แล้วแสดงเมื่อ ConfirmHost พร้อม (ไม่มีหน้าต่างแบบอื่นสำรอง)", async () => {
  expect(hasConfirmHost()).toBe(false);
  let answer;
  showDeleteConfirm("ลบไหม").then((v) => { answer = v; });
  render(<ConfirmHost />);
  expect(await screen.findByText("ลบไหม")).toBeTruthy();
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "ลบ" })); });
  expect(answer).toBe(true);
});

test("มี ConfirmHost: แสดงหน้าต่างของระบบ กดลบ → true, กดยกเลิก → false", async () => {
  render(<ConfirmHost />);
  expect(hasConfirmHost()).toBe(true);
  let answer;
  act(() => { showDeleteConfirm("ต้องการลบ [ทดสอบ] ศูนย์ A หรือไม่").then((v) => { answer = v; }); });
  expect(await screen.findByText("ต้องการลบ [ทดสอบ] ศูนย์ A หรือไม่")).toBeTruthy();
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "ลบ" })); });
  expect(answer).toBe(true);

  let second;
  act(() => { requestConfirm({ title: "ยืนยัน", message: "ไปต่อไหม", tone: "primary" }).then((v) => { second = v; }); });
  await screen.findByText("ไปต่อไหม");
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "ยกเลิก" })); });
  expect(second).toBe(false);
});
