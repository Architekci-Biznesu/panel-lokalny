import fs from "node:fs/promises";
import path from "node:path";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { HonoAdapter } from "@bull-board/hono";
import { Hono, type MiddlewareHandler } from "hono";
import { QUEUE_NAMES, getQueue } from "@/lib/queue";

/**
 * Bull Board (queue preview) as a Hono app, served by the Next route handler
 * app/admin/kolejki/[[...path]]/route.ts - the handler checks staff access
 * before anything here runs. Shows jobs of every customer, post texts too.
 */

export const BOARD_BASE_PATH = "/admin/kolejki";

const CONTENT_TYPES: Record<string, string> = {
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

/** Minimal serveStatic for the UI's files (Node, inside a Next route handler). */
function serveStatic(options?: {
  root?: string;
  rewriteRequestPath?: (p: string) => string;
}): MiddlewareHandler {
  const root = path.resolve(process.cwd(), options?.root ?? ".");
  return async (c, next) => {
    const requested = options?.rewriteRequestPath?.(c.req.path) ?? c.req.path;
    const file = path.resolve(root, `.${path.posix.normalize(requested)}`);
    if (!file.startsWith(`${root}${path.sep}`)) return next();
    try {
      const body = await fs.readFile(file);
      return c.body(body, 200, {
        "Content-Type":
          CONTENT_TYPES[path.extname(file)] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      });
    } catch {
      return next();
    }
  };
}

const globalStore = globalThis as typeof globalThis & {
  __bullBoardApp?: Hono;
};

export function bullBoardApp(): Hono {
  if (globalStore.__bullBoardApp) return globalStore.__bullBoardApp;

  const serverAdapter = new HonoAdapter(serveStatic);
  serverAdapter.setBasePath(BOARD_BASE_PATH);
  createBullBoard({
    queues: QUEUE_NAMES.map((name) => new BullMQAdapter(getQueue(name))),
    serverAdapter,
    options: {
      uiBasePath: path.join(process.cwd(), "node_modules/@bull-board/ui"),
      uiConfig: { boardTitle: "Panel Lokalny - kolejki" },
    },
  });

  const app = new Hono().route(BOARD_BASE_PATH, serverAdapter.registerPlugin());
  globalStore.__bullBoardApp = app;
  return app;
}
