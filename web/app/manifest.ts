import type { MetadataRoute } from "next";

// Static export needs this route to be force-static (no server at runtime).
export const dynamic = "force-static";

// Web app manifest (Next.js built-in convention — served at /manifest.webmanifest).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Health RAG Chatbot — Sunrise Family Clinic",
    short_name: "Health RAG",
    description:
      "Decision-support chatbot for doctors at Sunrise Family Clinic. Synthetic demo data.",
    start_url: "/",
    display: "standalone",
    background_color: "#070b08",
    theme_color: "#a3e635",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
