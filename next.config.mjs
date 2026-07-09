/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/stn-eoc',
  assetPrefix: '/stn-eoc',
  output: 'standalone',
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
