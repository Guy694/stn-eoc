// เทสต์แบบเปิดเบราว์เซอร์จริง (smoke test เส้นทางหลัก)
// ติดตั้งครั้งแรก:  npm i -D @playwright/test  แล้ว  npx playwright install chromium
// รัน:  npm run test:e2e   (จะเปิด dev server ให้อัตโนมัติ ถ้ายังไม่ได้เปิด)
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.js',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: { baseURL, locale: 'th-TH', timezoneId: 'Asia/Bangkok', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } }
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'npm run dev',
    url: `${baseURL}/stn-eoc/`,
    reuseExistingServer: true,
    timeout: 120_000
  }
});
