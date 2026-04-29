import type { NextConfig } from "next";

function getAllowedServerActionOrigins(): string[] {
  const origins = new Set<string>();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      origins.add(new URL(appUrl).host);
    } catch {
      // ignore malformed env value; will fall back to default same-origin behavior
    }
  }
  const extra = process.env.SERVER_ACTIONS_ALLOWED_ORIGINS;
  if (extra) {
    for (const entry of extra.split(',')) {
      const trimmed = entry.trim();
      if (trimmed) origins.add(trimmed);
    }
  }
  return Array.from(origins);
}

const allowedOrigins = getAllowedServerActionOrigins();

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      ...(allowedOrigins.length > 0 ? { allowedOrigins } : {}),
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
