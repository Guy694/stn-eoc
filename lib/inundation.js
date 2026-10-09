// แบบจำลองพื้นที่น้ำท่วมจากความสูงภูมิประเทศ (ไม่มีการเรียกเครือข่ายในไฟล์นี้ ทดสอบได้)
//
// ยังไม่ใช่แบบจำลองชลศาสตร์เต็มรูปแบบ แต่เป็นวิธีมาตรฐานที่ใช้เมื่อไม่มี LiDAR:
//  1) น้ำทะเลหนุน (bathtub แบบต่อเนื่อง): ช่องที่ต่ำกว่าระดับน้ำทะเลและ "มีทางน้ำเชื่อมถึงทะเล" จะท่วม ลึก = ระดับน้ำ − พื้นดิน
//  2) น้ำล้นคลอง (HAND — Height Above Nearest Drainage): ความสูงของพื้นดินเหนือร่องน้ำที่ไหลลงไป
//     ถ้าน้ำในคลองสูงขึ้น h เมตร ช่องที่ HAND < h จะท่วม ลึก = h − HAND
//  ร่องน้ำ/ทิศการไหลหาจาก priority-flood (Barnes 2014) บนแบบจำลองความสูง
// ข้อมูลเข้า: ตารางความสูง Float32Array (w × h) เรียงแถว เมตรจาก รทก. (ทะเล ≤ 0)
const NO_DRAIN = -1e6;
const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** binary min-heap ของ index เรียงตามค่า (typed array, รองรับหลายล้านช่อง) */
class MinHeap {
  constructor(capacity) {
    this.idx = new Int32Array(capacity);
    this.val = new Float32Array(capacity);
    this.size = 0;
  }
  push(i, v) {
    let k = this.size++;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (this.val[p] <= v) break;
      this.idx[k] = this.idx[p];
      this.val[k] = this.val[p];
      k = p;
    }
    this.idx[k] = i;
    this.val[k] = v;
  }
  pop() {
    const top = this.idx[0];
    const lastI = this.idx[--this.size];
    const lastV = this.val[this.size];
    let k = 0;
    for (;;) {
      let c = 2 * k + 1;
      if (c >= this.size) break;
      if (c + 1 < this.size && this.val[c + 1] < this.val[c]) c += 1;
      if (this.val[c] >= lastV) break;
      this.idx[k] = this.idx[c];
      this.val[k] = this.val[c];
      k = c;
    }
    this.idx[k] = lastI;
    this.val[k] = lastV;
    return top;
  }
}

