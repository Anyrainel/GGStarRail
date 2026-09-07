import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

const localDevPort = Number(process.env.VITE_DEV_PORT ?? 5173);
const localWorkerOrigin =
  process.env.VITE_WORKER_ORIGIN ?? "http://127.0.0.1:41738";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "cache-development-images",
      apply: "serve",
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          if (
            /^\/assets\/ggstarrail\/webp\/[a-f0-9]{64}\.webp(?:\?|$)/.test(
              request.url ?? ""
            )
          ) {
            response.setHeader(
              "Cache-Control",
              "public, max-age=31536000, immutable"
            );
          }
          next();
        });
      },
    },
    {
      name: "exclude-source-asset-cache",
      apply: "build",
      async closeBundle() {
        // Publish only referenced derivatives, never the PNG source cache or
        // obsolete images retained by a local incremental conversion.
        const lookup = JSON.parse(
          await readFile(
            path.resolve(
              __dirname,
              "src/generated/hsr-assets/runtime-lookup.json"
            ),
            "utf8"
          )
        );
        const images = new Set<string>(
          lookup.entries
            .map((entry: [string, string, string | null]) => entry[2])
            .filter(Boolean)
        );
        await mkdir(path.resolve(__dirname, "dist/assets/ggstarrail/webp"), {
          recursive: true,
        });
        await copyFile(
          path.resolve(__dirname, "public/_headers"),
          path.resolve(__dirname, "dist/_headers")
        );
        await copyFile(
          path.resolve(__dirname, "public/assets/ggstarrail/mark.svg"),
          path.resolve(__dirname, "dist/assets/ggstarrail/mark.svg")
        );
        for (const image of images) {
          if (!/^webp\/[a-f0-9]{64}\.webp$/.test(image))
            throw new Error(`Invalid WebP path: ${image}`);
          await copyFile(
            path.resolve(__dirname, "public/assets/ggstarrail", image),
            path.resolve(__dirname, "dist/assets/ggstarrail", image)
          );
        }
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    copyPublicDir: false,
    manifest: true,
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replaceAll("\\", "/");
          // CommonJS interop is needed before React initializes. Putting it
          // with React-dependent utilities creates an initialization cycle.
          if (normalized.includes("commonjsHelpers")) return "vendor-react";
          if (normalized.includes("/node_modules/")) {
            if (
              /\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(
                normalized
              )
            )
              return "vendor-react";
            if (normalized.includes("/@radix-ui/")) return "vendor-radix";
            if (normalized.includes("/@dnd-kit/")) return "vendor-dnd";
            if (normalized.includes("/zod/")) return "vendor-validation";
            if (normalized.includes("/lucide-react/")) return "vendor-icons";
            // Let Rollup place transitive dependencies with their importer.
            // A catch-all vendor chunk can cycle back into React/router.
            return undefined;
          }
          if (/\/src\/i18n\/messages\./.test(normalized)) return "i18n-data";
          return undefined;
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
