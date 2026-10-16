import { fireEvent, render, screen } from "@testing-library/react";
import FacilitySelect from "@/components/common/FacilitySelect";

const facilities = [
  { id: 3, name: "รพ.สต.บ้านควน", typecode: "รพ.สต.", district_name: "เมืองสตูล" },
  { id: 2, name: "สสอ.ละงู", typecode: "สสอ.", district_name: "ละงู" },
  ...Array.from({ length: 8 }, (_, i) => ({ id: 10 + i, name: `รพ.สต.ทดสอบ${i}`, typecode: "รพ.สต.", district_name: "ควนโดน" })),
  { id: 1, name: "รพ.ละงู", typecode: "รพ.ชุมชน", district_name: "ละงู" }
];

describe("FacilitySelect", () => {
  it("แบ่งกลุ่มตามลำดับ โรงพยาบาล → สสอ. → รพ.สต.", () => {
    const { container } = render(<FacilitySelect facilities={facilities} value="" onChange={() => {}} />);
    expect([...container.querySelectorAll("optgroup")].map((group) => group.label)).toEqual(["โรงพยาบาล", "สำนักงานสาธารณสุขอำเภอ", "โรงพยาบาลส่งเสริมสุขภาพตำบล"]);
  });

  it("พิมพ์ค้นหาแล้วกรองรายการ และเลือกให้เมื่อเหลือรายการเดียว", () => {
    const onChange = jest.fn();
    const { container } = render(<FacilitySelect facilities={facilities} value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "ละงู" } });
    expect(container.querySelectorAll("select option[value]:not([value=''])")).toHaveLength(2);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "บ้านควน" } });
    expect(onChange).toHaveBeenLastCalledWith("3");
  });

  it("ค่าที่เลือกไว้ยังอยู่ในรายการแม้ไม่ตรงคำค้น", () => {
    const { container } = render(<FacilitySelect facilities={facilities} value="1" onChange={() => {}} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "ควนโดน" } });
    expect(container.querySelector("select").value).toBe("1");
  });
});
