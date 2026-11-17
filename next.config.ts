import type { NextConfig } from "next";

/**
 * Next.js config for i-bay.
 * WHY cacheComponents is off: almost every page depends on who is signed in
 * (hostel-only food drops, saved hearts, unread counts), so we use the classic
 * dynamic rendering model and refresh pages with revalidatePath after writes.
 */
const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
    serverActions: { bodySizeLimit: "32mb" },
  },
  cacheComponents: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
