// วาด heatmap บน canvas (อัลกอริทึมแบบ simpleheat) — ไม่ต้องติดตั้งปลั๊กอินเพิ่ม
// points: [[x, y, value]] พิกัดเป็นพิกเซลของ canvas

export const HEAT_GRADIENT = { 0.25: "#2563eb", 0.45: "#06b6d4", 0.6: "#22c55e", 0.78: "#facc15", 1: "#dc2626" };

function makeCircle(radius, blur) {
  const circle = document.createElement("canvas");
  const r2 = radius + blur;
  circle.width = circle.height = r2 * 2;
  const ctx = circle.getContext("2d");
  // วาดวงกลมนอกจอแล้วใช้เงาเป็นวงเบลอ
  ctx.shadowOffsetX = ctx.shadowOffsetY = r2 * 2;
  ctx.shadowBlur = blur;
  ctx.shadowColor = "black";
  ctx.beginPath();
  ctx.arc(-r2, -r2, radius, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.fill();
  return circle;
}

function makePalette(gradient) {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const linear = ctx.createLinearGradient(0, 0, 0, 256);
  for (const [stop, color] of Object.entries(gradient)) linear.addColorStop(Number(stop), color);
  ctx.fillStyle = linear;
  ctx.fillRect(0, 0, 1, 256);
  return ctx.getImageData(0, 0, 1, 256).data;
}

let cache = null;

/** วาดลง canvas: radius/blur เป็นพิกเซล · max = ค่าที่ถือว่าร้อนสุด · minOpacity กันจุดเล็กหายไป */
export function drawHeat(canvas, points, { radius = 18, blur = 15, max = 1, minOpacity = 0.08, gradient = HEAT_GRADIENT } = {}) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!points.length || !canvas.width || !canvas.height) return;
  const key = `${radius}-${blur}`;
  if (!cache || cache.key !== key) cache = { key, circle: makeCircle(radius, blur), palette: makePalette(gradient) };
  const r = radius + blur;
  for (const [x, y, value] of points) {
    ctx.globalAlpha = Math.min(Math.max(value / max, minOpacity), 1);
    ctx.drawImage(cache.circle, x - r, y - r);
  }
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = image.data;
  for (let i = 3; i < pixels.length; i += 4) {
    const alpha = pixels[i];
    if (!alpha) continue;
    const j = alpha * 4;
    pixels[i - 3] = cache.palette[j];
    pixels[i - 2] = cache.palette[j + 1];
    pixels[i - 1] = cache.palette[j + 2];
    pixels[i] = Math.min(230, 60 + alpha); // ขอบจางแต่ยังมองเห็น ไม่ทึบทับแผนที่
  }
  ctx.putImageData(image, 0, 0);
}
