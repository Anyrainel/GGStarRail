import path from "node:path";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

const localDevPort = Number(process.env.VITE_DEV_PORT ?? 5173);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          return "vendor";
        },
      },
    },
  },
  server: {
    port: localDevPort,
    strictPort: true,
    host: true,
  },
});
