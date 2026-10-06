// เก็บ error ฝั่งเบราว์เซอร์ระหว่างเปิดหน้า เพื่อให้เทสต์ล้มเมื่อหน้าแตก (ไม่ใช่แค่ดูว่าโหลดได้)
export function watchPageErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    // ข้ามข้อความจากบริการภายนอก (แผนที่/อากาศ) ที่ไม่เกี่ยวกับโค้ดของระบบ
    if (/windy|rainviewer|open-meteo|tile|favicon|Failed to load resource/i.test(text)) return;
    errors.push(`console: ${text}`);
  });
  return errors;
}

export const BASE = '/stn-eoc';
