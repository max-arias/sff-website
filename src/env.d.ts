/// <reference types="astro/client" />

declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    CATALOG_CACHE?: KVNamespace;
    CATALOG_SEARCH_RATE?: RateLimit;
    INTAKE_TOKEN?: string;
  }
}
