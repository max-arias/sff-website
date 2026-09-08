/// <reference types="astro/client" />

declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    CATALOG_CACHE?: KVNamespace;
    INTAKE_TOKEN?: string;
  }
}
