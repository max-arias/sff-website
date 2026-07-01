import cloudflare from "@astrojs/cloudflare";
import vue from "@astrojs/vue";
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  output: "server",
  adapter: cloudflare(),
  integrations: [vue()],
  vite: {
    plugins: [tailwindcss()]
  }
});
