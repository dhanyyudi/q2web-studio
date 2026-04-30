import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("leaflet") || id.includes("terra-draw")) return "map-vendor";
          if (id.includes("@turf")) return "geo-vendor";
          if (id.includes("@radix-ui") || id.includes("lucide-react") || id.includes("react-colorful")) return "ui-vendor";
          if (id.includes("jszip") || id.includes("dompurify")) return "io-vendor";
          if (id.includes("react") || id.includes("scheduler")) return "react-vendor";
          return undefined;
        }
      }
    }
  },
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin"
    }
  },
  preview: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin"
    }
  }
});
