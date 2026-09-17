import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Rewrite or proxy API calls if needed, though frontend directly calls NEXT_PUBLIC_API_URL
};

export default nextConfig;

