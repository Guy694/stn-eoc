/** @type {import('next').NextConfig} */
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
