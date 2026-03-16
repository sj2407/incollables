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
  webpack: (config, { dev }) => {
    // Fix: tell webpack to invalidate its cache when tailwind.config.ts changes.
    // Without this, HMR can serve stale CSS with missing custom theme tokens.
    if (dev && config.cache && typeof config.cache === 'object') {
      config.cache.buildDependencies = {
        ...config.cache.buildDependencies,
        tailwind: ['./tailwind.config.ts'],
      };
    }
    return config;
  },
};

export default nextConfig;
