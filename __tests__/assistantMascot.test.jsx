import { act, fireEvent, render, screen } from "@testing-library/react";
import AssistantMascot from "@/components/public/AssistantMascot";

test("กดน้องสจ๊วตแล้วเปิดหน้าต่างถาม · ซ่อนได้ · ทักทายครั้งเดียวต่อแท็บ", async () => {
  jest.useFakeTimers();
  window.sessionStorage.clear();
  const onOpen = jest.fn();
  const onHide = jest.fn();
  const { unmount } = render(<AssistantMascot onOpen={onOpen} onHide={onHide} />);
  await act(async () => { jest.advanceTimersByTime(2000); });
  expect(screen.getByText("มีอะไรให้ช่วยไหมครับ")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /น้องสจ๊วต ผู้ช่วยของคุณ/ }));
  expect(onOpen).toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /ซ่อนน้องสจ๊วต/ }));
  expect(onHide).toHaveBeenCalled();
  unmount();
  render(<AssistantMascot onOpen={onOpen} />);
  await act(async () => { jest.advanceTimersByTime(2000); });
  expect(screen.queryByText("มีอะไรให้ช่วยไหมครับ")).toBeNull();
  jest.useRealTimers();
});
