import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  experimental: {
    serverActions: {
      // 5 MB image cap plus multipart overhead.
      bodySizeLimit: "6mb",
    },
  },

  // Report-only until the console shows no violations.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
          {
            key: "Content-Security-Policy-Report-Only",
            value: "require-trusted-types-for 'script'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
