import { copyFile, cp, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const localDevPort = Number(process.env.VITE_DEV_PORT ?? 5173);

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    cloudflare({ inspectorPort: false, remoteBindings: false }),
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
      async writeBundle() {
        if (this.environment.name !== "client") return;
        // Publish only referenced derivatives, never the PNG source cache or
        // obsolete images retained by a local incremental conversion.
        const lookup = JSON.parse(
          await readFile(
            path.resolve(
              import.meta.dirname,
              "src/generated/assets/runtime-lookup.json"
            ),
            "utf8"
          )
        );
        const images = new Set<string>(
          lookup.entries
            .map((entry: [string, string, string | null]) => entry[2])
            .filter(Boolean)
        );
        await mkdir(
          path.resolve(
            import.meta.dirname,
            "dist/client/assets/ggstarrail/webp"
          ),
          {
            recursive: true,
          }
        );
        const publicDirectory = path.resolve(import.meta.dirname, "public");
        // Public files are published by default, including newly added data
        // endpoints. Generated image directories are handled separately below.
        await cp(
          publicDirectory,
          path.resolve(import.meta.dirname, "dist/client"),
          {
            recursive: true,
            filter(source) {
              const relative = path
                .relative(publicDirectory, source)
                .replaceAll("\\", "/");
              return ![
                "assets/ggstarrail/cache",
                "assets/ggstarrail/webp",
              ].includes(relative);
            },
          }
        );
        for (const image of images) {
          if (!/^webp\/[a-f0-9]{64}\.webp$/.test(image))
            throw new Error(`Invalid WebP path: ${image}`);
          await copyFile(
            path.resolve(
              import.meta.dirname,
              "public/assets/ggstarrail",
              image
            ),
            path.resolve(
              import.meta.dirname,
              "dist/client/assets/ggstarrail",
              image
            )
          );
        }
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  // The combat worker lazy-loads catalogs, which needs module workers.
  worker: {
    format: "es",
  },
  build: {
    copyPublicDir: false,
    manifest: true,
    assetsInlineLimit: 0,
    rolldownOptions: {
      output: {
        codeSplitting: {
          // Highest-priority React ownership prevents UI dependency groups
          // from pulling React into a chunk that depends on its own runtime.
          groups: [
            {
              name: "vendor-react",
              test: /[/\\]node_modules[/\\](react|react-dom|react-router|react-router-dom|scheduler)[/\\]/,
              priority: 100,
            },
            {
              name: "vendor-radix",
              test: /[/\\]node_modules[/\\](@radix-ui|radix-ui)[/\\]/,
              priority: 90,
            },
            {
              name: "vendor-dnd",
              test: /[/\\]node_modules[/\\]@dnd-kit[/\\]/,
              priority: 80,
            },
            {
              name: "vendor-validation",
              test: /[/\\]node_modules[/\\]zod[/\\]/,
              priority: 70,
            },
            {
              name: "vendor-icons",
              test: /[/\\]node_modules[/\\]lucide-react[/\\]/,
              priority: 60,
            },
            {
              name: "i18n-data",
              test: /[/\\]src[/\\]i18n[/\\]messages\./,
            },
          ],
        },
      },
    },
  },
  server: {
    watch: {
      // Source snapshots are atomically replaced by the updater. They aren't
      // runtime modules, and watching them can raise EBUSY on Windows.
      ignored: [
        "**/src/generated/reference/**",
        "**/.cache/**",
        "**/public/assets/ggstarrail/cache/**",
      ],
    },
    port: localDevPort,
    strictPort: true,
    host: true,
  },
});
