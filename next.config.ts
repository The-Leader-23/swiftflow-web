import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "swiftflow.world",
          },
        ],
        destination: "https://www.swiftflow.world/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
