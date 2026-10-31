import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "Patchwise", short_name: "Patchwise", description: "Report a bad road in one tap", start_url: "/", display: "standalone",
    background_color: "#ffffff", theme_color: "#2F69E9",
    icons: [{ src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
            { src: "/brand/logo.svg", sizes: "any", type: "image/svg+xml" }] };
}