/** ทะเล: ช่อง ≤ seaLevel ที่ต่อเนื่องจากขอบตาราง (กันบ่อ/นากุ้งในแผ่นดินที่ค่าต่ำ ไม่ให้นับเป็นทะเล) */
export function seaMask(elev, w, h, seaLevel = 0) {
  const sea = new Uint8Array(w * h);
  const stack = [];
  const seed = (i) => {
    if (!sea[i] && elev[i] <= seaLevel) {
      sea[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x += 1) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y += 1) { seed(y * w); seed(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w;
    const y = (i - x) / w;
    for (const [dx, dy] of NEIGHBORS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h) seed(ny * w + nx);
    }
  }
  return sea;
}

/**
 * ต้นไม้การไหล: priority-flood จากทะเล/ขอบ → parent (ช่องท้ายน้ำ), order (ลำดับจากท้ายน้ำขึ้นต้นน้ำ)
 * แอ่งปิดจะถูก "เติม" ให้ไหลออกได้ (filled)
 */
export function flowTree(elev, w, h, sea) {
  const n = w * h;
  const parent = new Int32Array(n).fill(-1);
  const order = new Int32Array(n);
  const filled = new Float32Array(n);
  const done = new Uint8Array(n);
  const heap = new MinHeap(n);
  let count = 0;
  for (let i = 0; i < n; i += 1) {
    const x = i % w;
    const y = (i - x) / w;
    const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
    if (sea[i] || edge) {
      done[i] = 1;
      filled[i] = sea[i] ? Math.min(elev[i], 0) : elev[i];
      heap.push(i, filled[i]);
    }
  }
  while (heap.size) {
    const i = heap.pop();
    order[count++] = i;
    const x = i % w;
    const y = (i - x) / w;
    for (const [dx, dy] of NEIGHBORS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (done[j]) continue;
      done[j] = 1;
      parent[j] = i;
      filled[j] = Math.max(elev[j], filled[i] + 1e-4);
      heap.push(j, filled[j]);
    }
  }
  return { parent, order: order.subarray(0, count), filled };
}

/** พื้นที่รับน้ำ (จำนวนช่องต้นน้ำรวมตัวเอง) */
export function accumulate(parent, order) {
  const acc = new Float32Array(parent.length).fill(1);
  for (let k = order.length - 1; k >= 0; k -= 1) {
    const i = order[k];
    const p = parent[i];
    if (p >= 0) acc[p] += acc[i];
  }
  return acc;
}

/**
 * HAND: ความสูงเหนือร่องน้ำที่ช่องนั้นไหลลงไป (ร่องน้ำ = พื้นที่รับน้ำ ≥ channelCells, หรือทะเล → 0 ม.)
 */
export function heightAboveDrainage(elev, sea, tree, acc, channelCells) {
  const n = elev.length;
  const drain = new Float32Array(n);
  const hand = new Float32Array(n);
  const { parent, order } = tree;
  for (let k = 0; k < order.length; k += 1) {
    const i = order[k];
    if (sea[i]) drain[i] = 0;
    else if (acc[i] >= channelCells) drain[i] = elev[i];
    // ขอบตารางบนบก (น้ำไหลออกนอกพื้นที่ศึกษา) ไม่ใช่ร่องน้ำ → ไม่ให้เป็นจุดอ้างอิงที่ทำให้ "ท่วม" ได้
    else if (parent[i] < 0) drain[i] = NO_DRAIN;
    else drain[i] = drain[parent[i]];
    hand[i] = sea[i] ? 0 : drain[i] === NO_DRAIN ? 9999 : Math.max(0, elev[i] - drain[i]);
  }
  return hand;
}

/** น้ำทะเลหนุนถึงระดับ seaLevel (ม. รทก.) → ความลึก (ม.) เฉพาะช่องบนบกที่ต่อถึงทะเลผ่านช่องที่ต่ำกว่าระดับน้ำ */
export function coastalDepth(elev, w, h, sea, seaLevel) {
  const depth = new Float32Array(w * h);
  const seen = new Uint8Array(w * h);
  const stack = [];
  for (let i = 0; i < sea.length; i += 1) if (sea[i]) { seen[i] = 1; stack.push(i); }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w;
    const y = (i - x) / w;
    for (const [dx, dy] of NEIGHBORS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (seen[j]) continue;
      seen[j] = 1;
      if (elev[j] < seaLevel) {
        depth[j] = seaLevel - elev[j];
        stack.push(j);
      }
    }
  }
  return depth;
}

/** น้ำในคลองสูงขึ้น stage (ม.) → ความลึกจาก HAND; stageOf(i) ให้ระดับต่างกันรายพื้นที่ได้ (0 = ไม่ท่วม) */
export function riverineDepth(hand, sea, stageOf) {
  const depth = new Float32Array(hand.length);
  for (let i = 0; i < hand.length; i += 1) {
    if (sea[i]) continue;
    const stage = stageOf(i);
    if (stage > 0 && hand[i] < stage) depth[i] = stage - hand[i];
  }
  return depth;
}

// ---- แปลงรูปหลายเหลี่ยม (พิกัดพิกเซลของตาราง) เป็นช่อง ----
/** rings: [[ [px,py], ... ], ...] (วงแรก = ขอบนอก ที่เหลือ = รู) → เรียก visit(i) ทุกช่องที่จุดกลางอยู่ข้างใน */
export function rasterizePolygon(rings, w, h, visit) {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const ring of rings) for (const [, y] of ring) { if (y < minY) minY = y; if (y > maxY) maxY = y; }
  const y0 = Math.max(0, Math.floor(minY));
  const y1 = Math.min(h - 1, Math.ceil(maxY));
  for (let y = y0; y <= y1; y += 1) {
    const cy = y + 0.5;
    const xs = [];
    for (const ring of rings) {
      for (let a = 0, b = ring.length - 1; a < ring.length; b = a, a += 1) {
        const [xa, ya] = ring[a];
        const [xb, yb] = ring[b];
        if ((ya > cy) !== (yb > cy)) xs.push(xa + ((cy - ya) * (xb - xa)) / (yb - ya));
      }
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.ceil(xs[k] - 0.5));
      const xb = Math.min(w - 1, Math.floor(xs[k + 1] - 0.5));
      for (let x = xa; x <= xb; x += 1) visit(y * w + x);
    }
  }
}

