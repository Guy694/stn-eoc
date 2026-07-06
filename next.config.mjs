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
    ];
  },
};

export default nextConfig;
