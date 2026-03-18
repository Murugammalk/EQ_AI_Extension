import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { copyFileSync, mkdirSync, readdirSync } from "fs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      react(),
      {
        // Copy all public/ files to dist/ after build
        name: "copy-extension-files",
        closeBundle() {
          const files = [
            "config.js",
            "background.js",
            "content.js",
            "regexPatterns.js",
            "manifest.json"
          ];
          files.forEach((file) => {
            try {
              copyFileSync(`public/${file}`, `dist/${file}`);
              console.log(`✓ Copied ${file} to dist/`);
            } catch (e) {
              console.warn(`⚠ Could not copy ${file}:`, e.message);
            }
          });
        },
      },
    ],
    define: {
      __EQ_WEB__: JSON.stringify({
        dashboard: `${env.VITE_WEB_BASE || "https://eqai.innometrixtechub.in"}/dashboard`,
        settings: `${env.VITE_WEB_BASE || "https://eqai.innometrixtechub.in"}/settings`,
        subscription: `${env.VITE_WEB_BASE || "https://eqai.innometrixtechub.in"}/subscription`,
      }),
    },
    build: {
      outDir: "dist",
      rollupOptions: {
        input: { main: resolve(__dirname, "index.html") },
      },
      chunkSizeWarningLimit: 1200,
    },
  };
});
