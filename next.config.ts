import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1 MB, which silently broke Library / avatar / logo
      // uploads above ~1 MB. Uploads are capped at 4 MB (MAX_FILE_BYTES in
      // src/lib/file-utils.ts); the extra 0.25 MB covers multipart
      // overhead so a file right at the cap still fits. Must stay under
      // Vercel's 4.5 MB request-body limit.
      bodySizeLimit: "4.25mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'tnqpfoxpjxcrnymcgwqg.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
