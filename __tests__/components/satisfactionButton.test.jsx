import { fireEvent, render, screen, waitFor } from "@testing-library/react";
jest.mock("next/navigation", () => ({ usePathname: () => "/public/my-risk/" }));
import SatisfactionButton from "@/components/common/SatisfactionButton";

beforeEach(() => {
  window.localStorage.clear();
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ success: true }) }));
});

test("ต้องเลือกดาวก่อนส่ง ข้อเสนอแนะไม่บังคับ แล้วส่งพร้อมหน้าที่ประเมิน", async () => {
  render(<SatisfactionButton />);
  fireEvent.click(screen.getByRole("button", { name: /ประเมินความพึงพอใจ/ }));
  fireEvent.click(await screen.findByRole("button", { name: "ส่งการประเมิน" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("กรุณาเลือกจำนวนดาว");
  expect(global.fetch).not.toHaveBeenCalled();

  fireEvent.click(screen.getByLabelText(/4 ดาว/));
  fireEvent.click(screen.getByRole("button", { name: "ส่งการประเมิน" }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ rating: 4, comment: "", path: "/public/my-risk/" });
  expect(await screen.findByText(/บันทึกคะแนน 4 ดาว/)).toBeInTheDocument();
  expect(JSON.parse(window.localStorage.getItem("stn-eoc:satisfaction")).rating).toBe(4);
});
