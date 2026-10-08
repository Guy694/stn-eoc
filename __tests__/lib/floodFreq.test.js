import { compactFeature, floodFreqClass, floodYears, simplifyRing, summarizeFloodFreq, thaiYear } from "@/lib/floodFreq";

const square = (x, y, size, extra = 0) => {
  // สี่เหลี่ยมแบบขั้นบันได (เหมือนข้อมูลจากภาพดาวเทียม) มีจุดกลางเส้นที่ตัดทิ้งได้
  const ring = [[x, y], [x + size / 2, y + extra], [x + size, y], [x + size, y + size], [x, y + size], [x, y]];
  return ring;
};

describe("floodFreqClass", () => {
  it("แบ่งช่วงตามจำนวนปีที่ท่วม", () => {
    expect(floodFreqClass(1).key).toBe("once");
    expect(floodFreqClass(2).key).toBe("twice");
    expect(floodFreqClass(3).key).toBe("three");
    expect(floodFreqClass(6).key).toBe("four_plus");
    expect(floodFreqClass(0)).toBeNull();
    expect(floodFreqClass("x")).toBeNull();
  });
});

describe("simplifyRing", () => {
  it("ตัดจุดที่อยู่บนเส้นตรงและปิดวง", () => {
    const ring = simplifyRing(square(99.9, 6.8, 0.01));
    expect(ring).toHaveLength(5);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it("วงที่เล็กกว่าความละเอียดหลังปัดพิกัด ถือว่าเล็กเกินแสดง", () => {
    expect(simplifyRing(square(99.9, 6.8, 0.000001))).toBeNull();
    expect(simplifyRing([[1, 1], [1, 1]])).toBeNull();
  });
});

describe("compactFeature", () => {
  const raw = {
    type: "Feature",
    geometry: { type: "MultiPolygon", coordinates: [[square(99.9, 6.8, 0.01)]] },
    properties: {
      _id: "abc", _createdBy: "x", freq: 2, ap_tn: "อ.ละงู", tb_tn: "ต.กำแพง", area_rai: 12.345, pv_idn: 91,
      y_2011: 1, y_2012: 0, y_2017: 0, y_2024: 1
    }
  };

  it("เก็บเฉพาะฟิลด์ที่แผนที่ใช้ และปีที่ท่วม", () => {
    const feature = compactFeature(raw);
    expect(feature.geometry.type).toBe("Polygon");
    expect(feature.properties).toEqual({ freq: 2, district: "ละงู", tambon: "กำแพง", area_rai: 12.3, years: [2011, 2024] });
  });

  it("ไม่มีค่าความถี่ หรือรูปทรงเล็กเกิน → ตัดทิ้ง", () => {
    expect(compactFeature({ ...raw, properties: { ...raw.properties, freq: 0 } })).toBeNull();
    expect(compactFeature({ ...raw, geometry: { type: "Polygon", coordinates: [square(99.9, 6.8, 0.000001)] } })).toBeNull();
  });
});

describe("floodYears / thaiYear", () => {
  it("อ่านปีจาก y_YYYY และแปลงเป็น พ.ศ.", () => {
    expect(floodYears({ y_2016: 1, y_2020: 2, y_2021: 0 })).toEqual([2016, 2020]);
    expect(thaiYear(2024)).toBe(2567);
  });
});

describe("summarizeFloodFreq", () => {
  it("รวมพื้นที่ (ไร่) รายอำเภอ แยกพื้นที่ท่วมซ้ำ (2 ปีขึ้นไป) เรียงจากมากไปน้อย", () => {
    const rows = summarizeFloodFreq([
      { properties: { ap_tn: "อ.ท่าแพ", freq: 1, area_rai: 10 } },
      { properties: { ap_tn: "อ.ละงู", freq: 2, area_rai: 5.4 } },
      { properties: { ap_tn: "อ.ละงู", freq: 4, area_rai: 3 } },
      { properties: { ap_tn: "อ.ละงู", freq: 1, area_rai: 1 } }
    ]);
    expect(rows[0]).toEqual({ district: "ละงู", total_rai: 9, repeated_rai: 8, by_class: { twice: 5, four_plus: 3, once: 1 } });
    expect(rows[1]).toMatchObject({ district: "ท่าแพ", repeated_rai: 0 });
  });
});
