/** @type {import('next').NextConfig} */
const isDevelopment = process.env.NODE_ENV !== 'production';
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(!isDevelopment ? ["upgrade-insecure-requests"] : [])
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }
];

const nextConfig = {
  basePath: '/stn-eoc',
  assetPrefix: '/stn-eoc',
  output: 'standalone',
  // These files are read at runtime by /api/common/area-polygons.
  // Include them in the standalone server bundle used by Docker deployments.
  outputFileTracingIncludes: {
    '/*': ['./ampure.geojson', './tambonnn.geojson'],
  },
  trailingSlash: true,
  reactCompiler: true,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  async redirects() {
    return [
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
    ];
  },
};

export default nextConfig;