/** Polygon/MultiPolygon (lon/lat) → ช่องในตาราง ด้วยฟังก์ชันแปลงพิกัด toPixel(lon, lat) → [px, py] */
export function rasterizeGeometry(geometry, w, h, toPixel, visit) {
  const polygons = geometry?.type === "Polygon" ? [geometry.coordinates] : geometry?.type === "MultiPolygon" ? geometry.coordinates : [];
  for (const rings of polygons) rasterizePolygon(rings.map((ring) => ring.map(([lon, lat]) => toPixel(lon, lat))), w, h, visit);
}

/**
 * ปรับเทียบกับดาวเทียม: ระดับน้ำในคลอง h ที่ทำให้พื้นที่ HAND < h เท่ากับพื้นที่ที่ GISTDA เคยพบน้ำท่วม (ความถี่ ≥ k ปี)
 * observed: Uint8Array ความถี่น้ำท่วมสูงสุดของแต่ละช่อง (0 = ไม่เคย), land: Uint8Array ช่องบนบกที่ใช้ปรับเทียบ
 * คืน { [k]: { stage, observed_cells, predicted_cells, hit_rate, csi } }
 */
export function calibrateStages(hand, observed, land, freqs = [1, 2, 3], stages = null) {
  const steps = stages || Array.from({ length: 40 }, (_, i) => Math.round((0.25 + i * 0.25) * 100) / 100);
  const out = {};
  for (const k of freqs) {
    let obs = 0;
    for (let i = 0; i < hand.length; i += 1) if (land[i] && observed[i] >= k) obs += 1;
    if (!obs) continue;
    let best = null;
    for (const stage of steps) {
      let predicted = 0;
      let hit = 0;
      for (let i = 0; i < hand.length; i += 1) {
        if (!land[i] || hand[i] >= stage) continue;
        predicted += 1;
        if (observed[i] >= k) hit += 1;
      }
      const row = { stage, observed_cells: obs, predicted_cells: predicted, hit_cells: hit, hit_rate: Math.round((hit / obs) * 100) / 100, csi: Math.round((hit / (obs + predicted - hit)) * 100) / 100 };
      // เลือกระดับที่พื้นที่จำลองใกล้กับพื้นที่จริงที่สุด (bias ≈ 1) — ไม่ให้ท่วมเกิน/ขาดเชิงพื้นที่รวม
      if (!best || Math.abs(predicted - obs) < Math.abs(best.predicted_cells - obs)) best = row;
    }
    out[k] = best;
  }
  return out;
}

/** สีความลึก (RGBA) สำหรับภาพซ้อนบนแผนที่ */
export const DEPTH_CLASSES = [
  { max: 0.5, label: "< 0.5 ม. (ข้อเท้า–เข่า)", color: [125, 196, 240, 170] },
  { max: 1, label: "0.5–1 ม. (เอว)", color: [52, 140, 220, 190] },
  { max: 2, label: "1–2 ม. (ท่วมหัว)", color: [27, 82, 178, 205] },
  { max: Infinity, label: "> 2 ม.", color: [62, 28, 140, 215] }
];
export function depthClass(depth) {
  return DEPTH_CLASSES.findIndex((c) => depth < c.max);
}
export function depthToRgba(depth, w, h) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < depth.length; i += 1) {
    const d = depth[i];
    if (!(d > 0.05)) continue;
    const c = DEPTH_CLASSES[depthClass(d)].color;
    out.set(c, i * 4);
  }
  return out;
}
