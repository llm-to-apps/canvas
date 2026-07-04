import { serve } from "@hono/node-server";

import { createCanvasApp } from "./app.js";
import { prisma } from "./db.js";
import { canvasPublicBaseUrl, port } from "./env.js";
import { logInfo, logWarn } from "./logger.js";
import { ensureCanvasBucket, getCanvasObject, putCanvasObject } from "./storage.js";

const app = createCanvasApp({
  prisma,
  storage: {
    getCanvasObject,
    putCanvasObject,
  },
});

await ensureCanvasBucket().catch((error: unknown) => {
  logWarn("storage.bucket.ensure_failed", {
    error: error instanceof Error ? error.message : "Unknown error",
  });
});

serve(
  {
    fetch: app.fetch,
    port: port(),
  },
  () => {
    logInfo("server.listening", {
      port: port(),
      url: canvasPublicBaseUrl(),
    });
  },
);
