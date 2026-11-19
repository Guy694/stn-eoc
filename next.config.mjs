/** @type {import('next').NextConfig} */
const isDevelopment = process.env.NODE_ENV !== 'production';
// บังคับ https (upgrade-insecure-requests + HSTS) เฉพาะเมื่อกำหนดที่อยู่เว็บจริงเป็น https
// ทดสอบ `npm start` บน http://localhost ได้โดยไม่ถูกเปลี่ยนไป https://localhost (ซึ่งไม่มีอยู่)
const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '';
const enforceHttps = !isDevelopment && appUrl.startsWith('https://');
// หน้าประชาชนมีสวิตช์ TH/EN ที่ใช้ Google Translate → อนุญาตโดเมนของ Google เฉพาะหน้าประชาชน (หน้าเจ้าหน้าที่ใช้นโยบายเดิม)
const TRANSLATE_SCRIPT = "https://translate.google.com https://translate.googleapis.com https://translate-pa.googleapis.com https://www.gstatic.com";
const TRANSLATE_FRAME = "https://translate.google.com https://translate.googleapis.com";
const buildCsp = ({ translate = false } = {}) => [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ''}${translate ? ` ${TRANSLATE_SCRIPT}` : ''}`,
  `style-src 'self' 'unsafe-inline'${translate ? ' https://www.gstatic.com https://translate.googleapis.com' : ''}`,
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "media-src 'self' blob:",
  // แผนที่พยากรณ์อากาศ Windy (หน้า /public/weather-watch) แสดงผ่าน iframe
  `frame-src 'self' https://embed.windy.com${translate ? ` ${TRANSLATE_FRAME}` : ''}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(enforceHttps ? ["upgrade-insecure-requests"] : [])
].join('; ');
const contentSecurityPolicy = buildCsp();
const publicContentSecurityPolicy = buildCsp({ translate: true });

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ...(enforceHttps ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }] : [])
];

const nextConfig = {
  basePath: '/stn-eoc',
  assetPrefix: '/stn-eoc',
  output: 'standalone',
  trailingSlash: true,
  reactCompiler: true,
  async headers() {
    // ส่วนหัวที่ตรงหลายกฎ: กฎหลังทับกฎก่อน → หน้าประชาชนได้ CSP ที่อนุญาต Google Translate
    const publicCsp = [{ key: 'Content-Security-Policy', value: publicContentSecurityPolicy }];
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/', headers: publicCsp },
      { source: '/public/:path*', headers: publicCsp },
      { source: '/privacy-policy/:path*', headers: publicCsp },
      { source: '/announcements/:path*', headers: publicCsp }
    ];
  },
  async redirects() {
    return [
      // หน้าเก่าที่รวมเข้าหน้าอื่นแล้ว — ลิงก์เก่า/บุ๊กมาร์กยังพาไปหน้าใหม่ (เดิมเป็นไฟล์ page.jsx ที่มีแค่ redirect)
      { source: '/admin/eoc-modules', destination: '/admin/eoc-management', permanent: false },
      { source: '/admin/recent-activities', destination: '/admin/activity-logs', permanent: false },
      { source: '/eoc/flood/management/command-room', destination: '/eoc/flood/overview', permanent: false },
      { source: '/eoc/flood/management/completeness', destination: '/eoc/flood/overview#sec-completeness', permanent: false },
      { source: '/eoc/flood/management/daily', destination: '/eoc/flood/overview', permanent: false },
      { source: '/eoc/flood/management/forms', destination: '/eoc/flood/records', permanent: false },
      { source: '/eoc/flood/management/reports', destination: '/eoc/flood/management/team-workspace', permanent: false },
      { source: '/eoc/flood/shelters/disease-reports', destination: '/eoc/flood/health?tab=shelter', permanent: false },
      { source: '/eoc/flood/shelters/manage', destination: '/eoc/shelters?eoc=flood', permanent: false },
      { source: '/eoc/flood/shelters', destination: '/eoc/shelters?eoc=flood&tab=map', permanent: false },
      { source: '/admin/alert-test', destination: '/admin/settings?section=alerts', permanent: false },
      // ศูนย์งานเจ้าหน้าที่แบบเก่า (เลิกใช้) — ลิงก์ในการแจ้งเตือนเก่าพาไปหน้าหลัก
      { source: '/eoc/staff/:path*', destination: '/dashboard', permanent: false },
      {
        source: '/',
        destination: '/stn-eoc/',
        permanent: false,
        basePath: false,
      },
      {
        source: '/api/auth/:path*',
        destination: '/stn-eoc/api/auth/:path*',
        permanent: false,
        basePath: false,
      },
      // พิมพ์ที่อยู่โดยไม่มี /stn-eoc (เช่น /settings/) ให้พาไปหน้าเดียวกันใต้ /stn-eoc แทนการขึ้น 404
      {
        source: '/:path((?!stn-eoc(?:/|$)).+)',
        destination: '/stn-eoc/:path',
        permanent: false,
        basePath: false,
      },
    ];
  },
};

export default nextConfig;
