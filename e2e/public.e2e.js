import { test, expect } from '@playwright/test';
import { BASE, watchPageErrors } from './helpers';

// หน้าสาธารณะต้องเปิดได้โดยไม่ต้องล็อกอิน และไม่มี error ฝั่งเบราว์เซอร์
const PUBLIC_PAGES = [
  { path: '/', text: /สตูล/ },
  { path: '/public/weather-watch', text: /อากาศ|ฝน/ },
  { path: '/public/shelters', text: /ศูนย์พักพิง/ },
  { path: '/public/help', text: /ช่วยเหลือ/ },
  { path: '/public/announcements', text: /ประกาศ/ }
];

for (const item of PUBLIC_PAGES) {
  test(`เปิดหน้า ${item.path} ได้`, async ({ page }) => {
    const errors = watchPageErrors(page);
    const response = await page.goto(`${BASE}${item.path}`);
    expect(response?.status(), 'สถานะ HTTP').toBeLessThan(400);
    await expect(page.locator('body')).toContainText(item.text);
    // ไม่มีการเลื่อนแนวนอนเกินจอ (สำคัญบนมือถือ)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, 'หน้ากว้างเกินจอ').toBeLessThanOrEqual(1);
    expect(errors, 'error ฝั่งเบราว์เซอร์').toEqual([]);
  });
}

test('ปุ่มขอความช่วยเหลือสอดคล้องกับสถานะการเปิด EOC', async ({ page, request }) => {
  const availability = await (await request.get(`${BASE}/api/public/help-availability`)).json();
  await page.goto(`${BASE}/public/report-incident`);
  if (availability.open) {
    await expect(page.locator('form')).toBeVisible();
  } else {
    await expect(page.locator('body')).toContainText('1669');
  }
});
