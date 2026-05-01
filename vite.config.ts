import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

function normalizeBasePath(value: string | undefined) {
  const raw = (value || "/").trim();
  if (!raw || raw === "/") return "/";
  const withLeading = raw.startsWith("/") ? raw : `/${raw}`;
  return withLeading.endsWith("/") ? withLeading : `${withLeading}/`;
}

export default defineConfig({
  base: normalizeBasePath(process.env.VITE_BASE_PATH || "/"),
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;

          if (id.includes("react-router") || id.includes("@remix-run/router")) return "router-runtime";
          if (id.includes("@supabase/supabase-js") || id.includes("@supabase/auth-js") || id.includes("@supabase/postgrest-js") || id.includes("@supabase/realtime-js") || id.includes("@supabase/storage-js")) {
            return "supabase-runtime";
          }

          if (id.includes("@react-three/fiber")) return "three-fiber";
          if (id.includes("three/examples/jsm")) return "three-examples";
          if (id.includes(`${path.sep}node_modules${path.sep}three${path.sep}`) || id.includes("/node_modules/three/")) {
            return "three-core";
          }

          if (id.includes("framer-motion") || id.includes("/motion/")) return "motion-runtime";
          if (id.includes("@gsap/react") || id.includes(`${path.sep}gsap${path.sep}`) || id.includes("/gsap/")) {
            return "gsap-runtime";
          }

          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
