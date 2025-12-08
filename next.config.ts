import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  devIndicators: false,
  async headers() {
    // Only apply in `npm run dev` (NODE_ENV will be "development")
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/:path*',
          headers: [
            { key: 'Access-Control-Allow-Origin',   value: '*' },
            { key: 'Access-Control-Allow-Methods',  value: 'GET,POST,OPTIONS' },
            { key: 'Access-Control-Allow-Headers',  value: 'Origin, X-Requested-With, Content-Type, Accept, Authorization' },
            // your frame headers too, if desired in dev
            { key: 'X-Frame-Options',         value: '' },
            { key: 'Content-Security-Policy', value: 'frame-ancestors *' },
          ],
        },
      ];
    }
    // In production, no extra headers
    return [];
  },
}

export default nextConfig
