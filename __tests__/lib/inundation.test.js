import { accumulate, calibrateStages, coastalDepth, depthClass, depthToRgba, flowTree, heightAboveDrainage, rasterizeGeometry, rasterizePolygon, riverineDepth, seaMask } from "@/lib/inundation";

// ตารางทดสอบ 7×5: ทะเลด้านซ้าย (x=0), หุบคลองตรงกลาง (y=2) ลาดลงทะเล, ตลิ่งสูงขึ้นทั้งสองฝั่ง
function valley() {
  const w = 7;
  const h = 5;
  const elev = new Float32Array(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      elev[y * w + x] = x === 0 ? -2 : x * 0.5 + Math.abs(y - 2) * 2;
    }
  }
  return { w, h, elev };
}

describe("inundation model", () => {
  test("seaMask only marks sea connected to the edge", () => {
    const w = 5;
    const h = 5;
    const elev = new Float32Array(w * h).fill(5);
    elev[0] = -1; // ทะเลที่ขอบ
    elev[12] = -1; // บ่อกลางแผ่นดิน
    const sea = seaMask(elev, w, h);
    expect(sea[0]).toBe(1);
    expect(sea[12]).toBe(0);
  });

  test("flow tree drains every cell and HAND is zero along the canal", () => {
    const { w, h, elev } = valley();
    const sea = seaMask(elev, w, h);
    const tree = flowTree(elev, w, h, sea);
    expect(tree.order.length).toBe(w * h);
    const acc = accumulate(tree.parent, tree.order);
    // ร่องน้ำกลาง (y=2) ใกล้ทะเลรับน้ำมากกว่าต้นน้ำ
    expect(acc[2 * w + 1]).toBeGreaterThan(acc[2 * w + 5]);
    const hand = heightAboveDrainage(elev, sea, tree, acc, 4);
    expect(hand[2 * w + 3]).toBeLessThan(0.6);
    expect(hand[0 * w + 3]).toBeGreaterThan(hand[1 * w + 3]);
  });

  test("riverine depth grows with stage, coastal depth needs connection", () => {
    const { w, h, elev } = valley();
    const sea = seaMask(elev, w, h);
    const tree = flowTree(elev, w, h, sea);
    const hand = heightAboveDrainage(elev, sea, tree, accumulate(tree.parent, tree.order), 4);
    const low = riverineDepth(hand, sea, () => 1).filter((d) => d > 0).length;
    const high = riverineDepth(hand, sea, () => 3).filter((d) => d > 0).length;
    expect(high).toBeGreaterThan(low);
    expect(riverineDepth(hand, sea, () => 0).every((d) => d === 0)).toBe(true);
    const coast = coastalDepth(elev, w, h, sea, 1.2);
    expect(coast[2 * w + 1]).toBeCloseTo(0.7, 5);
    expect(coast[2 * w + 3]).toBe(0);
  });

  test("rasterizePolygon fills cell centres inside, honours holes", () => {
    const cells = [];
    rasterizePolygon([[[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]], [[1, 1], [3, 1], [3, 3], [1, 3], [1, 1]]], 5, 5, (i) => cells.push(i));
    expect(cells).toHaveLength(12);
    expect(cells).not.toContain(2 * 5 + 2);
    const geo = [];
    rasterizeGeometry({ type: "Polygon", coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]] }, 5, 5, (lon, lat) => [lon, lat], (i) => geo.push(i));
    expect(geo.sort()).toEqual([0, 1, 5, 6]);
  });

  test("calibrateStages picks stage whose area matches observed", () => {
    const hand = new Float32Array([0.1, 0.4, 0.9, 1.6, 3, 5, 8, 12]);
    const observed = new Uint8Array([3, 2, 1, 1, 0, 0, 0, 0]);
    const land = new Uint8Array(8).fill(1);
    const result = calibrateStages(hand, observed, land, [1, 2, 3], [0.5, 1, 2, 4]);
    expect(result[1].stage).toBe(2); // 4 ช่องท่วมจริง ↔ HAND < 2 = 4 ช่อง
    expect(result[1].hit_rate).toBe(1);
    expect(result[2].stage).toBe(0.5);
    expect(result[3].observed_cells).toBe(1);
  });

  test("depth classes and colours", () => {
    expect(depthClass(0.3)).toBe(0);
    expect(depthClass(1.5)).toBe(2);
    expect(depthClass(4)).toBe(3);
    const rgba = depthToRgba(new Float32Array([0, 0.3]), 2, 1);
    expect(rgba[3]).toBe(0);
    expect(rgba[7]).toBeGreaterThan(0);
  });
});
