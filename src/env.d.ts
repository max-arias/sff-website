/// <reference types="astro/client" />

declare namespace Cloudflare {
  interface Env {
    /**
     * Catalog source of truth for the build pipeline. The deployed Worker does
     * not read it: `/build` queries a browser-resident artifact instead.
     */
    DB?: D1Database;
  }
}
