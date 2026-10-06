import { test, expect } from '@playwright/test';
import { BASE, watchPageErrors } from './helpers';

// ส่วนเจ้าหน้าที่: ถ้ายังไม่ล็อกอินต้องถูกพาไปหน้าเข้าสู่ระบบ และ API ต้องตอบ 401
test('หน้าหลังบ้านต้องล็อกอินก่อน', async ({ page }) => {
  for (const path of ['/eoc/flood/overview', '/eoc/disease/records', '/admin/eoc-management']) {
    await page.goto(`${BASE}${path}`);
    await expect(page).toHaveURL(/\/login/);
  }
});

test('API หลังบ้านปฏิเสธเมื่อไม่ได้ล็อกอิน', async ({ request }) => {
  for (const path of ['/api/eoc/reporting-completeness?eoc=flood', '/api/admin/deleted-records', '/api/admin/data-quality', '/api/eoc/situation-board?eoc=flood', '/api/eoc/meeting-brief?eoc=flood', '/api/eoc/alerts?eoc=flood']) {
    const response = await request.get(`${BASE}${path}`);
    expect(response.status(), path).toBe(401);
  }
});

test('หน้าเก่าที่รวมแล้วพาไปหน้าใหม่', async ({ page }) => {
  // ไม่ล็อกอินจะเด้งไปหน้า login แต่ต้องผ่าน redirect ก่อน ไม่ใช่ 404
  const response = await page.goto(`${BASE}/admin/flood-records`);
  expect(response?.status()).toBeLessThan(400);
});

// เส้นทางหลักของเจ้าหน้าที่: ล็อกอิน → ภาพรวม → บันทึกข้อมูล → ความครบรายงาน
// ใช้บัญชีทดสอบจาก environment เท่านั้น (ห้ามใส่รหัสผ่านจริงในไฟล์นี้)
const username = process.env.E2E_USERNAME;
const password = process.env.E2E_PASSWORD;

test.describe('เจ้าหน้าที่ล็อกอินแล้ว', () => {
  test.skip(!username || !password, 'ตั้งค่า E2E_USERNAME และ E2E_PASSWORD (บัญชีทดสอบ) เพื่อรันชุดนี้');

  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.locator('input[name="username"], input#username').first().fill(username);
    await page.locator('input[type="password"]').first().fill(password);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL((url) => !url.pathname.endsWith('/login'));
  });

  for (const path of ['/eoc/flood/overview', '/eoc/disease', '/eoc/disease/records', '/eoc/flood/records', '/eoc/flood/health', '/eoc/flood/health?tab=community', '/eoc/flood/supplies', '/eoc/flood/management/directives', '/eoc/flood/it-support', '/eoc/flood/vulnerable-groups', '/eoc/disease/vulnerable-groups', '/eoc/shelters', '/eoc/shelters?tab=map', '/eoc/vulnerable-groups', '/eoc/flood/meeting-brief', '/eoc/flood/management/missions', '/admin/incident-reports', '/admin/trash']) {
    test(`เปิดหน้า ${path} ได้`, async ({ page }) => {
      const errors = watchPageErrors(page);
      const response = await page.goto(`${BASE}${path}`);
      expect(response?.status()).toBeLessThan(400);
      await expect(page.locator('main')).toBeVisible();
      expect(errors).toEqual([]);
    });
  }

  test('ภาพรวมอุทกภัยมีแถบเหตุการณ์และการ์ดความครบรายงานเมื่อ EOC เปิด', async ({ page }) => {
    await page.goto(`${BASE}/eoc/flood/overview`);
    const bar = page.getByTestId('event-bar');
    if (await bar.count()) {
      await expect(bar).toContainText(/เปิดอยู่|ปิดแล้ว/);
      await expect(page.locator('#sec-completeness')).toContainText('ความครบของรายงานรายวัน');
    }
  });

  test('ภาพรวมมีแผงสรุปสถานการณ์และตารางรายอำเภอ', async ({ page }) => {
    await page.goto(`${BASE}/eoc/flood/overview`);
    await expect(page.locator('#sec-situation')).toBeVisible();
    await expect(page.locator('#sec-districts')).toContainText('สถานการณ์รายอำเภอ');
  });

  // หน้าที่ซ้ำกันถูกรวมแล้ว — ลิงก์เก่า/บุ๊กมาร์กต้องพาไปหน้าที่ถูกต้อง ไม่ใช่ 404 หรือหน้าซ้ำ
  for (const [from, to] of [
    ['/eoc/flood/shelters', /\/eoc\/shelters\/?\?.*tab=map/],
    ['/eoc/flood/management', /\/eoc\/flood\/management\/directives/],
    ['/eoc/flood/management/daily', /\/eoc\/flood\/overview/],
    ['/eoc/flood/management/command-room', /\/eoc\/flood\/overview/],
    ['/eoc/flood/management/forms', /\/eoc\/flood\/records/],
    ['/eoc/flood/shelters/disease-reports', /\/eoc\/flood\/health/]
  ]) {
    test(`ลิงก์เก่า ${from} พาไปหน้าใหม่`, async ({ page }) => {
      await page.goto(`${BASE}${from}`);
      await expect(page).toHaveURL(to);
    });
  }
});

