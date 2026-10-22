import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { OfficerMultiPicker, OfficerPicker } from "@/components/admin/OfficerPicker";

const officers = [
  { id: 1, given_name: "สมชาย", family_name: "ใจดี", position: "พยาบาลวิชาชีพ", department: "รพ.ละงู", role: "MCATT", username: "somchai" },
  { id: 2, given_name: "สมหญิง", family_name: "รักงาน", position: "นักวิชาการสาธารณสุข", department: "สสจ.สตูล", role: "SAT", username: "somying" },
  { id: 3, given_name: "อนุชา", family_name: "ทองดี", position: "แพทย์", department: "รพ.สตูล", role: "SEhRT", username: "anucha" }
];

function MultiHarness({ initial = [], exclude = [] }) {
  const [value, setValue] = useState(initial);
  return <OfficerMultiPicker options={officers} value={value} onChange={setValue} exclude={exclude} ariaLabel="ค้นหาสมาชิก" />;
}

describe("OfficerPicker", () => {
  it("filters by any part of name, position or department and picks with Enter", () => {
    const onChange = jest.fn();
    render(<OfficerPicker options={officers} value="" onChange={onChange} ariaLabel="ค้นหาหัวหน้า" />);
    const input = screen.getByRole("combobox", { name: "ค้นหาหัวหน้า" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "สสจ" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option")).toHaveTextContent("สมหญิง รักงาน");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("2");
  });

  it("shows an empty message when nothing matches", () => {
    render(<OfficerPicker options={officers} value="" onChange={() => {}} ariaLabel="ค้นหา" />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "ไม่มีชื่อนี้" } });
    expect(screen.getByText("ไม่พบเจ้าหน้าที่ที่ตรงกับคำค้น")).toBeInTheDocument();
  });
});

describe("OfficerMultiPicker", () => {
  it("adds members as chips, hides excluded/selected people and removes with the chip button", () => {
    render(<MultiHarness exclude={["3"]} />);
    const input = screen.getByRole("combobox", { name: "ค้นหาสมาชิก" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "สม" } });
    fireEvent.mouseDown(screen.getByRole("option", { name: /สมชาย/ }));
    expect(screen.getByText("สมชาย ใจดี")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "" } });
    const names = screen.getAllByRole("option").map((option) => option.textContent);
    expect(names.join(" ")).not.toContain("สมชาย");
    expect(names.join(" ")).not.toContain("อนุชา");

    fireEvent.click(screen.getByRole("button", { name: "เอา สมชาย ใจดี ออก" }));
    expect(screen.queryByRole("list", { name: "สมาชิกที่เลือก" })).not.toBeInTheDocument();
    // กลับมาให้เลือกได้อีกครั้ง
    expect(screen.getByRole("option", { name: /สมชาย/ })).toBeInTheDocument();
  });
});
