import cloudflare from "@astrojs/cloudflare";
import solidJs from "@astrojs/solid-js";
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  output: "server",
  adapter: cloudflare(),
  integrations: [solidJs()],
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      exclude: ["@sqlite.org/sqlite-wasm"]
    }
  }
});
