/// <reference types="astro/client" />

declare namespace Cloudflare {
  interface Env {
    /**
     * Catalog source of truth for the build pipeline. The deployed Worker does
     * not read it: `/build` queries a browser-resident artifact instead.
     */
    DB?: D1Database;
    /**
     * Canonical origin for copied build links, so a list shared from a local or
     * preview deployment still points at the live site. Set in wrangler.jsonc.
     */
    SITE_ORIGIN?: string;
  }
}
