import { bandFor, bandIndex, colorizeTerrarium, decodeTerrarium, elevationText, tilePixelAt } from "@/lib/elevation";

// เข้ารหัสแบบ Terrarium: ค่า + 32768 → R*256 + G + B/256
function encode(meters) {
  const value = meters + 32768;
  return [Math.floor(value / 256), Math.floor(value % 256), Math.round((value % 1) * 256)];
}

describe("elevation", () => {
  test("ถอดค่าความสูงจากสี Terrarium", () => {
    expect(decodeTerrarium(...encode(0))).toBeCloseTo(0);
    expect(decodeTerrarium(...encode(4.5))).toBeCloseTo(4.5);
    expect(decodeTerrarium(...encode(367))).toBeCloseTo(367);
    expect(decodeTerrarium(...encode(-50))).toBeCloseTo(-50);
  });

  test("ช่วงความสูง: ทะเลโปร่งใส ช่วงต่ำแยกละเอียด", () => {
    expect(bandIndex(-3)).toBe(-1);
    expect(bandIndex(0)).toBe(-1);
    expect(bandFor(1.2).label).toBe("0–2 ม.");
    expect(bandFor(2).label).toBe("2–5 ม.");
    expect(bandFor(15).label).toBe("10–20 ม.");
    expect(bandFor(1200).label).toBe("300 ม. ขึ้นไป");
  });

  test("ระบายสีและเก็บค่าความสูงรายพิกเซล", () => {
    const pixels = new Uint8ClampedArray([...encode(-10), 255, ...encode(3), 255]);
    const { rgba, heights } = colorizeTerrarium(pixels, 150);
    expect(Array.from(rgba.slice(0, 4))).toEqual([0, 0, 0, 0]);
    expect(Array.from(rgba.slice(4, 8))).toEqual([33, 113, 181, 150]);
    expect(heights[1]).toBeCloseTo(3);
  });

  test("ตำแหน่งภาพตรงกับที่ทดสอบจริง (สตูล z12)", () => {
    expect(tilePixelAt(6.75, 100.05, 12).key).toBe("12/3186/1971");
    const { px, py } = tilePixelAt(6.75, 100.05, 12);
    expect(px).toBeGreaterThanOrEqual(0);
    expect(py).toBeLessThan(256);
  });

  test("ข้อความ", () => {
    expect(elevationText(3.24)).toBe("3.2 ม. จากระดับทะเล");
    expect(elevationText(152.7)).toBe("153 ม. จากระดับทะเล");
    expect(elevationText(-2)).toBe("ระดับทะเล/ผิวน้ำ");
  });
});
