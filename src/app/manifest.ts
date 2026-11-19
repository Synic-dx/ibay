import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "i-bay · IIM Indore Campus Marketplace",
    short_name: "i-bay",
    description: "Buy, rent, bid and grab food drops from people in your own hostel. Only for @iimidr.ac.in accounts.",
    start_url: "/",
    display: "standalone",
    background_color: "#02505F",
    theme_color: "#02505F",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any maskable" as unknown as "any",
      },
    ],
  };
}
