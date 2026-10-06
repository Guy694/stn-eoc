import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import DirectiveListEditor, { newItem } from "@/components/eoc/directives/DirectiveListEditor";

function Harness({ initial, onSnapshot }) {
  const [items, setItems] = useState(initial);
  onSnapshot?.(items);
  return <DirectiveListEditor items={items} onChange={setItems} />;
}

describe("DirectiveListEditor", () => {
  it("Enter splits into a new item, Tab indents and Backspace on an empty item removes it", () => {
    let latest = [];
    render(<Harness initial={[newItem({ content: "ฝนตกหนักทีมลงพื้นที่" })]} onSnapshot={(items) => { latest = items; }} />);
    const first = screen.getByRole("textbox", { name: "ข้อ 1" });
    first.setSelectionRange("ฝนตกหนัก".length, "ฝนตกหนัก".length);
    fireEvent.keyDown(first, { key: "Enter" });
    expect(latest.map((item) => item.content)).toEqual(["ฝนตกหนัก", "ทีมลงพื้นที่"]);

    const second = screen.getByRole("textbox", { name: "ข้อ 2" });
    fireEvent.keyDown(second, { key: "Tab" });
    expect(latest[1].level).toBe(1);
    expect(screen.getByRole("textbox", { name: "ข้อ 1.1" })).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("textbox", { name: "ข้อ 1.1" }), { key: "Tab", shiftKey: true });
    expect(latest[1].level).toBe(0);

    fireEvent.change(screen.getByRole("textbox", { name: "ข้อ 2" }), { target: { value: "" } });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "ข้อ 2" }), { key: "Backspace" });
    expect(latest).toHaveLength(1);
  });

  it("marks an item as done and shows read-only numbering", () => {
    let latest = [];
    const { rerender } = render(<Harness initial={[newItem({ content: "ส่งเรือ 2 ลำ" })]} onSnapshot={(items) => { latest = items; }} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(latest[0].status).toBe("done");
    rerender(<DirectiveListEditor readOnly items={[{ ...latest[0] }, newItem({ content: "ย่อย", level: 1 })]} onChange={() => {}} />);
    expect(screen.getByText("1.1.")).toBeInTheDocument();
  });
});
