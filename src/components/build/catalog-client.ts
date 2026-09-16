import type { BuildView } from "../../lib/build-view";

export type BrowserCatalogStatus = {
  artifactBytes: number;
  downloaded: boolean;
  rows: number;
  sqliteVersion: string;
  version: string;
};

type ViewResponse = {
  status: BrowserCatalogStatus;
  view: BuildView;
};

type WorkerResponse =
  | { requestId: number; status: BrowserCatalogStatus; type: "status" }
  | { requestId: number; status: BrowserCatalogStatus; type: "view"; view: BuildView }
  | { message: string; requestId: number; type: "error" };

type PendingRequest = {
  reject(error: Error): void;
  resolve(response: WorkerResponse): void;
};

export class BrowserCatalogClient {
  private readonly pending = new Map<number, PendingRequest>();
  private readonly worker = new Worker(new URL("./catalog.worker.ts", import.meta.url), { type: "module" });
  private nextRequestId = 1;

  constructor() {
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      const pending = this.pending.get(response.requestId);
      if (!pending) return;
      this.pending.delete(response.requestId);
      if (response.type === "error") {
        pending.reject(new Error(response.message));
        return;
      }
      pending.resolve(response);
    };

    this.worker.onerror = (event) => {
      const error = new Error(event.message || "Catalog worker failed.");
      for (const pending of this.pending.values()) pending.reject(error);
      this.pending.clear();
    };
  }

  async getView(href: string, ignored: readonly string[], siteOrigin?: string): Promise<ViewResponse> {
    const response = await this.request({ href, ignored, siteOrigin, type: "view" });
    if (response.type !== "view") throw new Error("Catalog worker returned an unexpected response.");
    return { status: response.status, view: response.view };
  }

  async getStatus(): Promise<BrowserCatalogStatus> {
    const response = await this.request({ type: "status" });
    if (response.type !== "status") throw new Error("Catalog worker returned an unexpected response.");
    return response.status;
  }

  dispose() {
    this.worker.terminate();
    const error = new Error("Catalog worker was disposed.");
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }

  private request(message: { href?: string; ignored?: readonly string[]; siteOrigin?: string; type: "status" | "view" }): Promise<WorkerResponse> {
    const requestId = this.nextRequestId++;
    const { promise, resolve, reject } = Promise.withResolvers<WorkerResponse>();
    this.pending.set(requestId, { resolve, reject });
    const base = window.location.href;
    if (message.type === "view" && message.href) {
      this.worker.postMessage({
        base,
        href: message.href,
        ignored: message.ignored ?? [],
        requestId,
        siteOrigin: message.siteOrigin,
        type: "view",
      });
      return promise;
    }
    this.worker.postMessage({ base, requestId, type: "status" });
    return promise;
  }
}
