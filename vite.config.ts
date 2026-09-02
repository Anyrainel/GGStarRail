import path from "node:path";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

const localDevPort = Number(process.env.VITE_DEV_PORT ?? 5173);
const localWorkerOrigin =
  process.env.VITE_WORKER_ORIGIN ?? "http://127.0.0.1:41738";

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
    proxy: {
      "/api": {
        target: localWorkerOrigin,
        changeOrigin: true,
      },
    },
  },
});
