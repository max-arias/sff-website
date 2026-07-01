export default defineNuxtConfig({
  modules: ["@nuxt/ui"],
  css: ["~/assets/css/main.css"],
  compatibilityDate: "2026-06-30",
  devtools: { enabled: true },
  nitro: {
    preset: process.env.NITRO_PRESET,
    experimental: {
      asyncContext: true
    }
  },
  runtimeConfig: {
    intakeToken: process.env.INTAKE_TOKEN || "",
    public: {
      appName: "SFF PC Builder"
    }
  },
  typescript: {
    strict: true
  }
});
