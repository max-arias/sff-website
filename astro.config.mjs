import cloudflare from "@astrojs/cloudflare";
import vue from "@astrojs/vue";
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "server",
  adapter: cloudflare(),
  integrations: [vue()]
});
