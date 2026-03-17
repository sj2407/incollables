/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  compress: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy-Report-Only',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://*.supabase.co'} https://*.supabase.co`,
              `img-src 'self' data: https://*.supabase.co`,
              "font-src 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },
  webpack: (config, { dev }) => {
    // Disable webpack persistent cache in dev to prevent stale CSS.
    // Next.js 14 webpack cache corrupts during HMR, causing Tailwind custom
    // theme (colors, fonts) to revert to defaults. Disabling the filesystem
    // cache forces a fresh Tailwind rebuild on every HMR update (~100-200ms
    // slower but 100% reliable). Safe to remove after upgrading to Next.js 15+
    // with Turbopack (next dev --turbo).
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
