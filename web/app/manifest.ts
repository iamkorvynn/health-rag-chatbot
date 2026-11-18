import type { MetadataRoute } from "next";

// Web app manifest (Next.js built-in convention — served at /manifest.webmanifest).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Health RAG Chatbot — Sunrise Family Clinic",
    short_name: "Health RAG",
    description:
      "Decision-support chatbot for doctors at Sunrise Family Clinic. Synthetic demo data.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0e7490",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
