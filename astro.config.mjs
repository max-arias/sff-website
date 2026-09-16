import cloudflare from "@astrojs/cloudflare";
import solidJs from "@astrojs/solid-js";
import { defineConfig, envField } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  output: "server",
  adapter: cloudflare(),
  integrations: [solidJs()],
  env: {
    schema: {
      // Canonical origin for copied build links. Read server-side so a list
      // shared from a local or preview origin still points at the live site.
      // The adapter resolves this from the Worker's runtime vars (SITE_ORIGIN in
      // wrangler.jsonc); the default covers everything else, including dev.
      SITE_ORIGIN: envField.string({
        context: "server",
        access: "secret",
        default: "https://sff.maxarias.com",
      }),
    },
  },
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      exclude: ["@sqlite.org/sqlite-wasm"]
    }
  }
});
